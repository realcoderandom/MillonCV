import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResumeLayout, Section } from '@/resume/model'

export interface ModularSnapshot {
  sections: Section[]
  layout?: ResumeLayout
}

interface Options {
  sections: Section[]
  layout?: ResumeLayout
  onApply: (snapshot: ModularSnapshot) => void
}

const MAX_HISTORY = 50
const COALESCE_WINDOW_MS = 600

function structureKey(sections: Section[], layout?: ResumeLayout): string {
  const sectionShape = sections.map((section) => {
    if ('items' in section.data) {
      const items = section.data.items.map((item) => `${item.id}:${(item.projects ?? []).map((project) => project.id).join(',')}`).join(';')
      return `${section.id}[${items}]`
    }
    return section.id
  }).join('|')
  const layoutKey = layout ? `${layout.order?.join(',') ?? ''}:${JSON.stringify(layout.regions ?? {})}:${layout.sidebarWidth ?? ''}` : ''
  return `${sectionShape}::${layoutKey}`
}

/** 表单模式统一撤销/重做栈：600ms 内同结构连续打字自动合并，增删/排序/改栏独立成步。 */
export function useModularHistory({ sections, layout, onApply }: Options) {
  const pastRef = useRef<ModularSnapshot[]>([])
  const futureRef = useRef<ModularSnapshot[]>([])
  const currentRef = useRef<ModularSnapshot>({ sections, layout })
  const lastRecordedAtRef = useRef(0)
  const applyingRef = useRef<ModularSnapshot | null>(null)
  const [counts, setCounts] = useState({ past: 0, future: 0 })

  const syncCounts = useCallback(() => {
    setCounts({ past: pastRef.current.length, future: futureRef.current.length })
  }, [])

  useEffect(() => {
    const previous = currentRef.current
    if (previous.sections === sections && previous.layout === layout) return

    const applied = applyingRef.current
    if (applied && applied.sections === sections && applied.layout === layout) {
      applyingRef.current = null
      currentRef.current = { sections, layout }
      return
    }
    applyingRef.current = null

    const now = Date.now()
    const sameStructure = structureKey(previous.sections, previous.layout) === structureKey(sections, layout)
    const shouldCoalesce = sameStructure && pastRef.current.length > 0 && now - lastRecordedAtRef.current < COALESCE_WINDOW_MS

    if (!shouldCoalesce) {
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), previous]
    }
    futureRef.current = []
    currentRef.current = { sections, layout }
    lastRecordedAtRef.current = now
    syncCounts()
  }, [sections, layout, syncCounts])

  const undo = useCallback(() => {
    const target = pastRef.current[pastRef.current.length - 1]
    if (!target) return false
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [...futureRef.current.slice(-(MAX_HISTORY - 1)), currentRef.current]
    applyingRef.current = target
    currentRef.current = target
    lastRecordedAtRef.current = 0
    onApply(target)
    syncCounts()
    return true
  }, [onApply, syncCounts])

  const redo = useCallback(() => {
    const target = futureRef.current[futureRef.current.length - 1]
    if (!target) return false
    futureRef.current = futureRef.current.slice(0, -1)
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), currentRef.current]
    applyingRef.current = target
    currentRef.current = target
    lastRecordedAtRef.current = 0
    onApply(target)
    syncCounts()
    return true
  }, [onApply, syncCounts])

  return {
    canUndo: counts.past > 0,
    canRedo: counts.future > 0,
    undo,
    redo,
  }
}
