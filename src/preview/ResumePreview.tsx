// 模板仍以结构化数据渲染；分页结果同时用于屏幕预览和 Chrome 打印。
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Resume } from '@/resume/model'
import { themeStyle } from '@/templates/rendering'
import { useResumeStore } from '@/state/useResumeStore'
import { getTemplate } from '@/templates/registry'
import { loadDocumentFont } from './fonts'
import { resolveResumeTheme } from '@/templates/theme'
import { clampSidebarWidth, orderSections } from '@/resume/layout'
import { findResumeTarget, readResumeTarget, resolveResumeTarget, scrollToResumeTarget, type ResumeFocusRequest, type ResumeTarget } from '@/resume/focus'
import { compressedTheme, decideOnePageCompression, ONE_PAGE_MIN_SCALE, type PreviewLayoutStatus } from './layout'
import { collectResumeStyles, createPaginationFrame, PAGE_WIDTH, ResumePaginator } from './pagination/resumePagination'
import { trackResumePagination } from './pagination/paginationReady'
import { PAGINATION_DEBOUNCE_MS, PaginationQueue } from './pagination/paginationQueue'

interface Props {
  resume: Resume
  rootRef?: RefObject<HTMLDivElement>
  onLayoutStatus?: (status: PreviewLayoutStatus) => void
  activeTarget?: ResumeTarget | null
  focusRequest?: ResumeFocusRequest | null
  onEditTarget?: (target: ResumeTarget) => void
  onClearHighlight?: () => void
}

export function ResumePreview({ resume, rootRef, onLayoutStatus, activeTarget = null, focusRequest, onEditTarget, onClearHighlight }: Props) {
  const { id: resumeId, template: templateId, theme: documentTheme, templateThemeOverrides, sections, layout } = resume
  const theme = useMemo(() => resolveResumeTheme({ template: templateId, theme: documentTheme, templateThemeOverrides }), [templateId, documentTheme, templateThemeOverrides])
  const paginationInput = useMemo(() => ({ resumeId, templateId, sections, layout, theme }), [resumeId, templateId, sections, layout, theme])
  const { Body, sidebar } = getTemplate(templateId)
  const orderedSections = useMemo(() => orderSections(resume.sections, resume.layout?.order), [resume.sections, resume.layout?.order])
  const autoOnePage = useResumeStore((state) => state.autoOnePage)
  const sourceRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const paginatorRef = useRef<ResumePaginator | null>(null)
  const printRootRef = useRef<HTMLDivElement | null>(null)
  const printStylesRef = useRef<HTMLStyleElement | null>(null)
  const [queue] = useState(() => new PaginationQueue())
  const previousJobRef = useRef({ key: '', frameVersion: 0 })
  const compressionRef = useRef({ key: '', value: 1 })
  const latestRef = useRef({ resume, activeTarget, onEditTarget, onClearHighlight })
  latestRef.current = { resume, activeTarget, onEditTarget, onClearHighlight }
  const [frameVersion, setFrameVersion] = useState(0)
  const [layoutVersion, setLayoutVersion] = useState(0)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState('')
  const [scale, setScale] = useState(1)
  const frameSource = useMemo(createPaginationFrame, [])

  // 打印快照挂在应用根节点之外，浏览器菜单打印与导出按钮都使用它。
  useLayoutEffect(() => {
    const root = document.createElement('div')
    root.id = 'resume-print-root'
    const styles = document.createElement('style')
    styles.media = 'print'
    styles.dataset.resumePrintStyles = ''
    document.body.append(root)
    document.head.append(styles)
    printRootRef.current = root
    printStylesRef.current = styles
    if (rootRef) (rootRef as React.MutableRefObject<HTMLDivElement | null>).current = root
    return () => {
      if (rootRef) (rootRef as React.MutableRefObject<HTMLDivElement | null>).current = null
      printRootRef.current = null
      root.remove()
      styles.remove()
      const paginator = paginatorRef.current
      queue.clear()
      void queue.whenIdle().then(() => paginator?.destroy()).catch(() => {})
    }
  }, [rootRef, queue])

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const container = wrap?.parentElement
    if (!wrap || !container) return
    const measure = () => {
      const style = getComputedStyle(container)
      const width = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      if (width > 0) setScale(Math.min(1, width / PAGE_WIDTH))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const source = sourceRef.current
    const frame = frameRef.current
    const printRoot = printRootRef.current
    const printStyles = printStylesRef.current
    if (!source || !frame || !printRoot || !printStyles || !frameVersion) return
    let canceled = false
    setPending(true)
    setError('')
    const { resumeId, templateId, theme } = paginationInput
    const original = { fontSize: theme.fontSize, lineHeight: theme.lineHeight, margin: theme.margin }
    onLayoutStatus?.({ resumeId, pageCount: 1, rawPageCount: 1, result: autoOnePage ? 'fits' : 'off', compressionPercent: 0, original, rendered: original, pending: true })

    // 合并过期输入，串行执行，避免旧分页覆盖新文档或多个分页器争用样式。
    const key = `${resumeId}:${templateId}`
    const immediate = previousJobRef.current.key !== key || previousJobRef.current.frameVersion !== frameVersion
    previousJobRef.current = { key, frameVersion }
    const task = queue.schedule(async () => {
      if (canceled) return
      await loadDocumentFont(theme.fontFamily)
      await Promise.all(Array.from(source.querySelectorAll('img'), (image) => image.decode().catch(() => {})))
      await document.fonts.ready
      if (canceled) return
      const paginator = paginatorRef.current ?? new ResumePaginator(frame)
      paginatorRef.current = paginator
      const styles = collectResumeStyles(document)
      const snapshot = source.cloneNode(true) as HTMLDivElement
      const rawRatio = source.scrollHeight / (source.getBoundingClientRect().width * 297 / 210)
      const rawPageCount = await paginator.paginate(snapshot, styles)
      if (canceled) return
      const decision = decideOnePageCompression(Math.max(rawRatio, rawPageCount > 1 ? 1.001 : 0), autoOnePage, compressionRef.current.key === key ? compressionRef.current.value : 1)
      let compression = decision.compression
      let result = decision.result
      let pageCount = rawPageCount
      let rendered = theme
      if (compression < 1) {
        // 实际分页仍超一页时继续有限次收紧；下限内放不下就保留原字号和多页。
        while (true) {
          rendered = compressedTheme(theme, compression)
          for (const [name, value] of Object.entries(themeStyle(rendered))) snapshot.style.setProperty(name, String(value))
          pageCount = await paginator.paginate(snapshot, styles)
          if (canceled) return
          if (pageCount === 1 || compression <= ONE_PAGE_MIN_SCALE) break
          compression = Math.max(ONE_PAGE_MIN_SCALE, +(compression - .025).toFixed(3))
        }
        if (pageCount > 1) {
          compression = 1
          result = 'overflow'
          rendered = theme
          for (const [name, value] of Object.entries(themeStyle(theme))) snapshot.style.setProperty(name, String(value))
          pageCount = await paginator.paginate(snapshot, styles)
          if (canceled) return
        }
      }
      compressionRef.current = { key, value: compression }
      paginator.publish(printRoot, printStyles)
      onLayoutStatus?.({ resumeId, pageCount, rawPageCount, result, compressionPercent: Math.round((1 - compression) * 100), original, rendered: { fontSize: rendered.fontSize, lineHeight: rendered.lineHeight, margin: rendered.margin }, pending: false })
      setPending(false)
      setLayoutVersion((version) => version + 1)
    }, immediate ? 0 : PAGINATION_DEBOUNCE_MS)
    const job = task.promise.catch((cause: unknown) => {
      if (canceled) return
      console.error('简历分页失败', cause)
      const message = cause instanceof Error ? cause.message : '分页失败，请刷新页面重试。'
      printRoot.dataset.paginationError = message
      onLayoutStatus?.({ resumeId, pageCount: 1, rawPageCount: 1, result: 'off', compressionPercent: 0, original, rendered: original, error: message })
      setError(message)
      setPending(false)
      throw cause
    })
    trackResumePagination(printRoot, job, task.flush)
    void job.catch(() => {})
    return () => { canceled = true; task.cancel() }
  }, [paginationInput, autoOnePage, frameVersion, onLayoutStatus, queue])

  // 分页克隆保留 data-resume-*，通过文档事件委托延续点击与键盘定位。
  useEffect(() => {
    const frame = frameRef.current
    const frameDocument = frame?.contentDocument
    if (!frameDocument || !frameVersion) return
    const edit = (element: Element) => {
      const { resume, onEditTarget } = latestRef.current
      const root = paginatorRef.current?.root
      if (!root) return
      const requested = readResumeTarget(element, root, resume.id)
      const target = resolveResumeTarget(resume, requested)
      if (target) onEditTarget?.(target)
    }
    const click = (event: MouseEvent) => {
      const element = event.target as Element
      if (!element.closest('[data-resume-field]')) { latestRef.current.onClearHighlight?.(); return }
      const link = element.closest<HTMLAnchorElement>('a[href]')
      if (link) {
        // 正文链接不能把分页 iframe 导航到其他网站。
        event.preventDefault()
        window.open(link.href, '_blank', 'noopener,noreferrer')
        return
      }
      if (element.closest('button') || !frame.contentWindow?.getSelection()?.isCollapsed) return
      edit(element)
    }
    const keydown = (event: KeyboardEvent) => {
      const element = event.target as Element
      if (event.key === 'Enter' && element.matches('[data-resume-section], [data-resume-item], [data-resume-project]')) {
        event.preventDefault()
        edit(element)
      }
    }
    frameDocument.addEventListener('click', click)
    frameDocument.addEventListener('keydown', keydown)
    return () => {
      frameDocument.removeEventListener('click', click)
      frameDocument.removeEventListener('keydown', keydown)
    }
  }, [frameVersion])

  useEffect(() => {
    const root = paginatorRef.current?.root
    const target = resolveResumeTarget(resume, activeTarget)
    if (!root || !target) return
    const element = findResumeTarget(root, target)
    element?.setAttribute('data-resume-highlight', '')
    return () => element?.removeAttribute('data-resume-highlight')
  }, [resume, activeTarget, layoutVersion])

  useEffect(() => {
    const root = paginatorRef.current?.root
    const container = wrapRef.current?.parentElement
    const target = focusRequest && resolveResumeTarget(latestRef.current.resume, focusRequest.target)
    if (!root || !container || !target) return
    const element = findResumeTarget(root, target)
    if (element) scrollToResumeTarget(container, element)
  }, [focusRequest, layoutVersion])

  const style = { ...themeStyle(theme), '--sidebar-width': sidebar ? `${clampSidebarWidth(resume.layout?.sidebarWidth ?? sidebar.defaultWidth)}%` : undefined }
  return <>
    <div className="resume-measure" aria-hidden="true" {...{ inert: '' }} data-no-print>
      <div ref={sourceRef} className={`resume ${resume.template}`} style={style}><Body sections={orderedSections} layout={resume.layout} /></div>
    </div>
    {(pending || error) && <div className="pagination-message" role={error ? 'alert' : 'status'}>{error || '正在计算分页…'}</div>}
    <div className="resume-page-wrap" ref={wrapRef} style={{ zoom: scale }}>
      <iframe ref={frameRef} className="resume-pages-frame" title="简历分页预览" srcDoc={frameSource} scrolling="no" onLoad={() => setFrameVersion((version) => version + 1)} />
    </div>
  </>
}
