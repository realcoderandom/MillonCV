// 源码模式：Markdown 文本编辑
// 结构化为主数据源：编辑后防抖(400ms)解析回 sections；用 skipSync 避免解析结果反向覆盖用户输入
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Resume } from '@/resume/model'
import { useResumeStore } from '@/state/useResumeStore'
import { createSourceDocument, parseSourceDocument, updateSourceDocument, type SourceDocument, type SourceSelection } from '@/resume/markdown/sourceDocument'
import { usePageExitDraftFlush } from '@/state/editing/editorDraft'
import { highlightSource } from '@/resume/markdown/highlightSource'

interface Props {
  resume: Resume
}

export function SourceEditor({ resume }: Props) {
  const commitParsedSections = useResumeStore((s) => s.commitParsedSections)
  const [source, setSource] = useState(() => createSourceDocument(resume.sections))
  const [isComposing, setIsComposing] = useState(false)
  const highlights = useMemo(() => highlightSource(source.text), [source.text])
  const dirtyRef = useRef(false) // 用户正在编辑，阻止外部同步覆盖
  const skipSyncRef = useRef(false) // 跳过本次 sections 变化的反向同步（由自身解析触发）
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 持有最新草稿与隐藏标识，切换模式和页面离开时也能同步提交最后一次输入。
  const resumeRef = useRef(resume)
  resumeRef.current = resume
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const sourceRef = useRef(source)
  const historyRef = useRef<SourceDocument[]>([source])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const syntaxViewportRef = useRef<HTMLDivElement>(null)
  const syntaxRef = useRef<HTMLPreElement>(null)
  const selectionRef = useRef<SourceSelection>()

  const syncViewport = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    if (syntaxViewportRef.current) {
      syntaxViewportRef.current.style.width = `${textarea.clientWidth}px`
      syntaxViewportRef.current.style.height = `${textarea.clientHeight}px`
    }
    if (syntaxRef.current) syntaxRef.current.style.transform = `translate3d(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px, 0)`
    if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = textarea.scrollTop
  }, [])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const observer = new ResizeObserver(syncViewport)
    observer.observe(textarea)
    syncViewport()
    return () => observer.disconnect()
  }, [syncViewport])

  useLayoutEffect(syncViewport, [source.text, syncViewport])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const captureSelection = () => {
      selectionRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd }
    }
    textarea.addEventListener('beforeinput', captureSelection)
    return () => textarea.removeEventListener('beforeinput', captureSelection)
  }, [])

  // 外部 sections 变化（WYSIWYG 编辑 / 切换简历）时同步到文本
  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false
      return
    }
    if (!dirtyRef.current) {
      const next = createSourceDocument(resume.sections)
      sourceRef.current = next
      historyRef.current = [next]
      setSource(next)
    }
  }, [resume.sections])

  // 切简历/卸载：清理残留防抖并 flush 旧 dirty 到旧简历（闭包 resume 为切走前的值）
  // cleanup 在切简历与卸载时均执行，确保 <400ms 的未 flush 输入不丢失
  useEffect(() => {
    const next = createSourceDocument(resume.sections)
    sourceRef.current = next
    historyRef.current = [next]
    setSource(next)
    dirtyRef.current = false
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      // ref 在输入事件内立即更新，不依赖下一次 render。
      if (dirtyRef.current) {
        const previous = resumeRef.current.id === resume.id ? resumeRef.current : resume
        const result = parseSourceDocument(sourceRef.current, previous.sections)
        commitParsedSections(resume.id, result.sections, result.diagnostics, previous.sections)
        dirtyRef.current = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume.id])

  // flush 用 resumeRef 取最新简历：防抖 fire 时写当前简历，避免闭包陈旧
  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!dirtyRef.current) return
    const cur = resumeRef.current
    const result = parseSourceDocument(sourceRef.current, cur.sections)
    sourceRef.current = result.document
    historyRef.current = [...historyRef.current.slice(-49), result.document]
    setSource(result.document)
    skipSyncRef.current = true
    commitParsedSections(cur.id, result.sections, result.diagnostics, cur.sections)
    dirtyRef.current = false
  }

  usePageExitDraftFlush(flush)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = updateSourceDocument(sourceRef.current, e.target.value, historyRef.current, selectionRef.current)
    selectionRef.current = undefined
    sourceRef.current = next
    historyRef.current = [...historyRef.current.slice(-49), next]
    setSource(next)
    dirtyRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, 400)
  }

  // Ctrl/Command + ] 缩进；保留 Tab 的原生焦点导航，避免键盘用户被困在编辑器中。
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== ']' || (!e.ctrlKey && !e.metaKey)) return
    e.preventDefault()
    const el = e.currentTarget
    const s = el.selectionStart
    const en = el.selectionEnd
    const indent = '  '
    const next = el.value.slice(0, s) + indent + el.value.slice(en)
    const document = updateSourceDocument(sourceRef.current, next, historyRef.current, { start: s, end: en })
    sourceRef.current = document
    historyRef.current = [...historyRef.current.slice(-49), document]
    setSource(document)
    dirtyRef.current = true
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = s + indent.length
    })
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, 400)
  }

  return (
    <div className="source-editor-shell">
      <span id="source-editor-help" className="sr-only">Markdown 简历源码编辑器。内容会自动保存。按 Control 或 Command 加右方括号插入两个空格，按 Tab 移动到下一个控件。</span>
      <div className="source-line-numbers" ref={lineNumbersRef} aria-hidden="true">{source.text.split('\n').map((_, index) => index + 1).join('\n')}</div>
      <div className="source-editor-stage" data-composing={isComposing || undefined}>
        <div className="source-syntax-viewport" ref={syntaxViewportRef} aria-hidden="true">
          <pre className="source-syntax" ref={syntaxRef}>{highlights.map((token, index) =>
            <span key={index} className={`source-token-${token.syntax}`}>{token.text}</span>,
          )}</pre>
        </div>
        <textarea
          ref={textareaRef}
          aria-label="Markdown 简历源码"
          aria-describedby="source-editor-help"
          className="source-editor"
          value={source.text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={syncViewport}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          spellCheck={false}
          wrap="off"
          placeholder="# 姓名&#10;## 工作经历&#10;### 公司 — 职位 *2021.06 - 至今*"
        />
      </div>
    </div>
  )
}
