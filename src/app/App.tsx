// 应用根：顶部工具栏 + 双栏工作区（编辑器 | 拖拽条 | 预览）
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { FilePlus, HardDrive } from 'lucide-react'
import { useResumeStore, useCurrentResume } from '@/state/useResumeStore'
import { createSampleResume } from '@/resume/sample'
import { exportResumeToPdf } from '@/preview/pdf'
import { Toolbar, type EditMode } from '@/workspace/Toolbar'
import { EditorToolbar } from '@/workspace/EditorToolbar'
import { ResizeHandle } from '@/workspace/ResizeHandle'
import { SourceEditor } from '@/editor/source/SourceEditor'
import { ResumePreview } from '@/preview/ResumePreview'
import { ErrorBoundary } from '@/preview/ErrorBoundary'
import { PreviewStatusBar, PreviewToolbar } from '@/workspace/PreviewToolbar'
import { Button } from '@/shared/ui/Button'
import { loadDocumentFont } from '@/preview/fonts'
import { PersistenceErrorBanner } from '@/workspace/status/PersistenceErrorBanner'
import { UndoDeleteToast } from '@/workspace/status/UndoDeleteToast'
import { ParseNoticeBanner } from '@/workspace/status/ParseNoticeBanner'
import type { PreviewLayoutStatus } from '@/preview/layout'
import { getSuggestedPdfFilename } from '@/preview/printReadiness'
import { resolveResumeTheme } from '@/templates/theme'
import { flushActiveEditorDraft } from '@/state/editing/editorDraft'
import { ContentDeleteToast } from '@/workspace/status/ContentDeleteToast'
import { StorageRecovery } from '@/workspace/status/StorageRecovery'
import { useResumeHydrationState } from '@/state/storage/resumeHydration'
import type { ContentUndo } from '@/resume/commands'
import { resolveResumeTarget, type ResumeFocusRequest, type ResumeTarget } from '@/resume/focus'

const RichEditor = lazy(() =>
  import('@/editor/rich/RichEditor').then((module) => ({ default: module.RichEditor })),
)
const ModularEditor = lazy(() =>
  import('@/editor/modules/ModularEditor').then((module) => ({ default: module.ModularEditor })),
)

export default function App() {
  const hydration = useResumeHydrationState()
  const importResume = useResumeStore((s) => s.importResume)
  const createResume = useResumeStore((s) => s.createResume)
  const editorRatio = useResumeStore((s) => s.editorRatio)
  const setEditorRatio = useResumeStore((s) => s.setEditorRatio)
  const uiTheme = useResumeStore((s) => s.uiTheme)
  const current = useCurrentResume()
  const [mode, setMode] = useState<EditMode>('modules')
  const [contentUndo, setContentUndo] = useState<ContentUndo | null>(null)
  const closeContentUndo = useCallback(() => setContentUndo(null), [])
  const changeMode = (next: EditMode) => {
    // 在下一编辑器读取 sections 前完成提交，避免靠卸载 cleanup 与挂载顺序碰运气。
    flushSync(flushActiveEditorDraft)
    setMode(next)
  }
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')
  const [activeTarget, setActiveTarget] = useState<ResumeTarget | null>(null)
  const [previewHighlight, setPreviewHighlight] = useState<ResumeTarget | null>(null)
  // 编辑位置与短暂的定位提示分开保存，取消提示后仍可定位回原字段。
  const highlightTarget = useCallback((target: ResumeTarget) => {
    setActiveTarget(target)
    setPreviewHighlight(target)
  }, [])
  const [editorFocusRequest, setEditorFocusRequest] = useState<ResumeFocusRequest | null>(null)
  const [previewFocusRequest, setPreviewFocusRequest] = useState<ResumeFocusRequest | null>(null)
  const focusSequence = useRef(0)
  const lastEditorControl = useRef<HTMLElement | null>(null)
  const [isCompact, setIsCompact] = useState(() => window.matchMedia('(max-width: 620px)').matches)
  const [previewLayout, setPreviewLayout] = useState<PreviewLayoutStatus | null>(null)
  const resumeRef = useRef<HTMLDivElement>(null)
  const handleLayoutStatus = useCallback((status: PreviewLayoutStatus) => {
    setPreviewLayout((previous) => {
      if (previous && JSON.stringify(previous) === JSON.stringify(status)) return previous
      return status
    })
  }, [])

  // 同步 UI 主题到根元素 data-ui-theme，驱动深/浅 CSS 变量切换
  useEffect(() => {
    document.documentElement.dataset.uiTheme = uiTheme
  }, [uiTheme])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 620px)')
    const update = () => setIsCompact(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!previewHighlight) return
    if (previewHighlight.resumeId !== current?.id) {
      setPreviewHighlight(null)
      return
    }
    const timeout = window.setTimeout(() => setPreviewHighlight(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [previewHighlight, current?.id])

  const currentFont = current ? resolveResumeTheme(current).fontFamily : undefined
  useEffect(() => {
    if (!currentFont) return
    void loadDocumentFont(currentFont)
  }, [currentFont])

  // 首次使用（无数据）注入示例简历；ref 防 StrictMode 双调用
  const initedRef = useRef(false)
  useEffect(() => {
    if (hydration.status !== 'ready') return
    if (initedRef.current) return
    initedRef.current = true
    if (useResumeStore.getState().resumes.length === 0) {
      importResume(createSampleResume())
    }
  }, [hydration.status, importResume])

  const handleExportPdf = async (filename?: string) => {
    flushSync(flushActiveEditorDraft)
    if (!resumeRef.current || !current) return
    try {
      await exportResumeToPdf(
        resumeRef.current,
        filename || `${getSuggestedPdfFilename(current)}.pdf`,
      )
    } catch (e) {
      alert(`PDF 导出失败：${(e as Error).message}`)
    }
  }

  const locatePreview = () => {
    flushSync(flushActiveEditorDraft)
    const latest = useResumeStore.getState().resumes.find((resume) => resume.id === current?.id)
    if (!latest) return
    const target = resolveResumeTarget(latest, activeTarget) ?? (latest.sections[0] ? { resumeId: latest.id, sectionId: latest.sections[0].id } : null)
    if (target) {
      highlightTarget(target)
      setPreviewFocusRequest({ target, sequence: ++focusSequence.current })
    }
    setMobileView('preview')
  }

  const locateEditor = (requested: ResumeTarget) => {
    // 从文档或源码模式返回表单之前，同样先提交尚未完成防抖的输入。
    flushSync(flushActiveEditorDraft)
    const latest = useResumeStore.getState().resumes.find((resume) => resume.id === current?.id)
    const target = latest && resolveResumeTarget(latest, requested)
    if (!target) return
    highlightTarget(target)
    setEditorFocusRequest({ target, sequence: ++focusSequence.current })
    setMode('modules')
    setMobileView('edit')
  }

  const editorToolbar = (controls?: ReactNode) => <EditorToolbar mode={mode} onModeChange={changeMode} onPreview={locatePreview}>{controls}</EditorToolbar>
  const returnToEditor = () => {
    setMobileView('edit')
    requestAnimationFrame(() => {
      const control = lastEditorControl.current
      if (control?.isConnected && !control.closest('[hidden]')) control.focus({ preventScroll: true })
    })
  }

  if (hydration.status !== 'ready') return <StorageRecovery state={hydration} />

  return (
    <div className="app precision-app" data-mobile-view={mobileView} data-editor-mode={mode}>
      <a className="skip-to-editor" href="#workspace">跳到简历编辑区</a>
      <Toolbar resume={current} layoutStatus={previewLayout} onExportPdf={handleExportPdf} />
      <PersistenceErrorBanner resume={current} />
      <main id="workspace" className="workspace" tabIndex={-1}>
        {current ? (
          <>
            <section
              className="editor-pane"
              aria-label="内容编辑"
              style={{ flex: `0 0 ${editorRatio * 100}%` }}
              onFocusCapture={(event) => {
                if (event.target.matches('input, textarea, [contenteditable="true"]')) lastEditorControl.current = event.target
              }}
              {...(isCompact && mobileView === 'preview' ? { inert: '' } : {})}
              aria-hidden={isCompact && mobileView === 'preview' ? true : undefined}
            >
              {mode !== 'modules' && editorToolbar()}
              <ParseNoticeBanner resumeId={current.id} />
              {mode === 'source' ? (
                <SourceEditor key={current.id} resume={current} />
              ) : (
                <Suspense fallback={<div className="editor-loading">正在加载编辑器…</div>}>
                  {mode === 'modules'
                    ? <ModularEditor key={current.id} resume={current} isMobile={isCompact} onRemove={setContentUndo} renderToolbar={editorToolbar} onTargetChange={highlightTarget} focusRequest={editorFocusRequest} />
                    : <RichEditor key={current.id} resume={current} />}
                </Suspense>
              )}
              <footer className="editor-status-bar">
                <span><HardDrive size={12} />仅保存在当前浏览器</span>
                <span>{current.sections.filter((section) => section.type !== 'basics').length} 个内容章节</span>
              </footer>
            </section>
            <ResizeHandle ratio={editorRatio} onRatioChange={setEditorRatio} disabled={isCompact} />
            <section
              className="preview-pane"
              aria-label="简历实时预览"
              {...(isCompact && mobileView === 'edit' ? { inert: '' } : {})}
              aria-hidden={isCompact && mobileView === 'edit' ? true : undefined}
            >
              <PreviewToolbar resume={current} layoutStatus={previewLayout} onEdit={returnToEditor} />
              <div className="preview-scroll" onClick={(event) => {
                if (!(event.target as Element).closest('[data-resume-field]')) setPreviewHighlight(null)
              }}>
                <ErrorBoundary sections={current.sections}>
                  <ResumePreview resume={current} rootRef={resumeRef} onLayoutStatus={handleLayoutStatus} activeTarget={previewHighlight} focusRequest={previewFocusRequest} onEditTarget={locateEditor} onClearHighlight={() => setPreviewHighlight(null)} />
                </ErrorBoundary>
              </div>
              <PreviewStatusBar resume={current} layoutStatus={previewLayout} />
            </section>
          </>
        ) : (
          <div className="empty-workspace">
            <FilePlus size={32} strokeWidth={1.3} />
            <h1>开始一份新的简历</h1>
            <p>新建简历，或从顶部文件菜单导入 Markdown。</p>
            <Button variant="primary" onClick={() => createResume('姓名-目标岗位')}>新建简历</Button>
          </div>
        )}
      </main>
      <UndoDeleteToast />
      <ContentDeleteToast undo={contentUndo} onClose={closeContentUndo} />
    </div>
  )
}
