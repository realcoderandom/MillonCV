import { SECTION_TYPE_LABELS, type DatedItem, type Section } from '@/resume/model'
import { isItemSection } from '@/resume/sections'
import type { StoredResume, StoredResumeSnapshot, StoredResumeState } from './types'

export const RESUME_STORAGE_VERSION = 10

type LegacyItem = DatedItem & {
  start?: string
  end?: string
  techStack?: string
  summary?: string
  fieldOrder?: string[]
}

// 所有历史容器共用迁移遍历，新增版本只需描述如何转换分节。
function mapSections(state: Partial<StoredResumeState>, update: (section: Section) => Section): Partial<StoredResumeState> {
  const sections = (value: Section[]) => value.map(update)
  const resume = (value: StoredResume): StoredResume => ({ ...value, sections: sections(value.sections) })
  const snapshots = (values: StoredResumeSnapshot[]) => values.map((snapshot) => ({ ...snapshot, resume: resume(snapshot.resume) }))
  return {
    ...state,
    resumes: (state.resumes ?? []).map(resume),
    snapshots: Object.fromEntries(Object.entries(state.snapshots ?? {}).map(([id, values]) => [id, snapshots(values)])),
    ...(state.lastDeleted ? { lastDeleted: {
      ...state.lastDeleted,
      resume: resume(state.lastDeleted.resume),
      snapshots: snapshots(state.lastDeleted.snapshots ?? []),
    } } : {}),
    ...(state.parseNotice ? { parseNotice: { ...state.parseNotice, previousSections: sections(state.parseNotice.previousSections) } } : {}),
  }
}

function updateItems(section: Section, update: (item: LegacyItem) => DatedItem): Section {
  if (!isItemSection(section)) return section
  return { ...section, data: { ...section.data, items: section.data.items.map(update) } }
}

const MIGRATIONS: readonly { version: number; update: (section: Section) => Section }[] = [
  {
    version: 2,
    update: (section) => updateItems(section, (item) => {
      if (item.start === undefined && item.end === undefined) return item
      const { start, end, ...rest } = item
      const rightText = [start, end].filter(Boolean).join(' - ') || rest.rightText
      return { ...rest, ...(rightText ? { rightText } : {}) }
    }),
  },
  {
    version: 3,
    update: (section) => section.type !== 'projects' ? section : updateItems(section, (item) => {
      if (!item.techStack?.trim()) return item
      const { techStack, ...rest } = item
      const prefix = `**技术栈**：${techStack.trim()}`
      return { ...rest, description: rest.description.trim() ? `${prefix}\n\n${rest.description}` : prefix }
    }),
  },
  {
    version: 4,
    update: (section) => section.type !== 'projects' ? section : updateItems(section, (item) => {
      const { summary, fieldOrder: _fieldOrder, ...rest } = item
      if (!summary?.trim()) return rest
      return { ...rest, description: rest.description.trim() ? `${summary.trim()}\n\n${rest.description}` : summary.trim() }
    }),
  },
  {
    version: 10,
    update: (section) => section.type === 'projects' && section.title === '项目经历'
      ? { ...section, title: SECTION_TYPE_LABELS.projects }
      : section,
  },
]

export function migrateResumeState(persisted: unknown, version: number): Partial<StoredResumeState> {
  let state = (persisted ?? {}) as Partial<StoredResumeState>
  for (const migration of MIGRATIONS) {
    if (version < migration.version) state = mapSections(state, migration.update)
  }
  return state
}
