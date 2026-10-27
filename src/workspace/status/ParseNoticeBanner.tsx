import { Info, RotateCcw, X } from 'lucide-react'
import { SECTION_TYPE_LABELS } from '@/resume/model'
import { useResumeStore } from '@/state/useResumeStore'

interface Props {
  resumeId: string
}

export function ParseNoticeBanner({ resumeId }: Props) {
  const notice = useResumeStore((s) => s.parseNotice)
  const undoLastParse = useResumeStore((s) => s.undoLastParse)
  const dismissParseNotice = useResumeStore((s) => s.dismissParseNotice)

  if (!notice || notice.resumeId !== resumeId) return null

  const first = notice.diagnostics[0]
  const message =
    first.kind === 'custom-fallback'
      ? `“${first.title}”未匹配内置分节，已按自定义分节保留，内容未丢失。`
      : `“${first.title}”已从${SECTION_TYPE_LABELS[first.fromType ?? 'custom']}识别为${SECTION_TYPE_LABELS[first.toType]}${first.toType === 'custom' ? '，内容已完整保留' : ''}。`
  const extra = notice.diagnostics.length - 1

  return (
    <div
      className="flex items-center gap-2 border-b border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--panel-2))] px-3 py-2 text-[11px] text-[var(--fg-dim)]"
      role="status"
      aria-live="polite"
    >
      <Info size={14} className="shrink-0 text-[var(--accent)]" />
      <span className="min-w-0 flex-1 leading-5">
        {message}{extra > 0 ? ` 另有 ${extra} 处结构变化。` : ''}
      </span>
      <button
        type="button"
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[var(--ui-radius-sm)] px-2 font-medium text-[var(--accent)] hover:bg-[var(--hover)]"
        onClick={undoLastParse}
      >
        <RotateCcw size={11} /> 撤销解析
      </button>
      <button
        type="button"
        className="grid size-7 shrink-0 place-items-center rounded-[var(--ui-radius-sm)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]"
        title="关闭提示"
        aria-label="关闭解析提示"
        onClick={dismissParseNotice}
      >
        <X size={13} />
      </button>
    </div>
  )
}
