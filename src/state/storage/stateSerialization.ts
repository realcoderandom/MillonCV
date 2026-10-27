import type { StorageValue } from 'zustand/middleware'

interface CachedField {
  value: unknown
  json: string | undefined
}

// Store 使用不可变更新：按顶层字段引用复用 JSON，偏好修改无需重复编码正文和历史。
// 每个字段只保留最近一次结果；持久化仍输出原有的单键 JSON 封装。
export function createStateSerializer<State extends object>() {
  let cache = new Map<string, CachedField>()
  return ({ state, version }: StorageValue<State>): string => {
    const nextCache = new Map<string, CachedField>()
    const fields: string[] = []
    for (const [key, value] of Object.entries(state)) {
      const previous = cache.get(key)
      const field = previous && Object.is(previous.value, value)
        ? previous
        : { value, json: JSON.stringify(value) }
      nextCache.set(key, field)
      if (field.json !== undefined) fields.push(`${JSON.stringify(key)}:${field.json}`)
    }
    const result = `{"state":{${fields.join(',')}}${version === undefined ? '' : `,"version":${JSON.stringify(version)}`}}`
    cache = nextCache
    return result
  }
}
