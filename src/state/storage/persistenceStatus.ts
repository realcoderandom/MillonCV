import { useSyncExternalStore } from 'react'

export type PersistenceState =
  | { status: 'idle'; savedAt: null; error: null }
  | { status: 'saving'; savedAt: number | null; error: null }
  | { status: 'saved'; savedAt: number; error: null }
  | { status: 'error'; savedAt: number | null; error: string }

let state: PersistenceState = { status: 'idle', savedAt: null, error: null }
const listeners = new Set<() => void>()

function publish(next: PersistenceState) {
  state = next
  listeners.forEach((listener) => listener())
}

export function markPersistenceSaving() {
  // 失败状态必须持续可见，直到一次真实写入成功；不能因新的编辑动作短暂伪装成“保存中”。
  if (state.status === 'error') return
  publish({ status: 'saving', savedAt: state.savedAt, error: null })
}

export function markPersistenceSaved(savedAt = Date.now()) {
  publish({ status: 'saved', savedAt, error: null })
}

export function clearPersistenceError() {
  if (state.status === 'error') publish({ status: 'idle', savedAt: null, error: null })
}

export function markPersistenceError(error: unknown) {
  publish({
    status: 'error',
    savedAt: state.savedAt,
    error: error instanceof Error ? error.message : '浏览器存储写入失败',
  })
}

export function getPersistenceState() {
  return state
}

export function usePersistenceState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getPersistenceState,
    getPersistenceState,
  )
}
