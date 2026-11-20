import { memo, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { AlignHorizontalSpaceBetween, ArrowLeft, Bold, Code2, Italic, Link2, List, ListOrdered, MoreHorizontal, Undo2, Redo2, Unlink, X } from 'lucide-react'
import { Popover } from '@/shared/ui/Popover'
import type { ResumeField } from '@/resume/focus'
import { moveFocusBetweenFields } from './ModuleField'
import { normalizeLinkHref } from './formHelpers'

interface Props {
  label: string
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  hint?: string
  field: ResumeField
}

function markdown(editor: Editor): string {
  return (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown()
}

// 字段直接写回结构化数据，不等待防抖；回显自己的修改时不重置光标或撤销历史。
export const MarkdownField = memo(function MarkdownField({ label, value, onChange, field, placeholder = '填写内容…', hint = '支持加粗、列表和链接。' }: Props) {
  const labelId = useId()
  const [source, setSource] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkText, setLinkText] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [hasActiveLink, setHasActiveLink] = useState(false)
  const sourceRef = useRef<HTMLTextAreaElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const lastValue = useRef(value)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, horizontalRule: false, link: { openOnClick: false } }),
      Markdown.configure({ breaks: false, tightLists: true, linkify: false }),
    ],
    content: value,
    editorProps: {
      attributes: { role: 'textbox', 'aria-label': label, 'aria-describedby': `${labelId}-hint`, 'aria-multiline': 'true', class: 'module-field-prose', 'data-placeholder': placeholder, spellcheck: 'false' },
      handleKeyDown: (view, event) => {
        if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229 || !(event.metaKey || event.ctrlKey) || event.altKey) return false
        if (!moveFocusBetweenFields(view.dom as HTMLElement, event.shiftKey ? -1 : 1)) return false
        event.preventDefault()
        return true
      },
    },
    onUpdate: ({ editor: active }) => {
      lastValue.current = markdown(active)
      onChangeRef.current(lastValue.current)
    },
  })
  useEffect(() => {
    if (!editor || editor.isDestroyed || value === lastValue.current) return
    lastValue.current = value
    editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  useLayoutEffect(() => {
    if (!source) return
    const textarea = sourceRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(112, textarea.scrollHeight)}px`
  }, [source, value])

  const active = useEditorState({ editor, selector: () => {
    // 订阅快照在实例重建后可能尚未更新，始终使用当前渲染的实例。
    const current = editor
    if (!current || current.isDestroyed) return null
    return {
      bold: current.isActive('bold'), italic: current.isActive('italic'), bullet: current.isActive('bulletList'), ordered: current.isActive('orderedList'), link: current.isActive('link'),
      canUndo: current.can().undo(), canRedo: current.can().redo(),
      empty: current.isEmpty,
      characters: Array.from(current.getText().replace(/\s/g, '')).length,
    }
  } })

  const switchSource = () => {
    if (source && editor) {
      editor.commands.setContent(value, { emitUpdate: false })
      lastValue.current = value
    }
    setLinkOpen(false)
    setSource(!source)
    requestAnimationFrame(() => source ? editor?.commands.focus(undefined, { scrollIntoView: false }) : sourceRef.current?.focus({ preventScroll: true }))
  }

  const openLinkEditor = () => {
    if (!editor) return
    if (linkOpen) {
      setLinkOpen(false)
      return
    }
    const inLink = editor.isActive('link')
    if (inLink) editor.chain().extendMarkRange('link').run()
    const { from, to } = editor.state.selection
    setLinkText(editor.state.doc.textBetween(from, to, ' '))
    setLinkUrl(String(editor.getAttributes('link').href ?? ''))
    setHasActiveLink(inLink)
    setLinkOpen(true)
  }

  const applyLink = () => {
    if (!editor) return
    const href = normalizeLinkHref(linkUrl)
    const text = linkText.trim()
    if (!href) {
      editor.chain().focus(undefined, { scrollIntoView: false }).extendMarkRange('link').unsetLink().run()
      setLinkOpen(false)
      return
    }
    const { from, to } = editor.state.selection
    const selected = editor.state.doc.textBetween(from, to, ' ')
    if (from === to) {
      const labelText = text || linkUrl.trim()
      editor.chain().focus(undefined, { scrollIntoView: false }).insertContent({
        type: 'text',
        text: labelText,
        marks: [{ type: 'link', attrs: { href } }],
      }).run()
    } else if (text && text !== selected) {
      editor.chain().focus(undefined, { scrollIntoView: false }).extendMarkRange('link').insertContent({
        type: 'text',
        text,
        marks: [{ type: 'link', attrs: { href } }],
      }).run()
    } else {
      editor.chain().focus(undefined, { scrollIntoView: false }).extendMarkRange('link').setLink({ href }).run()
    }
    setLinkOpen(false)
  }

  const removeLink = () => {
    if (!editor) return
    editor.chain().focus(undefined, { scrollIntoView: false }).extendMarkRange('link').unsetLink().run()
    setLinkOpen(false)
  }

  const insertRowSplit = () => {
    if (!editor) return
    editor.chain().focus(undefined, { scrollIntoView: false }).insertContent('左侧内容 || 右侧内容').run()
  }

  const keepEditing = (command: () => void) => {
    command()
    requestAnimationFrame(() => editor?.commands.focus(undefined, { scrollIntoView: false }))
  }

  const characters = source ? Array.from(value.replace(/\s/g, '')).length : active?.characters ?? 0

  return (
    <div className="module-markdown-field" data-resume-field={field} data-source={source} data-can-undo={!source && Boolean(active?.canUndo)} data-can-redo={!source && Boolean(active?.canRedo)} onBlurCapture={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setLinkOpen(false)
    }}>
      <div className="module-field-label"><span id={labelId} title={label}>{label}</span></div>
      <div className="module-field-editor" data-empty={!source && active?.empty ? true : undefined}>
      <div className="module-editor-chrome">
        {!source && editor && active && <div className="module-field-toolbar" role="toolbar" aria-label={`${label}格式`}>
          <button type="button" tabIndex={-1} title="加粗" aria-label="加粗" aria-pressed={active.bold} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus(undefined, { scrollIntoView: false }).toggleBold().run()}><Bold size={15} /></button>
          <button type="button" tabIndex={-1} className="module-secondary-format" title="斜体" aria-label="斜体" aria-pressed={active.italic} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus(undefined, { scrollIntoView: false }).toggleItalic().run()}><Italic size={15} /></button>
          <button type="button" tabIndex={-1} title="无序列表" aria-label="无序列表" aria-pressed={active.bullet} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus(undefined, { scrollIntoView: false }).toggleBulletList().run()}><List size={15} /></button>
          <button type="button" tabIndex={-1} className="module-secondary-format" title="有序列表" aria-label="有序列表" aria-pressed={active.ordered} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus(undefined, { scrollIntoView: false }).toggleOrderedList().run()}><ListOrdered size={15} /></button>
          <button type="button" tabIndex={-1} title="链接" aria-label="链接" aria-pressed={active.link} aria-expanded={linkOpen} onMouseDown={(event) => event.preventDefault()} onClick={openLinkEditor}><Link2 size={15} /></button>
          <span className="module-format-divider" aria-hidden="true" />
          <Popover contentRole="menu" ariaLabel={`${label}更多格式`} trigger={<button type="button" tabIndex={-1} title="更多格式" aria-label="更多格式" onMouseDown={(event) => event.preventDefault()}><MoreHorizontal size={16} /></button>}>
            <div className="module-action-menu">
              <button type="button" role="menuitemcheckbox" aria-checked={active.italic} onClick={() => keepEditing(() => { editor.chain().focus(undefined, { scrollIntoView: false }).toggleItalic().run() })}><Italic size={14} />斜体</button>
              <button type="button" role="menuitemcheckbox" aria-checked={active.ordered} onClick={() => keepEditing(() => { editor.chain().focus(undefined, { scrollIntoView: false }).toggleOrderedList().run() })}><ListOrdered size={14} />有序列表</button>
              <button type="button" role="menuitem" onClick={() => keepEditing(insertRowSplit)}><AlignHorizontalSpaceBetween size={14} />插入左右对齐（||）</button>
              <button type="button" role="menuitem" disabled={!active.canUndo} onClick={() => keepEditing(() => { editor.chain().focus(undefined, { scrollIntoView: false }).undo().run() })}><Undo2 size={14} />撤销文字修改</button>
              <button type="button" role="menuitem" disabled={!active.canRedo} onClick={() => keepEditing(() => { editor.chain().focus(undefined, { scrollIntoView: false }).redo().run() })}><Redo2 size={14} />重做文字修改</button>
            </div>
          </Popover>
        </div>}
        {source && <span className="module-source-caption"><Code2 size={14} />Markdown</span>}
        <button type="button" tabIndex={-1} className="module-source-button" aria-label={source ? `${label}返回富文本` : `${label}编辑 Markdown`} title={source ? '返回富文本编辑' : '编辑 Markdown 源码'} onMouseDown={(event) => event.preventDefault()} onClick={switchSource}>{source ? <ArrowLeft size={14} /> : <Code2 size={14} />}<span>{source ? '返回富文本' : 'Markdown'}</span></button>
      </div>
        {linkOpen && editor && <form className="module-link-editor" aria-label={`${label}链接`} onSubmit={(event) => {
          event.preventDefault()
          applyLink()
        }} onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setLinkOpen(false)
            editor.commands.focus(undefined, { scrollIntoView: false })
          }
        }}>
          <div className="module-link-inputs">
            <label className="sr-only" htmlFor={`${labelId}-link-text`}>显示文字</label>
            <input id={`${labelId}-link-text`} value={linkText} onChange={(event) => setLinkText(event.target.value)} placeholder="显示文字（可选）" />
            <label className="sr-only" htmlFor={`${labelId}-link`}>链接地址</label>
            <input id={`${labelId}-link`} value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="粘贴链接地址，如 github.com/..." inputMode="url" autoFocus />
          </div>
          <div className="module-link-actions">
            <button type="submit">应用</button>
            {hasActiveLink && <button type="button" className="module-link-remove" aria-label="移除链接" title="移除链接" onClick={removeLink}><Unlink size={13} /><span>移除</span></button>}
            <button type="button" aria-label="取消链接编辑" onClick={() => { setLinkOpen(false); editor.commands.focus(undefined, { scrollIntoView: false }) }}><X size={14} /></button>
          </div>
        </form>}
        {source
          ? <textarea ref={sourceRef} className="module-field-source" aria-labelledby={labelId} aria-describedby={`${labelId}-hint`} placeholder={placeholder} spellCheck={false} value={value} onChange={(event) => { lastValue.current = event.target.value; onChangeRef.current(event.target.value) }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229 && (event.metaKey || event.ctrlKey) && !event.altKey && moveFocusBetweenFields(event.currentTarget, event.shiftKey ? -1 : 1)) event.preventDefault() }} />
          : <EditorContent editor={editor} />}
        <div className="module-field-footer"><span id={`${labelId}-hint`}>{source ? '支持 Markdown 与 || 左右对齐，返回富文本继续排版。' : hint}</span><span className="module-field-count">{characters} {source ? '字符' : '字'}</span></div>
      </div>
    </div>
  )
})
