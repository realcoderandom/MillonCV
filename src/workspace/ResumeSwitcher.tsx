// 当前文档作为版本入口，集中保留切换、新建、复制、命名与删除操作。
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { flushActiveEditorDraft } from '@/state/editing/editorDraft'
import { Plus, Copy, Trash2, Pencil, Check, FileText, ChevronDown } from 'lucide-react'
import { useResumeStore } from '@/state/useResumeStore'
import { Popover } from '@/shared/ui/Popover'

export function ResumeSwitcher() {
  const resumes = useResumeStore((s) => s.resumes)
  const currentId = useResumeStore((s) => s.currentId)
  const setCurrent = useResumeStore((s) => s.setCurrent)
  const createResume = useResumeStore((s) => s.createResume)
  const duplicateResume = useResumeStore((s) => s.duplicateResume)
  const removeResume = useResumeStore((s) => s.removeResume)
  const renameResume = useResumeStore((s) => s.renameResume)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const renameButtonRef = useRef<HTMLButtonElement>(null)
  const current = resumes.find((resume) => resume.id === currentId)

  const finishRename = (save: boolean) => {
    if (save && renamingId && draftName.trim()) renameResume(renamingId, draftName.trim())
    setRenamingId(null)
    requestAnimationFrame(() => renameButtonRef.current?.focus())
  }

  return (
    <div className="document-switcher">
      <Popover
        ariaLabel="简历版本管理"
        trigger={
          <button type="button" className="document-trigger" aria-label={`简历版本：${current?.name ?? '未选择'}`}>
            <FileText size={15} />
            <span>{current?.name ?? '选择或新建简历'}</span>
            <ChevronDown size={12} />
          </button>
        }
      >
        <div className="version-menu">
          <div className="version-menu-heading"><strong>简历版本</strong><span>{resumes.length} 个版本</span></div>
          <div className="version-list" aria-label="切换简历版本">
            {resumes.map((resume) => (
              <button
                type="button"
                key={resume.id}
                className="version-item"
                aria-pressed={resume.id === currentId}
                data-popover-close
                onClick={() => { flushSync(flushActiveEditorDraft); setRenamingId(null); setCurrent(resume.id) }}
              >
                <FileText size={16} />
                <span>{resume.name}</span>
                {resume.id === currentId && <Check size={14} />}
              </button>
            ))}
          </div>
          {current && (
            <div className="version-actions">
              {renamingId === current.id ? (
                <form className="version-rename" onSubmit={(event) => { event.preventDefault(); finishRename(true) }}>
                  <label htmlFor="resume-version-name">版本名称，不会显示在正文</label>
                  <div>
                    <input id="resume-version-name" name="resume-version-name" autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); finishRename(false) } }} />
                    <button type="submit" className="precision-icon-button" aria-label="确认版本名称"><Check size={16} /></button>
                  </div>
                </form>
              ) : (
                <button ref={renameButtonRef} type="button" className="version-action" onClick={() => { setDraftName(current.name); setRenamingId(current.id) }}><Pencil size={14} />重命名版本</button>
              )}
              <button type="button" className="version-action" onClick={() => { flushSync(flushActiveEditorDraft); setRenamingId(null); duplicateResume(current.id) }}><Copy size={14} />复制当前版本</button>
              <button type="button" className="version-action version-action-danger" onClick={() => { if (confirm(`确定删除「${current.name}」？删除后 8 秒内可以撤销。`)) { flushSync(flushActiveEditorDraft); setRenamingId(null); removeResume(current.id) } }}><Trash2 size={14} />删除当前版本</button>
            </div>
          )}
          <button type="button" className="version-new" onClick={() => { flushSync(flushActiveEditorDraft); const id = createResume('姓名-目标岗位'); setDraftName('姓名-目标岗位'); setRenamingId(id) }}><Plus size={15} />新建简历版本</button>
        </div>
      </Popover>
    </div>
  )
}
