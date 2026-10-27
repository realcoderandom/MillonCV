// 全局工具栏只承载文档、保存状态和文件操作，排版入口留在预览区。
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ArrowUpRight, Upload, FileDown, Sun, Moon, MoreHorizontal } from 'lucide-react'
import type { Resume } from '@/resume/model'
import { useResumeStore } from '@/state/useResumeStore'
import { downloadResumeMd, parseResumeMarkdown } from '@/resume/markdown/io'
import { ResumeSwitcher } from './ResumeSwitcher'
import { Button } from '@/shared/ui/Button'
import { Logo } from '@/shared/ui/Logo'
import { Popover } from '@/shared/ui/Popover'
import { SaveStatus } from './status/SaveStatus'
import type { PreviewLayoutStatus } from '@/preview/layout'
import { PrintExportDialog } from './PrintExportDialog'
import { flushActiveEditorDraft } from '@/state/editing/editorDraft'

export type EditMode = 'source' | 'rich' | 'modules'

interface Props {
  resume: Resume | null
  layoutStatus: PreviewLayoutStatus | null
  onExportPdf: (filename: string) => Promise<void> | void
}

export function Toolbar({ resume, layoutStatus, onExportPdf }: Props) {
  const importResume = useResumeStore((s) => s.importResume)
  const uiTheme = useResumeStore((s) => s.uiTheme)
  const setUiTheme = useResumeStore((s) => s.setUiTheme)
  const fileRef = useRef<HTMLInputElement>(null)
  const printTriggerRef = useRef<HTMLButtonElement>(null)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [importError, setImportError] = useState('')

  const exportMarkdown = () => {
    flushSync(flushActiveEditorDraft)
    const latest = useResumeStore.getState().resumes.find((candidate) => candidate.id === resume?.id)
    if (latest) downloadResumeMd(latest)
  }

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setImportError('')
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const imported = parseResumeMarkdown(String(reader.result))
        flushSync(flushActiveEditorDraft)
        importResume(imported)
      } catch (error) {
        setImportError(`导入失败：${(error as Error).message}`)
      }
    }
    reader.onerror = () => setImportError('文件读取失败，请重新选择 Markdown 文件。')
    reader.readAsText(file)
    event.target.value = ''
  }

  return (
    <>
      <header className="toolbar precision-toolbar" data-no-print>
        <div className="precision-brand" aria-label="MillonCV"><Logo size={23} /><span>MillonCV</span></div>
        <span className="toolbar-divider" />
        <ResumeSwitcher />
        {resume && <SaveStatus resume={resume} compact />}
        <span className="toolbar-spacer" />
        <div className="toolbar-file-actions">
          <button type="button" className="precision-quiet-button markdown-backup" disabled={!resume} onClick={exportMarkdown} title="导出当前简历正文为 Markdown"><FileDown size={15} /><span>备份 Markdown</span></button>
          <Popover align="right" contentRole="menu" ariaLabel="文件操作" trigger={<button type="button" className="precision-icon-button" aria-label="更多文件操作" title="更多文件操作"><MoreHorizontal size={16} /></button>}>
            <div className="file-menu">
              <button type="button" role="menuitem" disabled={!resume} onClick={exportMarkdown}><FileDown size={15} />导出 Markdown</button>
              <button type="button" role="menuitem" onClick={() => fileRef.current?.click()}><Upload size={15} />导入 Markdown</button>
            </div>
          </Popover>
          <button type="button" className="precision-icon-button" onClick={() => setUiTheme(uiTheme === 'dark' ? 'light' : 'dark')} title={uiTheme === 'dark' ? '切换浅色主题' : '切换深色主题'} aria-label={uiTheme === 'dark' ? '切换浅色主题' : '切换深色主题'}>{uiTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
          <Button ref={printTriggerRef} variant="primary" className="export-pdf-button" disabled={!resume} onClick={() => { flushSync(flushActiveEditorDraft); setPrintDialogOpen(true) }} title="检查后打开浏览器打印窗口" aria-label="导出 PDF"><ArrowUpRight size={16} /><span>导出 PDF</span></Button>
        </div>
        <input ref={fileRef} id="resume-markdown-import" name="resume-markdown-import" type="file" accept=".md,.markdown,text/markdown" hidden onChange={handleImportFile} />
      </header>
      {importError && <div className="app-notice" role="alert" data-no-print><span>{importError}</span><button type="button" onClick={() => setImportError('')}>关闭</button></div>}
      {printDialogOpen && resume && <PrintExportDialog resume={resume} layoutStatus={layoutStatus} onClose={() => setPrintDialogOpen(false)} onPrint={onExportPdf} restoreFocusRef={printTriggerRef} />}
    </>
  )
}
