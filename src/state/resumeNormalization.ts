import { DEFAULT_THEME, type Resume } from '@/resume/model'
import { normalizeTemplateId } from '@/templates/registry'
import { normalizeTemplateThemeOverrides } from '@/templates/theme'
import { normalizePhotoWidth } from '@/resume/photo'
import { normalizeResumeLayout } from '@/resume/layout'
import { clampModuleNavigationWidth, DEFAULT_MODULE_NAVIGATION_WIDTH } from '@/shared/layout/workspaceLayout'
import type { ResumeState, StoredResume, StoredResumeState } from './types'

// 主文档、历史、撤销删除与导入共用同一读取边界；不重新套用旧文档主题。
export function normalizeStoredResume(resume: StoredResume): Resume {
  const theme = { ...DEFAULT_THEME, ...resume.theme }
  const photoWidth = normalizePhotoWidth(theme.photoWidth)
  if (photoWidth === undefined) delete theme.photoWidth
  else theme.photoWidth = photoWidth
  return {
    ...resume,
    template: normalizeTemplateId(resume.template),
    theme,
    templateThemeOverrides: normalizeTemplateThemeOverrides(resume.templateThemeOverrides),
    layout: normalizeResumeLayout(resume.layout, resume.sections),
  }
}

export function mergeStoredResumeState(persisted: unknown, current: ResumeState): ResumeState {
  const stored = (persisted ?? {}) as Partial<StoredResumeState>
  return {
    ...current,
    currentId: stored.currentId === undefined ? current.currentId : stored.currentId,
    uiTheme: stored.uiTheme ?? current.uiTheme,
    autoOnePage: stored.autoOnePage ?? current.autoOnePage,
    snapshots: Object.fromEntries(Object.entries(stored.snapshots ?? current.snapshots).map(([id, snapshots]) => [
      id, snapshots.map((snapshot) => ({ ...snapshot, resume: normalizeStoredResume(snapshot.resume) })),
    ])),
    lastDeleted: stored.lastDeleted ? {
      ...stored.lastDeleted,
      resume: normalizeStoredResume(stored.lastDeleted.resume),
      snapshots: (stored.lastDeleted.snapshots ?? []).map((snapshot) => ({ ...snapshot, resume: normalizeStoredResume(snapshot.resume) })),
    } : stored.lastDeleted ?? current.lastDeleted,
    parseNotice: stored.parseNotice ?? current.parseNotice,
    editorRatio: stored.editorRatio == null ? current.editorRatio : Math.min(0.8, Math.max(1 / 3, stored.editorRatio)),
    moduleNavigationWidth: clampModuleNavigationWidth(stored.moduleNavigationWidth ?? DEFAULT_MODULE_NAVIGATION_WIDTH),
    resumes: (stored.resumes ?? current.resumes).map(normalizeStoredResume),
  }
}
