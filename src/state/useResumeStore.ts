import { create } from 'zustand'
import { persist, type StorageValue } from 'zustand/middleware'
import type { Resume } from '@/resume/model'
import { uid } from '@/shared/lib/id'
import { createSampleResume } from '@/resume/sample'
import { createDebouncedStorage } from './storage/debouncedStorage'
import { setResumeHydrationState } from './storage/resumeHydration'
import { clearPersistenceError, markPersistenceError } from './storage/persistenceStatus'
import { createResumeJSONStorage } from './storage/resumeStorageSchema'
import { createStateSerializer } from './storage/stateSerialization'
import { migrateResumeState, RESUME_STORAGE_VERSION } from './resumeMigrations'
import { mergeStoredResumeState, normalizeStoredResume } from './resumeNormalization'
import type { ResumeSnapshot, ResumeState, StoredResumeState } from './types'
import { normalizeResumeLayout } from '@/resume/layout'
import { clampModuleNavigationWidth, DEFAULT_MODULE_NAVIGATION_WIDTH } from '@/shared/layout/workspaceLayout'
import { isResumePhoto } from '@/resume/photo'
import {
  patchResumeTheme,
  resetResumeTheme,
  selectResumeTemplate,
} from '@/templates/theme'

export type { ParseNotice, ResumeSnapshot } from './types'

const resumeStorage = createDebouncedStorage<StorageValue<Partial<StoredResumeState>>>(500, createStateSerializer())
const STORAGE_KEY = 'resume-maker:store'

export function retryResumeHydration() {
  void useResumeStore.persist.rehydrate()
}

/** 编辑器在 pagehide 时解析完草稿后，用它同步落盘最新 store。 */
export function flushResumeStorage() {
  resumeStorage.flush()
}

/** 存储失败后重新提交完整状态并立即 flush。 */
export function retryResumeStorage() {
  const state = useResumeStore.getState()
  useResumeStore.setState({ resumes: [...state.resumes] })
  resumeStorage.flush()
}

const MAX_SNAPSHOTS = 10
const SNAPSHOT_INTERVAL = 30_000

function addSnapshot(
  snapshots: Record<string, ResumeSnapshot[]>,
  resume: Resume,
  force = false,
): Record<string, ResumeSnapshot[]> {
  const current = snapshots[resume.id] ?? []
  const now = Date.now()
  if (!force && current[0] && now - current[0].createdAt < SNAPSHOT_INTERVAL) {
    return snapshots
  }
  const snapshot: ResumeSnapshot = {
    id: uid(),
    createdAt: now,
    resume: structuredClone(resume),
  }
  return { ...snapshots, [resume.id]: [snapshot, ...current].slice(0, MAX_SNAPSHOTS) }
}

function touch(r: Resume): Resume {
  return { ...r, updatedAt: Date.now() }
}

export const useResumeStore = create<ResumeState>()(
  persist(
    (set, get) => ({
      resumes: [],
      currentId: null,
      editorRatio: 0.52,
      moduleNavigationWidth: DEFAULT_MODULE_NAVIGATION_WIDTH,
      uiTheme: 'light',
      autoOnePage: false,
      snapshots: {},
      lastDeleted: null,
      parseNotice: null,

      createResume: (name) => {
        const r = createSampleResume()
        r.id = uid()
        r.name = name || '姓名-目标岗位'
        r.sections = [
          {
            id: uid(),
            type: 'basics',
            title: '基本信息',
            data: {
              name: '姓名',
              title: '职位',
              contact: { phone: '', email: '', location: '', website: '', github: '' },
              summary: '',
            },
          },
        ]
        set((s) => ({ resumes: [...s.resumes, r], currentId: r.id }))
        return r.id
      },

      duplicateResume: (id) => {
        const src = get().resumes.find((r) => r.id === id)
        if (!src) return id
        const copy: Resume = {
          ...structuredClone(src),
          id: uid(),
          name: `${src.name} 副本`,
          updatedAt: Date.now(),
        }
        set((s) => ({ resumes: [...s.resumes, copy], currentId: copy.id }))
        return copy.id
      },

      renameResume: (id, name) =>
        set((s) => ({
          resumes: s.resumes.map((r) => (r.id === id ? touch({ ...r, name }) : r)),
        })),

      removeResume: (id) =>
        set((s) => {
          const index = s.resumes.findIndex((r) => r.id === id)
          if (index < 0) return s
          const deleted = s.resumes[index]
          const resumes = s.resumes.filter((r) => r.id !== id)
          const { [id]: deletedSnapshots = [], ...snapshots } = s.snapshots
          let currentId = s.currentId
          if (currentId === id) {
            currentId = resumes.length ? resumes[resumes.length - 1].id : null
          }
          return {
            resumes,
            snapshots,
            currentId,
            lastDeleted: {
              resume: structuredClone(deleted),
              snapshots: deletedSnapshots,
              index,
              deletedAt: Date.now(),
            },
          }
        }),

      undoRemoveResume: () =>
        set((s) => {
          if (!s.lastDeleted) return s
          const { resume, snapshots: deletedSnapshots = [], index } = s.lastDeleted
          if (s.resumes.some((item) => item.id === resume.id)) {
            return { lastDeleted: null }
          }
          const resumes = [...s.resumes]
          resumes.splice(Math.min(index, resumes.length), 0, resume)
          return {
            resumes,
            snapshots: deletedSnapshots.length
              ? { ...s.snapshots, [resume.id]: deletedSnapshots }
              : s.snapshots,
            currentId: resume.id,
            lastDeleted: null,
          }
        }),

      clearLastDeleted: () => set({ lastDeleted: null }),

      setCurrent: (id) => set({ currentId: id }),

      setEditorRatio: (ratio) =>
        // 下限 1/3：编辑区:预览区 ≥ 1:2，保证编辑区不被拖太窄；上限 0.8
        set({ editorRatio: Math.min(0.8, Math.max(1 / 3, ratio)) }),

      setUiTheme: (theme) => set({ uiTheme: theme }),

      setModuleNavigationWidth: (width) => set({ moduleNavigationWidth: clampModuleNavigationWidth(width) }),

      setAutoOnePage: (v) => set({ autoOnePage: v }),

      setSections: (id, sections) =>
        set((s) => {
          const resume = s.resumes.find((r) => r.id === id)
          if (!resume) return s
          const next = typeof sections === 'function' ? sections(resume.sections) : sections
          if (next === resume.sections) return s
          return {
            snapshots: addSnapshot(s.snapshots, resume),
            resumes: s.resumes.map((r) =>
              r.id === id ? touch({ ...r, sections: next }) : r,
            ),
          }
        }),

      setPhoto: (id, photo) =>
        set((s) => {
          if (photo !== undefined && !isResumePhoto(photo)) return s
          const resume = s.resumes.find((item) => item.id === id)
          const basics = resume?.sections.find((section) => section.type === 'basics')
          if (!resume || basics?.type !== 'basics' || basics.data.photo === photo) return s
          const { photo: _oldPhoto, ...data } = basics.data
          const sections = resume.sections.map((section) => section.id === basics.id
            ? { ...basics, data: photo ? { ...data, photo } : data }
            : section)
          return {
            snapshots: addSnapshot(s.snapshots, resume, true),
            resumes: s.resumes.map((item) => item.id === id ? touch({ ...item, sections }) : item),
          }
        }),

      commitParsedSections: (id, sections, diagnostics, previousSections) =>
        set((s) => {
          const resume = s.resumes.find((r) => r.id === id)
          if (!resume) return s
          return {
            snapshots: addSnapshot(s.snapshots, resume),
            resumes: s.resumes.map((r) =>
              r.id === id ? touch({ ...r, sections }) : r,
            ),
            parseNotice: diagnostics.length
              ? {
                  id: uid(),
                  resumeId: id,
                  diagnostics,
                  previousSections: structuredClone(previousSections),
                }
              : null,
          }
        }),

      undoLastParse: () =>
        set((s) => {
          const notice = s.parseNotice
          if (!notice) return s
          const resume = s.resumes.find((r) => r.id === notice.resumeId)
          if (!resume) return { parseNotice: null }
          return {
            snapshots: addSnapshot(s.snapshots, resume, true),
            resumes: s.resumes.map((r) =>
              r.id === notice.resumeId
                ? touch({ ...r, sections: structuredClone(notice.previousSections) })
                : r,
            ),
            parseNotice: null,
          }
        }),

      dismissParseNotice: () => set({ parseNotice: null }),

      restoreSnapshot: (resumeId, snapshotId) =>
        set((s) => {
          const current = s.resumes.find((r) => r.id === resumeId)
          const snapshot = s.snapshots[resumeId]?.find((item) => item.id === snapshotId)
          if (!current || !snapshot) return s
          return {
            snapshots: addSnapshot(s.snapshots, current, true),
            resumes: s.resumes.map((r) =>
              r.id === resumeId
                ? { ...normalizeStoredResume(structuredClone(snapshot.resume)), id: resumeId, updatedAt: Date.now() }
                : r,
            ),
          }
        }),

      setTemplate: (id, template) =>
        set((s) => ({
          resumes: s.resumes.map((r) => r.id === id ? touch(selectResumeTemplate(r, template)) : r),
        })),

      setTheme: (id, patch) =>
        set((s) => ({
          resumes: s.resumes.map((r) =>
            r.id === id ? touch(patchResumeTheme(r, patch)) : r,
          ),
        })),

      resetTheme: (id) =>
        set((s) => ({
          resumes: s.resumes.map((r) => r.id === id ? touch(resetResumeTheme(r)) : r),
        })),

      setLayout: (id, layout) =>
        set((s) => {
          const resume = s.resumes.find((r) => r.id === id)
          if (!resume) return s
          return {
            snapshots: addSnapshot(s.snapshots, resume),
            resumes: s.resumes.map((r) => r.id === id
              ? touch({ ...r, layout: normalizeResumeLayout(layout, r.sections) })
              : r),
          }
        }),

      importResume: (resume) => {
        const r: Resume = {
          ...normalizeStoredResume(structuredClone(resume)),
          id: uid(),
          updatedAt: Date.now(),
        }
        set((s) => ({ resumes: [...s.resumes, r], currentId: r.id }))
        return r.id
      },

      exportResume: (id) => get().resumes.find((r) => r.id === id),
    }),
    {
      // 品牌更名后仍沿用历史键，避免已有简历、快照和 UI 偏好看似丢失。
      name: STORAGE_KEY,
      storage: createResumeJSONStorage<Partial<StoredResumeState>>(resumeStorage, RESUME_STORAGE_VERSION),
      version: RESUME_STORAGE_VERSION,
      partialize: (state) => ({
        resumes: state.resumes,
        currentId: state.currentId,
        editorRatio: state.editorRatio,
        moduleNavigationWidth: state.moduleNavigationWidth,
        uiTheme: state.uiTheme,
        autoOnePage: state.autoOnePage,
        snapshots: state.snapshots,
        lastDeleted: state.lastDeleted,
        parseNotice: state.parseNotice,
      }),
      onRehydrateStorage: () => {
        setResumeHydrationState({ status: 'loading', error: null, raw: null })
        return (_state, error) => {
          if (error) {
            resumeStorage.setReadOnly(true)
            let raw: string | null = null
            try { raw = localStorage.getItem(STORAGE_KEY) } catch { /* 权限异常时仍保留只读保护。 */ }
            markPersistenceError(error)
            setResumeHydrationState({ status: 'error', error: error instanceof Error ? error.message : '无法读取本地简历。', raw })
          } else {
            resumeStorage.setReadOnly(false)
            clearPersistenceError()
            setResumeHydrationState({ status: 'ready', error: null, raw: null })
          }
        }
      },
      merge: mergeStoredResumeState,
      migrate: migrateResumeState,
    },
  ),
)

// 选择器：当前简历
export function useCurrentResume(): Resume | null {
  return useResumeStore((s) => s.resumes.find((r) => r.id === s.currentId) ?? null)
}

// 默认主题导出，供 UI 重置使用
export { DEFAULT_THEME } from '@/resume/model'
