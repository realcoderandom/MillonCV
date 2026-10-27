import { useEffect } from 'react'
import { flushSync } from 'react-dom'
import { RotateCcw, X } from 'lucide-react'
import type { ContentUndo } from '@/resume/commands'
import { flushActiveEditorDraft } from '@/state/editing/editorDraft'

export function ContentDeleteToast({ undo, onClose }: { undo: ContentUndo | null; onClose: () => void }) {
  useEffect(() => {
    if (!undo) return
    const timer = window.setTimeout(onClose, 8_000)
    return () => window.clearTimeout(timer)
  }, [undo, onClose])
  if (!undo) return null
  return <div className="content-delete-toast" role="status" aria-live="polite" data-no-print>
    <span>已删除“{undo.label}”</span>
    <button type="button" onClick={() => { flushSync(flushActiveEditorDraft); undo.restore(); onClose() }}><RotateCcw size={13} />撤销删除</button>
    <button type="button" className="content-toast-close" aria-label="关闭删除提示" onClick={onClose}><X size={13} /></button>
  </div>
}
