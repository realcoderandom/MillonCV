import { useEffect, useRef } from 'react'
import { flushResumeStorage } from '../useResumeStore'
import { flushDraftAndStorage } from './draftFlushProtocol'

const FLUSH_EDITOR_DRAFT = 'resume-maker:flush-editor-draft'

/** 照片等外部内容更新前先提交当前编辑器草稿。 */
export function flushActiveEditorDraft() {
  window.dispatchEvent(new Event(FLUSH_EDITOR_DRAFT))
}

/** 在刷新、关闭标签页及页面进入后台时同步保存最后一次输入。 */
export function usePageExitDraftFlush(flushDraft: () => void) {
  const flushRef = useRef(flushDraft)
  flushRef.current = flushDraft

  useEffect(() => {
    const flush = () =>
      flushDraftAndStorage(() => flushRef.current(), flushResumeStorage)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    window.addEventListener('pagehide', flush)
    window.addEventListener(FLUSH_EDITOR_DRAFT, flush)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener(FLUSH_EDITOR_DRAFT, flush)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
}
