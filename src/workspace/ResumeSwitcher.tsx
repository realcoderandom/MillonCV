// 当前文档作为简历管理入口，集中保留切换、新建、复制、重命名与删除操作。
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { flushActiveEditorDraft } from '@/state/editing/editorDraft'
import { Plus, Copy, Trash2, Pencil, Check, X, FileText, ChevronDown } from 'lucide-react'
import { useResumeStore } from '@/state/useResumeStore'
import { Popover } from '@/shared/ui/Popover'

function ResumeSwitcherMenu() {
  const resumes = useResumeStore((s) => s.resumes)
  const currentId = useResumeStore((s) => s.currentId)
  const setCurrent = useResumeStore((s) => s.setCurrent)
  const createResume = useResumeStore((s) => s.createResume)
  const duplicateResume = useResumeStore((s) => s.duplicateResume)
  const removeResume = useResumeStore((s) => s.removeResume)
  const renameResume = useResumeStore((s) => s.renameResume)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const renameFormRef = useRef<HTMLFormElement>(null)
  const selectRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    if (renamingId) renameFormRef.current?.scrollIntoView({ block: 'nearest' })
  }, [renamingId])

  const finishRename = (save: boolean) => {
    const targetId = renamingId
    if (save && targetId && draftName.trim()) renameResume(targetId, draftName.trim())
    setRenamingId(null)
    if (targetId) {
      requestAnimationFrame(() => selectRefs.current.get(targetId)?.focus())
    }
  }

  return (
    <div className="resume-menu">
      <div className="resume-menu-heading">
        <strong>我的简历</strong>
        <span>{resumes.length} 份</span>
      </div>
      <div className="resume-list" aria-label="简历列表">
        {resumes.length === 0 ? (
          <p className="resume-list-empty">暂无简历，点击下方新建。</p>
        ) : (
          resumes.map((resume) => {
            const isCurrent = resume.id === currentId
            if (renamingId === resume.id) {
              return (
                <form
                  ref={renameFormRef}
                  key={resume.id}
                  className="resume-list-item is-renaming"
                  data-active={isCurrent || undefined}
                  onSubmit={(event) => {
                    event.preventDefault()
                    finishRename(true)
                  }}
                >
                  <div className="resume-rename-row">
                    <input
                      id="resume-name-input"
                      name="resume-name"
                      aria-label="简历名称"
                      placeholder="输入简历名称"
                      autoFocus
                      value={draftName}
                      onFocus={(event) => event.currentTarget.select()}
                      onChange={(event) => setDraftName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing) {
                          if (event.key === 'Enter') event.preventDefault()
                          return
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          event.stopPropagation()
                          event.nativeEvent.stopPropagation()
                          finishRename(false)
                        }
                      }}
                    />
                    <button type="submit" className="resume-item-action" aria-label="确认简历名称" title="确认">
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      className="resume-item-action"
                      aria-label="取消重命名"
                      title="取消"
                      onClick={() => finishRename(false)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="resume-rename-hint">仅用于区分简历，不会显示在正文中</p>
                </form>
              )
            }

            return (
              <div key={resume.id} className="resume-list-item" data-active={isCurrent || undefined}>
                <button
                  ref={(el) => {
                    if (el) selectRefs.current.set(resume.id, el)
                    else selectRefs.current.delete(resume.id)
                  }}
                  type="button"
                  className="resume-item-select"
                  aria-current={isCurrent ? 'true' : undefined}
                  data-popover-close
                  data-popover-autofocus={isCurrent ? '' : undefined}
                  title={resume.name}
                  onClick={() => {
                    flushSync(flushActiveEditorDraft)
                    setRenamingId(null)
                    setCurrent(resume.id)
                  }}
                >
                  {isCurrent ? (
                    <Check size={14} className="resume-item-icon is-active" aria-hidden="true" />
                  ) : (
                    <FileText size={14} className="resume-item-icon" aria-hidden="true" />
                  )}
                  <span>{resume.name}</span>
                </button>
                <div className="resume-item-actions">
                  <button
                    type="button"
                    className="resume-item-action"
                    aria-label={`重命名：${resume.name}`}
                    title="重命名"
                    onClick={() => {
                      setDraftName(resume.name)
                      setRenamingId(resume.id)
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    className="resume-item-action"
                    aria-label={`复制：${resume.name}`}
                    title="复制"
                    onClick={() => {
                      flushSync(flushActiveEditorDraft)
                      setRenamingId(null)
                      duplicateResume(resume.id)
                    }}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    className="resume-item-action is-danger"
                    aria-label={`删除：${resume.name}`}
                    title="删除"
                    onClick={() => {
                      if (confirm(`确定删除「${resume.name}」？删除后 8 秒内可以撤销。`)) {
                        flushSync(flushActiveEditorDraft)
                        setRenamingId(null)
                        removeResume(resume.id)
                      }
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
      <div className="resume-menu-footer">
        <button
          type="button"
          className="resume-new"
          onClick={() => {
            flushSync(flushActiveEditorDraft)
            const id = createResume('姓名-目标岗位')
            setDraftName('姓名-目标岗位')
            setRenamingId(id)
          }}
        >
          <Plus size={15} />
          新建简历
        </button>
      </div>
    </div>
  )
}

export function ResumeSwitcher() {
  const resumes = useResumeStore((s) => s.resumes)
  const currentId = useResumeStore((s) => s.currentId)
  const current = resumes.find((resume) => resume.id === currentId)

  return (
    <div className="document-switcher">
      <Popover
        ariaLabel="我的简历"
        trigger={
          <button type="button" className="document-trigger" aria-label={`当前简历：${current?.name ?? '未选择'}`}>
            <FileText size={15} />
            <span>{current?.name ?? '选择或新建简历'}</span>
            <ChevronDown size={12} />
          </button>
        }
      >
        <ResumeSwitcherMenu />
      </Popover>
    </div>
  )
}
