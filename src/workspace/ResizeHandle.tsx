// 编辑区与预览区之间的可拖拽分隔条：调整编辑区占比并持久化
import { useCallback, useEffect, useRef } from 'react'

interface Props {
  ratio: number
  onRatioChange: (ratio: number) => void
  disabled?: boolean
}

export function ResizeHandle({ ratio, onRatioChange, disabled }: Props) {
  const dragging = useRef(false)
  const handleRef = useRef<HTMLDivElement>(null)

  const onMove = useCallback(
    (clientX: number) => {
      if (!dragging.current) return
      // 以工作区容器为基准计算编辑区占比
      const container = (handleRef.current?.parentElement) as HTMLElement | null
      if (!container) return
      const rect = container.getBoundingClientRect()
      const r = (clientX - rect.left) / rect.width
      onRatioChange(r)
    },
    [onRatioChange],
  )

  useEffect(() => {
    if (disabled) return
    const mouseMove = (e: MouseEvent) => onMove(e.clientX)
    const touchMove = (e: TouchEvent) => {
      if (e.touches[0]) onMove(e.touches[0].clientX)
    }
    const stop = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', mouseMove)
    window.addEventListener('mouseup', stop)
    window.addEventListener('touchmove', touchMove)
    window.addEventListener('touchend', stop)
    return () => {
      window.removeEventListener('mousemove', mouseMove)
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('touchmove', touchMove)
      window.removeEventListener('touchend', stop)
    }
  }, [onMove, disabled])

  const start = () => {
    if (disabled) return
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  if (disabled) return null
  return (
    <div
      ref={handleRef}
      className="resize-handle group flex flex-[0_0_5px] cursor-col-resize bg-[var(--border)] items-center justify-center relative transition-colors hover:bg-[var(--border-strong-hover)] active:bg-[var(--accent)]"
      onMouseDown={start}
      onTouchStart={start}
      title={`拖拽调整宽度（编辑区 ${Math.round(ratio * 100)}%，范围 33%~80%）`}
    >
      <div className="w-px h-[28px] bg-[var(--border-strong-hover)] group-hover:bg-[var(--fg-dim)]" />
    </div>
  )
}
