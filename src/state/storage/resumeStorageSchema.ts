import type { PersistStorage, StorageValue } from 'zustand/middleware'
import type { FlushableStateStorage } from './debouncedStorage'

// 仅校验读入后会被编辑器、迁移和历史操作消费的结构；历史可选字段仍由迁移补齐。
function record(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path)
}

function invalid(path: string): never {
  throw new Error(`本地简历数据格式异常：${path}`)
}

function strings(value: Record<string, unknown>, keys: string[], path: string) {
  for (const key of keys) if (typeof value[key] !== 'string') invalid(`${path}.${key}`)
}

function list(value: unknown, path: string, validate: (value: unknown, path: string) => void) {
  if (!Array.isArray(value)) invalid(path)
  value.forEach((item, index) => validate(item, `${path}[${index}]`))
}

function item(value: unknown, path: string) {
  record(value, path)
  strings(value, ['id', 'title', 'subtitle', 'description'], path)
  if (value.rightText != null && typeof value.rightText !== 'string') invalid(`${path}.rightText`)
  if (value.projects != null) list(value.projects, `${path}.projects`, item)
}

function skillGroup(value: unknown, path: string) {
  record(value, path)
  strings(value, ['category'], path)
  list(value.items, `${path}.items`, (item, itemPath) => {
    if (typeof item !== 'string') invalid(itemPath)
  })
}

function section(value: unknown, path: string, allowLegacySkills: boolean) {
  record(value, path)
  strings(value, ['id', 'type', 'title'], path)
  const data = value.data
  record(data, `${path}.data`)
  switch (value.type) {
    case 'basics':
      strings(data, ['name', 'title', 'summary'], `${path}.data`)
      record(data.contact, `${path}.data.contact`)
      strings(data.contact, ['phone', 'email', 'location', 'website', 'github'], `${path}.data.contact`)
      if (data.workExperience != null && typeof data.workExperience !== 'string') invalid(`${path}.data.workExperience`)
      if (data.photo != null && typeof data.photo !== 'string') invalid(`${path}.data.photo`)
      break
    case 'experience': case 'education': case 'projects':
      list(data.items, `${path}.data.items`, item)
      break
    case 'skills':
      // v10 及更早的技能仍可能保存为分组；先验证旧结构，再由 v11 迁移为正文。
      if (allowLegacySkills && data.content == null && Array.isArray(data.groups)) {
        list(data.groups, `${path}.data.groups`, skillGroup)
      } else {
        strings(data, ['content'], `${path}.data`)
      }
      break
    case 'custom':
      strings(data, ['title', 'content'], `${path}.data`)
      break
    default:
      invalid(`${path}.type`)
  }
}

function resume(value: unknown, path: string, allowLegacySkills: boolean) {
  record(value, path)
  strings(value, ['id', 'name', 'template'], path)
  list(value.sections, `${path}.sections`, (value, path) => section(value, path, allowLegacySkills))
  if (value.updatedAt != null && typeof value.updatedAt !== 'number') invalid(`${path}.updatedAt`)
  if (value.theme != null) {
    record(value.theme, `${path}.theme`)
    if ('primaryColor' in value.theme && typeof value.theme.primaryColor !== 'string') invalid(`${path}.theme.primaryColor`)
    if (value.theme.fontFamily != null && typeof value.theme.fontFamily !== 'string') invalid(`${path}.theme.fontFamily`)
    for (const key of ['fontSize', 'margin', 'lineHeight']) {
      if (key in value.theme && typeof value.theme[key] !== 'number') invalid(`${path}.theme.${key}`)
    }
    for (const key of ['h1Size', 'h2Size', 'h3Size', 'sectionGap', 'photoWidth']) {
      if (value.theme[key] != null && typeof value.theme[key] !== 'number') invalid(`${path}.theme.${key}`)
    }
  }
}

function snapshot(value: unknown, path: string, allowLegacySkills: boolean) {
  record(value, path)
  strings(value, ['id'], path)
  if (typeof value.createdAt !== 'number') invalid(`${path}.createdAt`)
  resume(value.resume, `${path}.resume`, allowLegacySkills)
}

export function validateResumeStorage(value: unknown, currentVersion: number) {
  record(value, 'storage')
  const version = value.version ?? 0
  if (typeof version !== 'number' || !Number.isInteger(version)
    || version < 0 || version > currentVersion) invalid('storage.version')
  const allowLegacySkills = version < 11
  const validateResume = (value: unknown, path: string) => resume(value, path, allowLegacySkills)
  const validateSnapshot = (value: unknown, path: string) => snapshot(value, path, allowLegacySkills)
  const state = value.state
  record(state, 'state')
  list(state.resumes, 'resumes', validateResume)
  if (state.currentId != null && typeof state.currentId !== 'string') invalid('currentId')
  if (state.snapshots != null) {
    record(state.snapshots, 'snapshots')
    Object.entries(state.snapshots).forEach(([id, snapshots]) => list(snapshots, `snapshots.${id}`, validateSnapshot))
  }
  if (state.lastDeleted != null) {
    record(state.lastDeleted, 'lastDeleted')
    validateResume(state.lastDeleted.resume, 'lastDeleted.resume')
    if (state.lastDeleted.snapshots != null) list(state.lastDeleted.snapshots, 'lastDeleted.snapshots', validateSnapshot)
    for (const key of ['index', 'deletedAt']) if (typeof state.lastDeleted[key] !== 'number') invalid(`lastDeleted.${key}`)
  }
  if (state.parseNotice != null) {
    record(state.parseNotice, 'parseNotice')
    strings(state.parseNotice, ['id', 'resumeId'], 'parseNotice')
    list(state.parseNotice.previousSections, 'parseNotice.previousSections', (value, path) => section(value, path, allowLegacySkills))
    list(state.parseNotice.diagnostics, 'parseNotice.diagnostics', (diagnostic, path) => {
      record(diagnostic, path)
      strings(diagnostic, ['kind', 'title', 'toType'], path)
    })
  }
  for (const key of ['editorRatio', 'moduleNavigationWidth']) {
    if (state[key] != null && typeof state[key] !== 'number') invalid(key)
  }
  if (state.uiTheme != null && state.uiTheme !== 'light' && state.uiTheme !== 'dark') invalid('uiTheme')
  if (state.autoOnePage != null && typeof state.autoOnePage !== 'boolean') invalid('autoOnePage')
}
export function createResumeJSONStorage<S>(
  storage: Pick<FlushableStateStorage<StorageValue<S>>, 'getItem' | 'setItem' | 'removeItem'>,
  currentVersion: number,
): PersistStorage<S> {
  const parse = (raw: string | null): StorageValue<S> | null => {
    if (raw === null) return null
    const value: unknown = JSON.parse(raw)
    validateResumeStorage(value, currentVersion)
    const stored = value as StorageValue<S>
    // Zustand 会跳过无版本号的数据迁移，按最早版本补齐后再进入统一迁移链。
    return { ...stored, version: stored.version ?? 0 }
  }
  return {
    getItem: (name) => {
      const raw = storage.getItem(name)
      return raw instanceof Promise ? raw.then(parse) : parse(raw)
    },
    setItem: (name, value) => storage.setItem(name, value),
    removeItem: (name) => storage.removeItem(name),
  }
}
