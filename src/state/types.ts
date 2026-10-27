import type { Resume, ResumeInput, ResumeLayout, Section, TemplateId, ThemeConfig } from '@/resume/model'
import type { ParseDiagnostic } from '@/resume/markdown/parse'

// 外部文档可携带旧模板标识；进入应用状态前统一转换为注册表中的 id。
export type StoredResume = Omit<ResumeInput, 'theme'> & { theme?: Partial<ThemeConfig> | null }

export interface ResumeSnapshot {
  id: string
  createdAt: number
  resume: Resume
}

export interface DeletedResume {
  resume: Resume
  snapshots: ResumeSnapshot[]
  index: number
  deletedAt: number
}

export interface ParseNotice {
  id: string
  resumeId: string
  diagnostics: ParseDiagnostic[]
  previousSections: Section[]
}

export interface ResumeDataState {
  resumes: Resume[]
  currentId: string | null
  editorRatio: number
  moduleNavigationWidth: number
  uiTheme: 'dark' | 'light'
  autoOnePage: boolean
  snapshots: Record<string, ResumeSnapshot[]>
  lastDeleted: DeletedResume | null
  parseNotice: ParseNotice | null
}

export type StoredResumeSnapshot = Omit<ResumeSnapshot, 'resume'> & { resume: StoredResume }
export type StoredDeletedResume = Omit<DeletedResume, 'resume' | 'snapshots'> & {
  resume: StoredResume
  snapshots?: StoredResumeSnapshot[]
}
export type StoredResumeState = Omit<ResumeDataState, 'resumes' | 'snapshots' | 'lastDeleted'> & {
  resumes: StoredResume[]
  snapshots: Record<string, StoredResumeSnapshot[]>
  lastDeleted: StoredDeletedResume | null
}

export interface ResumeActions {
  createResume: (name?: string) => string
  duplicateResume: (id: string) => string
  renameResume: (id: string, name: string) => void
  removeResume: (id: string) => void
  undoRemoveResume: () => void
  clearLastDeleted: () => void
  setCurrent: (id: string) => void
  setEditorRatio: (ratio: number) => void
  setModuleNavigationWidth: (width: number) => void
  setUiTheme: (theme: 'dark' | 'light') => void
  setAutoOnePage: (value: boolean) => void
  setSections: (id: string, sections: Section[] | ((previous: Section[]) => Section[])) => void
  setPhoto: (id: string, photo: string | undefined) => void
  commitParsedSections: (id: string, sections: Section[], diagnostics: ParseDiagnostic[], previousSections: Section[]) => void
  undoLastParse: () => void
  dismissParseNotice: () => void
  restoreSnapshot: (resumeId: string, snapshotId: string) => void
  setTemplate: (id: string, template: TemplateId) => void
  setTheme: (id: string, patch: Partial<ThemeConfig>) => void
  resetTheme: (id: string) => void
  setLayout: (id: string, layout: ResumeLayout | undefined) => void
  importResume: (resume: StoredResume) => string
  exportResume: (id: string) => Resume | undefined
}

export interface ResumeState extends ResumeDataState, ResumeActions {}
