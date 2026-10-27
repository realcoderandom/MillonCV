import type { StateStorage } from 'zustand/middleware'
import {
  markPersistenceError,
  markPersistenceSaved,
  markPersistenceSaving,
} from './persistenceStatus'

export interface FlushableStateStorage<Value = string> extends Omit<StateStorage, 'setItem'> {
  setItem: (name: string, value: Value) => void
  flush: () => void
  setReadOnly: (readOnly: boolean) => void
}

// 原始状态也进入防抖队列，序列化与写入只在真正 flush 时执行。
// pagehide 前强制 flush，避免关闭页面时丢失最后一次输入。
export function createDebouncedStorage(delay?: number): FlushableStateStorage
export function createDebouncedStorage<Value>(delay: number, serialize: (value: Value) => string): FlushableStateStorage<Value>
export function createDebouncedStorage<Value>(delay = 500, serialize: (value: Value) => string = String): FlushableStateStorage<Value> {
  const pending = new Map<string, Value>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let readOnly = false

  const setReadOnly = (value: boolean) => {
    readOnly = value
    if (!value) return
    if (timer) clearTimeout(timer)
    timer = null
    pending.clear()
  }

  const flush = () => {
    if (timer) clearTimeout(timer)
    timer = null
    if (readOnly || pending.size === 0) return
    try {
      for (const [key, value] of pending) localStorage.setItem(key, serialize(value))
      pending.clear()
      markPersistenceSaved()
    } catch (error) {
      // 保留 pending，允许用户释放空间后手动重试；错误状态持续显示，不静默吞掉。
      markPersistenceError(error)
    }
  }

  if (typeof window !== 'undefined') window.addEventListener('pagehide', flush)

  return {
    flush,
    setReadOnly,
    getItem: (name) => {
      try {
        return localStorage.getItem(name)
      } catch (error) {
        setReadOnly(true)
        markPersistenceError(error)
        // 读取失败不能伪装成首次空存储，否则初始化会覆盖尚未恢复的数据。
        throw error
      }
    },
    setItem: (name, value) => {
      if (readOnly) return
      pending.set(name, value)
      markPersistenceSaving()
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, delay)
    },
    removeItem: (name) => {
      if (readOnly) return
      pending.delete(name)
      try {
        localStorage.removeItem(name)
      } catch (error) {
        markPersistenceError(error)
      }
    },
  }
}
