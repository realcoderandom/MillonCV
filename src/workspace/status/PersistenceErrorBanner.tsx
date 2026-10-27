import { AlertTriangle, Download, RefreshCw } from 'lucide-react'
import type { Resume } from '@/resume/model'
import { usePersistenceState } from '@/state/storage/persistenceStatus'
import { retryResumeStorage } from '@/state/useResumeStore'
import { downloadResumeMd } from '@/resume/markdown/io'

interface Props {
  resume: Resume | null
}

export function PersistenceErrorBanner({ resume }: Props) {
  const persistence = usePersistenceState()
  if (persistence.status !== 'error') return null

  return (
    <div
      data-no-print
      className="flex flex-wrap items-center gap-2 border-b border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_12%,var(--panel))] px-4 py-2 text-[12px] text-[var(--fg)]"
      role="alert"
    >
      <AlertTriangle size={15} className="shrink-0 text-[var(--danger)]" />
      <span className="min-w-[240px] flex-1">
        无法保存到当前浏览器。请先导出 Markdown 备份，再检查隐私模式或浏览器存储空间。
      </span>
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1.5 rounded-[var(--ui-radius-sm)] border border-[var(--border-strong)] px-2.5 text-[var(--fg-dim)] hover:bg-[var(--hover)]"
        onClick={retryResumeStorage}
      >
        <RefreshCw size={13} /> 重试保存
      </button>
      <button
        type="button"
        disabled={!resume}
        className="inline-flex h-8 items-center gap-1.5 rounded-[var(--ui-radius-sm)] bg-[var(--ui-danger-fill)] px-2.5 text-white disabled:opacity-50"
        onClick={() => resume && downloadResumeMd(resume)}
      >
        <Download size={13} /> 导出当前内容
      </button>
    </div>
  )
}
