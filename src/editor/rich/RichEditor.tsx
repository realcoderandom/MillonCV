// 富文本模式：Tiptap WYSIWYG，整份简历作为一个 Markdown 文档
// 与 SourceEditor 同构：编辑后防抖(400ms)取 getMarkdown() → parse 回 sections；用 skipSync 避免反向覆盖
// 支持 GFM 排版与约定的证件照/子项目语法；新增编辑能力须能被 parse 无损还原
import { useEffect, useRef } from 'react'
import { Extension, useEditor, EditorContent, useEditorState } from '@tiptap/react'
import { inputRules, wrappingInputRule } from '@tiptap/pm/inputrules'
import { ResumeStarterKit } from './ResumeStarterKit'
import { Markdown } from 'tiptap-markdown'
import type { Editor } from '@tiptap/react'
import { Bold, Italic, Code, List, ListOrdered, IndentIncrease, IndentDecrease, Quote, Link2, Undo2, Redo2, MoreHorizontal, ListTree, type LucideIcon } from 'lucide-react'
import { Popover } from '@/shared/ui/Popover'
import type { Resume } from '@/resume/model'
import { useResumeStore } from '@/state/useResumeStore'
import { serializeSections } from '@/resume/markdown/serialize'
import { inferSectionType, parseMarkdownWithDiagnostics } from '@/resume/markdown/parse'
import { usePageExitDraftFlush } from '@/state/editing/editorDraft'
import { SUBPROJECT_PREFIX } from '@/resume/markdown/syntax'
import { ResumePhotoNode } from './ResumePhotoNode'
import { parseHeadingMetadata } from '@/resume/markdown/metadata'

// tiptap-markdown 0.9.0 的 storage.markdown 类型未自动并入 Editor，统一在此断言取值
function getMarkdown(ed: Editor): string {
  return (ed.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown()
}

// 行首 `>` 触发 blockquote：行首加粗文字前输入 `>` 时，strong mark 的 inclusive 行为会向前扩展
// 把 `>` 包裹成 `**>...**`（加粗语法跑到 `>` 前、加粗失效）。StarterKit 的 blockquote inputRule
// 仅匹配 `> `（带空格），`>` 不带空格时落入文本被 strong 吞噬。补一条 `>` 即触发规则，与 `#`/`-`
// 行首 Markdown 语法一致：`>` 被消费转 blockquote，加粗保留为 `> **...**`
const BlockquoteMdInputRule = Extension.create({
  name: 'blockquoteMdInputRule',
  addProseMirrorPlugins() {
    return [
      inputRules({
        rules: [
          wrappingInputRule(/^\s*>$/, this.editor.schema.nodes.blockquote),
        ],
      }),
    ]
  },
})

interface Props {
  resume: Resume
}

// 工具栏命令定义：仅 MD 可无损表达的语法
type ToolCmd = 'undo' | 'redo' | 'paragraph' | 'bold' | 'italic' | 'code' | 'h1' | 'h2' | 'h3' | 'h4' | 'addSubproject' | 'bulletList' | 'orderedList' | 'indentList' | 'outdentList' | 'blockquote' | 'link'

interface ToolButton {
  cmd: ToolCmd
  label: string
  icon: LucideIcon
}

const PRIMARY_TOOLS: ToolButton[] = [
  { cmd: 'bold', label: '加粗', icon: Bold },
  { cmd: 'italic', label: '斜体', icon: Italic },
  { cmd: 'bulletList', label: '无序列表', icon: List },
  { cmd: 'orderedList', label: '有序列表', icon: ListOrdered },
  { cmd: 'link', label: '链接', icon: Link2 },
  { cmd: 'addSubproject', label: '添加子项目', icon: ListTree },
]
const MORE_TOOLS: ToolButton[] = [
  { cmd: 'code', label: '行内代码', icon: Code },
  { cmd: 'indentList', label: '列表降级（Tab）', icon: IndentIncrease },
  { cmd: 'outdentList', label: '列表升级（Shift+Tab）', icon: IndentDecrease },
  { cmd: 'blockquote', label: '引用', icon: Quote },
]

// 子项目只在有效条目下创建，插入到本公司最后、下一公司之前。
function currentItemEnd(editor: Editor): number | null {
  let sectionType = ''
  let itemStart = -1
  let itemEnd = editor.state.doc.content.size
  let foundEnd = false
  const { from } = editor.state.selection
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name !== 'heading') return
    const level = Number(node.attrs.level)
    if (offset <= from) {
      if (level <= 2) {
        const metadata = parseHeadingMetadata(String(node.attrs.resumeMetadata ?? ''))
        sectionType = level === 2
          ? metadata?.kind === 'section' ? metadata.type : inferSectionType(node.textContent)
          : 'basics'
        itemStart = -1
      }
      if (level === 3) itemStart = offset
    } else if (!foundEnd && level <= 3) {
      itemEnd = offset
      foundEnd = true
    }
  })
  return itemStart >= 0 && ['experience', 'education', 'projects'].includes(sectionType) ? itemEnd : null
}

// 执行工具栏命令
function runCmd(editor: Editor, cmd: ToolCmd) {
  const chain = editor.chain().focus()
  switch (cmd) {
    case 'undo':
      chain.undo().run()
      break
    case 'redo':
      chain.redo().run()
      break
    case 'paragraph':
      chain.setParagraph().run()
      break
    case 'bold':
      chain.toggleBold().run()
      break
    case 'italic':
      chain.toggleItalic().run()
      break
    case 'code':
      chain.toggleCode().run()
      break
    case 'h1':
      chain.setHeading({ level: 1 }).run()
      break
    case 'h2':
      chain.setHeading({ level: 2 }).run()
      break
    case 'h3':
      chain.setHeading({ level: 3 }).run()
      break
    case 'h4':
      if (currentItemEnd(editor) === null) break
      chain.setHeading({ level: 4 }).command(({ tr }) => {
        if (!/^子项目[：:]/.test(tr.selection.$from.parent.textContent)) {
          tr.insertText(SUBPROJECT_PREFIX, tr.selection.$from.start())
        }
        return true
      }).run()
      break
    case 'addSubproject': {
      const end = currentItemEnd(editor)
      if (end === null) break
      chain.insertContentAt(end, [
        { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: `${SUBPROJECT_PREFIX}项目名称` }] },
        { type: 'paragraph' },
      ]).setTextSelection({ from: end + 1 + SUBPROJECT_PREFIX.length, to: end + 1 + SUBPROJECT_PREFIX.length + 4 }).run()
      break
    }
    case 'bulletList':
      chain.toggleBulletList().run()
      break
    case 'orderedList':
      chain.toggleOrderedList().run()
      break
    case 'indentList':
      chain.sinkListItem('listItem').run()
      break
    case 'outdentList':
      chain.liftListItem('listItem').run()
      break
    case 'blockquote':
      chain.toggleBlockquote().run()
      break
    case 'link': {
      const prev = editor.getAttributes('link').href as string | undefined
      const url = window.prompt('链接地址', prev ?? 'https://')
      if (url === null) return // 取消
      if (url === '') {
        chain.extendMarkRange('link').unsetLink().run()
      } else {
        chain.extendMarkRange('link').setLink({ href: url }).run()
      }
      break
    }
  }
}

export function RichEditor({ resume }: Props) {
  const commitParsedSections = useResumeStore((s) => s.commitParsedSections)
  const dirtyRef = useRef(false) // 用户正在编辑，阻止外部 sections 变化反向覆盖
  const skipSyncRef = useRef(false) // 跳过本次 sections 变化的反向同步（由自身 parse 触发）
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 每次输入立即保留原始 Markdown 草稿；结构化解析仍防抖，页面离开时同步 flush。
  const markdownRef = useRef(serializeSections(resume.sections))
  const flushRef = useRef<() => void>(() => {})
  // 持有最新 resume：onUpdate 闭包不随 render 更新（Tiptap editor 只 mount 一次），
  // 用 ref 取最新简历，避免防抖 fire 时写错简历（切简历后旧闭包 id 仍指向旧简历）
  const resumeRef = useRef(resume)
  resumeRef.current = resume

  const editor = useEditor({
    extensions: [
      // StarterKit 3.x 已内置 Link；禁用 codeBlock（MD 代码块简历少用，且避免与行内 code 混淆）
      ResumeStarterKit.configure({ codeBlock: false, link: { openOnClick: false } }),
      // breaks:false：getMarkdown 将 hard break(Shift+Enter) 输出为单 \n（非 GFM 的 "  \n"），
      // 配合 render.ts breaks:true 渲染为 <br>；单 \n 经 parse 保留于字段值，预览正确换行
      Markdown.configure({ breaks: false, tightLists: true, linkify: true }),
      ResumePhotoNode,
      BlockquoteMdInputRule,
    ],
    content: serializeSections(resume.sections),
    editorProps: {
      attributes: {
        class: 'rich-editor-prose',
        spellcheck: 'false',
        role: 'textbox',
        'aria-label': '富文本简历编辑器',
        'aria-describedby': 'rich-editor-help',
        'aria-multiline': 'true',
      },
    },
    // 编辑后防抖回写
    onUpdate: ({ editor: ed }) => {
      markdownRef.current = getMarkdown(ed)
      dirtyRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => flushRef.current(), 400)
    },
  })

  flushRef.current = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!dirtyRef.current) return
    const cur = resumeRef.current
    skipSyncRef.current = true
    const result = parseMarkdownWithDiagnostics(markdownRef.current, cur.sections)
    commitParsedSections(cur.id, result.sections, result.diagnostics, cur.sections)
    dirtyRef.current = false
  }

  usePageExitDraftFlush(() => flushRef.current())

  // 外部 sections 变化（source 编辑 / 切简历 / 自身 parse 回灌）时同步到编辑器
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (skipSyncRef.current) {
      skipSyncRef.current = false
      return
    }
    if (!dirtyRef.current) {
      // emitUpdate=false 避免触发 onUpdate 回写循环
      editor.commands.setContent(serializeSections(resume.sections), { emitUpdate: false })
    }
  }, [editor, resume.sections])

  // 切简历/卸载：清理残留防抖并 flush 旧 dirty 到旧简历（闭包 resume 为切走前的值）
  // cleanup 在切简历与卸载时均执行，故无需单独的卸载 effect
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const markdown = serializeSections(resume.sections)
    markdownRef.current = markdown
    editor.commands.setContent(markdown, { emitUpdate: false })
    dirtyRef.current = false
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      // 使用即时保存的 Markdown 草稿，不依赖卸载顺序中的 Tiptap 实例是否已销毁。
      if (dirtyRef.current) {
        const previous = resumeRef.current.id === resume.id ? resumeRef.current : resume
        const result = parseMarkdownWithDiagnostics(markdownRef.current, previous.sections)
        commitParsedSections(
          resume.id,
          result.sections,
          result.diagnostics,
          previous.sections,
        )
        dirtyRef.current = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, resume.id])

  // 订阅激活态，仅在工具栏状态变化时重渲染（避免每次按键全组件重渲染）
  const active = useEditorState({
    editor,
    selector: () => {
      // 订阅快照在实例重建后可能尚未更新，始终使用当前渲染的实例。
      const ed = editor
      if (!ed || ed.isDestroyed) return null
      return {
        undo: false,
        redo: false,
        canUndo: ed.can().undo(),
        canRedo: ed.can().redo(),
        paragraph: ed.isActive('paragraph'),
        bold: ed.isActive('bold'),
        italic: ed.isActive('italic'),
        code: ed.isActive('code'),
        h1: ed.isActive('heading', { level: 1 }),
        h2: ed.isActive('heading', { level: 2 }),
        h3: ed.isActive('heading', { level: 3 }),
        h4: ed.isActive('heading', { level: 4 }),
        addSubproject: false,
        canAddSubproject: currentItemEnd(ed) !== null,
        bulletList: ed.isActive('bulletList'),
        orderedList: ed.isActive('orderedList'),
        indentList: false,
        outdentList: false,
        blockquote: ed.isActive('blockquote'),
        link: ed.isActive('link'),
      }
    },
  })

  if (!editor || !active) return <div className="rich-editor-shell editor-loading">正在加载编辑器…</div>

  const renderTool = (tool: ToolButton, menu = false) => (
    <button
      key={tool.cmd}
      type="button"
      role={menu ? 'menuitemcheckbox' : undefined}
      className={menu ? 'rich-menu-tool' : 'rich-tool-button'}
      title={tool.label}
      aria-label={tool.label}
      aria-pressed={menu ? undefined : active[tool.cmd]}
      aria-checked={menu ? active[tool.cmd] : undefined}
      disabled={tool.cmd === 'addSubproject' && !active.canAddSubproject}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => runCmd(editor, tool.cmd)}
    >
      <tool.icon size={15} strokeWidth={1.75} />
      {menu && <span>{tool.label}</span>}
    </button>
  )

  return (
    <div className="rich-editor-shell">
      <span id="rich-editor-help" className="sr-only">富文本简历编辑器。内容会自动保存；可使用排版工具或常用键盘快捷键编辑内容。</span>
      <div role="toolbar" aria-label="富文本排版工具" className="rich-format-toolbar">
        <button type="button" className="rich-tool-button" disabled={!active.canUndo} title="撤销" aria-label="撤销" onMouseDown={(event) => event.preventDefault()} onClick={() => runCmd(editor, 'undo')}><Undo2 size={15} /></button>
        <button type="button" className="rich-tool-button" disabled={!active.canRedo} title="重做" aria-label="重做" onMouseDown={(event) => event.preventDefault()} onClick={() => runCmd(editor, 'redo')}><Redo2 size={15} /></button>
        <span className="rich-tool-divider" />
        <select
          className="rich-heading-select"
          aria-label="段落样式"
          value={active.h1 ? 'h1' : active.h2 ? 'h2' : active.h3 ? 'h3' : active.h4 ? 'h4' : 'paragraph'}
          onChange={(event) => runCmd(editor, event.target.value as ToolCmd)}
        >
          <option value="paragraph">正文</option><option value="h1">姓名标题</option><option value="h2">章节标题</option><option value="h3">条目标题</option>
          <option value="h4" disabled={!active.canAddSubproject}>子项目标题</option>
        </select>
        <span className="rich-tool-divider" />
        {PRIMARY_TOOLS.map((tool) => renderTool(tool))}
        <Popover contentRole="menu" ariaLabel="更多文字格式" trigger={<button type="button" className="rich-tool-button" aria-label="更多文字格式" title="更多文字格式" onMouseDown={(event) => event.preventDefault()}><MoreHorizontal size={16} /></button>}>
          <div className="rich-format-menu">{MORE_TOOLS.map((tool) => renderTool(tool, true))}</div>
        </Popover>
      </div>
      <div className="rich-editor-scroll"><EditorContent editor={editor} className="rich-editor-wrap" /></div>
    </div>
  )
}
