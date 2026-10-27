import { useEffect, useRef, useState, type RefObject } from 'react'
import { AlertTriangle, CheckCircle2, FileText, Printer, X } from 'lucide-react'
import type { Resume } from '@/resume/model'
import type { PreviewLayoutStatus } from '@/preview/layout'
import { getPrintReadiness } from '@/preview/printReadiness'
import { loadDocumentFont } from '@/preview/fonts'
import { flushResumePagination } from '@/preview/pagination/paginationReady'
import { resolveResumeTheme } from '@/templates/theme'
import { Button } from '@/shared/ui/Button'
import { useModalFocus } from '@/shared/hooks/useModalFocus'

interface Props {
  resume: Resume
  layoutStatus: PreviewLayoutStatus | null
  onClose: () => void
  onPrint: (filename: string) => Promise<void> | void
  restoreFocusRef: RefObject<HTMLButtonElement | null>
}

export function PrintExportDialog({ resume, layoutStatus, onClose, onPrint, restoreFocusRef }: Props) {
  const readiness = getPrintReadiness(resume, layoutStatus)
  const [fontState, setFontState] = useState<'checking' | 'ready' | 'failed'>('checking')
  const [printing, setPrinting] = useState(false)
  const [filename, setFilename] = useState(readiness.suggestedFilename)
  const printButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const missingName = readiness.issues.includes('missing-name')
  const layoutPending = readiness.issues.includes('layout-pending')
  const layoutFailed = readiness.issues.includes('layout-failed')
  const unsafeOverflow = readiness.issues.includes('unsafe-overflow')
  const fontFamily = resolveResumeTheme(resume).fontFamily

  useEffect(() => {
    flushResumePagination(document.getElementById('resume-print-root'))
  }, [])

  useEffect(() => {
    let active = true
    void loadDocumentFont(fontFamily)
      .then(({ ready }) => {
        if (active) setFontState(ready ? 'ready' : 'failed')
      })
      .catch(() => {
        if (active) setFontState('failed')
      })
    return () => { active = false }
  }, [fontFamily])

  useModalFocus({ containerRef: dialogRef, initialFocusRef: printButtonRef, restoreFocusRef, onClose })

  const handlePrint = async () => {
    setPrinting(true)
    try {
      await onPrint(`${filename.trim() || readiness.suggestedFilename}.pdf`)
      onClose()
    } finally {
      setPrinting(false)
    }
  }

  const checkRow = (
    ok: boolean,
    label: string,
    detail: string,
    pending = false,
  ) => (
    <div className="grid grid-cols-[18px_1fr] gap-x-2 py-1.5">
      {pending ? (
        <span className="mt-[3px] h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--accent)]" aria-hidden="true" />
      ) : ok ? (
        <CheckCircle2 size={15} className="mt-0.5 text-[var(--accent)]" aria-hidden="true" />
      ) : (
        <AlertTriangle size={15} className="mt-0.5 text-[var(--danger)]" aria-hidden="true" />
      )}
      <div>
        <div className="text-[12px] text-[var(--fg)]">{label}</div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--muted)]">{detail}</div>
      </div>
    </div>
  )

  return (
    <div
      data-no-print
      className="ui-dialog-backdrop fixed inset-0 z-[70] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div ref={dialogRef} tabIndex={-1} className="print-dialog-panel ui-dialog-panel w-full max-w-[480px] overflow-hidden border border-[var(--border)] bg-[var(--panel-raised)] shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 id="print-dialog-title" className="flex items-center gap-2 text-[18px] font-medium text-[var(--fg)]">
              <Printer size={16} /> 打印 / 导出 PDF
            </h2>
            <p className="mt-1 text-[11px] text-[var(--muted)]">接下来会打开浏览器打印窗口，选择“另存为 PDF”即可保存。</p>
          </div>
          <button
            type="button"
            aria-label="关闭打印检查"
            onClick={onClose}
            className="ui-icon-button h-8 w-8 shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-[var(--muted)]">
            <FileText size={13} /> 交付检查
          </div>
          <div aria-live="polite">
            {checkRow(
              !layoutPending && !layoutFailed,
              layoutFailed ? '分页失败' : layoutPending ? '正在计算页数' : `当前 ${readiness.pageCount} 页`,
              layoutFailed ? '请关闭检查面板并刷新页面后重试，系统不会打印旧的分页结果。' : unsafeOverflow
                ? '内容超过智能一页的安全压缩范围，仍可按多页打印。'
                : '预览与打印使用同一份分页结果，请保持 A4 和 100% 缩放。',
              layoutPending,
            )}
            {checkRow(
              fontState === 'ready',
              fontState === 'checking' ? '正在检查字体' : fontState === 'ready' ? '字体已就绪' : '字体加载失败',
              fontState === 'failed' ? '将使用系统备用字体，换行可能与当前预览略有差异。' : '打印前已等待当前文档字体完成加载。',
              fontState === 'checking',
            )}
            {checkRow(
              !missingName,
              missingName ? '正文姓名为空' : `候选人：${readiness.candidateName}`,
              missingName ? '建议先补充姓名，避免导出一份无法识别归属的简历。' : '姓名来自简历正文，不是顶部的版本名称。',
            )}
            {checkRow(
              true,
              `版本名称：${resume.name}`,
              '版本名称只用于管理不同岗位版本，不会出现在简历正文中。',
            )}
            {unsafeOverflow && checkRow(
              false,
              '未进行强制压缩',
              '系统保留了可读字号；可继续打印多页，或返回精简内容。',
            )}
          </div>

          <div className="mt-3 border-t border-[var(--border)] pt-4">
            <label htmlFor="pdf-filename" className="text-[11px] font-medium text-[var(--fg-dim)]">PDF 文件名</label>
            <div className="print-filename-field mt-2 flex min-h-9 items-center rounded-[var(--ui-radius-md)] border border-[var(--border-strong)] bg-[var(--panel)] focus-within:border-[var(--ui-accent)]">
              <input
                id="pdf-filename"
                value={filename}
                onChange={(event) => setFilename(event.target.value)}
                className="min-w-0 flex-1 border-none bg-transparent px-2.5 text-[12px] text-[var(--fg)] outline-none"
              />
              <span className="border-l border-[var(--border)] px-2.5 font-mono text-[11px] text-[var(--muted)]">.pdf</span>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--muted)]">
              默认取自正文姓名与职位；浏览器可能采用此名称，请在保存窗口中再次确认。
            </p>
          </div>

          <div className="mt-3 border-t border-[var(--border)] pt-4">
            <div className="text-[11px] font-medium text-[var(--fg-dim)]">打印窗口建议设置</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
              <div className="rounded-[var(--ui-radius-sm)] border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-2 text-[var(--muted)]"><span className="block text-[var(--fg)]">目标打印机</span>另存为 PDF</div>
              <div className="rounded-[var(--ui-radius-sm)] border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-2 text-[var(--muted)]"><span className="block text-[var(--fg)]">缩放</span>100%</div>
              <div className="rounded-[var(--ui-radius-sm)] border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-2 text-[var(--muted)]"><span className="block text-[var(--fg)]">页眉和页脚</span>关闭</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--panel-2)] px-5 py-3">
          <Button type="button" onClick={onClose}>取消</Button>
          <button
            ref={printButtonRef}
            type="button"
            onClick={() => void handlePrint()}
            disabled={printing || fontState === 'checking' || layoutPending || layoutFailed}
            className="ui-button ui-button-primary disabled:cursor-wait"
          >
            <Printer size={14} /> {printing ? '正在打开…' : '打开打印窗口'}
          </button>
        </div>
      </div>
    </div>
  )
}
