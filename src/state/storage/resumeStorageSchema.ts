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

function section(value: unknown, path: string) {
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
      strings(data, ['content'], `${path}.data`)
      break
    case 'custom':
      strings(data, ['title', 'content'], `${path}.data`)
      break
    default:
      invalid(`${path}.type`)
  }
}

function resume(value: unknown, path: string) {
  record(value, path)
  strings(value, ['id', 'name', 'template'], path)
  list(value.sections, `${path}.sections`, section)
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

function snapshot(value: unknown, path: string) {
  record(value, path)
  strings(value, ['id'], path)
  if (typeof value.createdAt !== 'number') invalid(`${path}.createdAt`)
  resume(value.resume, `${path}.resume`)
}

export function validateResumeStorage(value: unknown, currentVersion: number) {
  record(value, 'storage')
  if (value.version != null && (typeof value.version !== 'number' || !Number.isInteger(value.version)
    || value.version < 0 || value.version > currentVersion)) invalid('storage.version')
  const state = value.state
  record(state, 'state')
  list(state.resumes, 'resumes', resume)
  if (state.currentId != null && typeof state.currentId !== 'string') invalid('currentId')
  if (state.snapshots != null) {
    record(state.snapshots, 'snapshots')
    Object.entries(state.snapshots).forEach(([id, snapshots]) => list(snapshots, `snapshots.${id}`, snapshot))
  }
  if (state.lastDeleted != null) {
    record(state.lastDeleted, 'lastDeleted')
    resume(state.lastDeleted.resume, 'lastDeleted.resume')
    if (state.lastDeleted.snapshots != null) list(state.lastDeleted.snapshots, 'lastDeleted.snapshots', snapshot)
    for (const key of ['index', 'deletedAt']) if (typeof state.lastDeleted[key] !== 'number') invalid(`lastDeleted.${key}`)
  }
  if (state.parseNotice != null) {
    record(state.parseNotice, 'parseNotice')
    strings(state.parseNotice, ['id', 'resumeId'], 'parseNotice')
    list(state.parseNotice.previousSections, 'parseNotice.previousSections', section)
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
    return value as StorageValue<S>
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
