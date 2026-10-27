import { AlertCircle, Check, Clock3, History, RotateCcw } from 'lucide-react'
import type { Resume } from '@/resume/model'
import { usePersistenceState } from '@/state/storage/persistenceStatus'
import { useResumeStore, type ResumeSnapshot } from '@/state/useResumeStore'
import { Popover } from '@/shared/ui/Popover'
import { flushSync } from 'react-dom'
import { flushActiveEditorDraft } from '@/state/editing/editorDraft'

interface Props {
  resume: Resume
  compact?: boolean
}

const EMPTY_SNAPSHOTS: ResumeSnapshot[] = []

function formatTime(value: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value)
}

export function SaveStatus({ resume, compact = false }: Props) {
  const persistence = usePersistenceState()
  const snapshots = useResumeStore((s) => s.snapshots[resume.id] ?? EMPTY_SNAPSHOTS)
  const restoreSnapshot = useResumeStore((s) => s.restoreSnapshot)

  const savedAt = persistence.savedAt ?? resume.updatedAt
  const label =
    persistence.status === 'saving'
      ? '保存中…'
      : persistence.status === 'error'
        ? '保存失败'
        : `已保存 ${formatTime(savedAt)}`
  const Icon =
    persistence.status === 'saving'
      ? Clock3
      : persistence.status === 'error'
        ? AlertCircle
        : Check

  return (
    <div className="save-status flex items-center gap-1.5">
      <span
        className={`save-status-label inline-flex items-center gap-1 text-[11px] normal-case tracking-normal ${
          persistence.status === 'error'
            ? 'text-[var(--danger)]'
            : 'text-[var(--muted)]'
        }`}
        role="status"
        aria-live="polite"
        title={persistence.status === 'error' ? persistence.error : label}
      >
        <Icon size={12} className={persistence.status === 'saving' ? 'animate-pulse' : ''} />
        {compact && persistence.status !== 'saving' && persistence.status !== 'error' ? '已保存到本地' : label}
      </span>

      <Popover
        align="left"
        ariaLabel="自动快照"
        trigger={
          <button
            type="button"
            className="save-history-button inline-flex h-8 items-center gap-1 rounded-[var(--ui-radius-sm)] px-2 text-[11px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]"
            title="查看自动快照"
            aria-label="查看自动快照"
          >
            <History size={12} />
            <span className="save-history-label">历史 {snapshots.length > 0 ? snapshots.length : ''}</span>
          </button>
        }
      >
        <div className="w-[250px]">
          <div className="mb-2 text-[12px] font-medium text-[var(--fg)]">自动快照</div>
          <p className="mb-2 text-[11px] leading-5 text-[var(--muted)]">
            编辑内容时自动保留，最多保存最近 10 个版本。
          </p>
          {snapshots.length === 0 ? (
            <p className="py-2 text-[11px] text-[var(--muted)]">继续编辑后会生成第一个快照。</p>
          ) : (
            <div className="max-h-[240px] space-y-1 overflow-auto">
              {snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="flex items-center justify-between gap-3 rounded-[var(--ui-radius-sm)] px-2 py-1.5 hover:bg-[var(--hover)]"
                >
                  <span className="text-[11px] text-[var(--fg-dim)]">
                    {formatTime(snapshot.createdAt)}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1 rounded-[var(--ui-radius-sm)] px-2 text-[11px] text-[var(--accent)] hover:bg-[var(--panel-2)]"
                    onClick={() => {
                      if (confirm(`恢复到 ${formatTime(snapshot.createdAt)} 的版本？当前内容也会先生成快照。`)) {
                        flushSync(flushActiveEditorDraft)
                        restoreSnapshot(resume.id, snapshot.id)
                      }
                    }}
                  >
                    <RotateCcw size={11} /> 恢复
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Popover>
    </div>
  )
}
