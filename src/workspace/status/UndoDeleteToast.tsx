import { useEffect } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { useResumeStore } from '@/state/useResumeStore'

const UNDO_WINDOW = 8_000

export function UndoDeleteToast() {
  const lastDeleted = useResumeStore((s) => s.lastDeleted)
  const undoRemoveResume = useResumeStore((s) => s.undoRemoveResume)
  const clearLastDeleted = useResumeStore((s) => s.clearLastDeleted)

  useEffect(() => {
    if (!lastDeleted) return
    const remaining = UNDO_WINDOW - (Date.now() - lastDeleted.deletedAt)
    if (remaining <= 0) {
      clearLastDeleted()
      return
    }
    const timer = window.setTimeout(clearLastDeleted, remaining)
    return () => window.clearTimeout(timer)
  }, [clearLastDeleted, lastDeleted])

  if (!lastDeleted) return null

  return (
    <div
      data-no-print
      className="ui-toast fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-[var(--ui-radius-lg)] border border-white/10 bg-[var(--ui-toast-bg)] px-3 py-2.5 text-[12px] text-[var(--ui-toast-fg)] shadow-[var(--shadow-soft)]"
      role="status"
      aria-live="polite"
    >
      <Trash2 size={14} className="text-[var(--ui-toast-fg)]" />
      <span>已删除“{lastDeleted.resume.name}”</span>
      <button
        type="button"
        className="inline-flex h-7 items-center gap-1 rounded-[var(--ui-radius-sm)] px-2 font-medium text-[#b8d2ff] hover:bg-white/10"
        onClick={undoRemoveResume}
      >
        <RotateCcw size={12} /> 撤销
      </button>
    </div>
  )
}
