import { useEffect } from 'react'
import { flushSync } from 'react-dom'
import { RotateCcw, X } from 'lucide-react'
import type { ContentUndo } from '@/resume/commands'
import { flushActiveEditorDraft } from '@/state/editing/editorDraft'

export function ContentDeleteToast({ stack, onPop, onClear }: { stack: readonly ContentUndo[]; onPop: () => void; onClear: () => void }) {
  const latest = stack[stack.length - 1] ?? null
  useEffect(() => {
    if (!latest) return
    const timer = window.setTimeout(onClear, 8_000)
    return () => window.clearTimeout(timer)
  }, [latest, onClear])
  if (!latest) return null
  return <div className="content-delete-toast" role="status" aria-live="polite" data-no-print>
    <span>已删除“{latest.label}”{stack.length > 1 ? `（共 ${stack.length} 条可撤销）` : ''}</span>
    <button type="button" onClick={() => { flushSync(flushActiveEditorDraft); latest.restore(); onPop() }}><RotateCcw size={13} />撤销删除</button>
    <button type="button" className="content-toast-close" aria-label="关闭删除提示" onClick={onClear}><X size={13} /></button>
  </div>
}
