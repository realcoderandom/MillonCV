import { useSyncExternalStore } from 'react'

export type ResumeHydrationState =
  | { status: 'loading' | 'ready'; error: null; raw: null }
  | { status: 'error'; error: string; raw: string | null }

let state: ResumeHydrationState = { status: 'loading', error: null, raw: null }
const listeners = new Set<() => void>()

export function setResumeHydrationState(next: ResumeHydrationState) {
  state = next
  listeners.forEach((listener) => listener())
}

export function getResumeHydrationState() {
  return state
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useResumeHydrationState() {
  return useSyncExternalStore(subscribe, getResumeHydrationState, getResumeHydrationState)
}
