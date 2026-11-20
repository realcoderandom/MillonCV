import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

export type ItemDropEdge = 'before' | 'after'

export interface ItemDropTarget {
  id: string
  edge: ItemDropEdge
}

interface DragSession {
  id: string
  label: string
  pointerId: number
  capture: HTMLElement
  startX: number
  startY: number
  x: number
  y: number
  active: boolean
  width: number
}

interface Options {
  itemAttribute: 'data-resume-item' | 'data-resume-project'
  onPlace: (id: string, targetId: string, edge: ItemDropEdge) => void
  onMove: (id: string, direction: -1 | 1) => void
}

/** 列表条目与子项目共用的指针拖拽 + 键盘方向键排序 Hook。 */
export function useItemDrag({ itemAttribute, onPlace, onMove }: Options) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragSession | null>(null)
  const dropRef = useRef<ItemDropTarget | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragLabel, setDragLabel] = useState('')
  const [dragWidth, setDragWidth] = useState(240)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dropTarget, setDropTarget] = useState<ItemDropTarget | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const updateDrop = useCallback((clientX: number, clientY: number, draggedId: string) => {
    const container = containerRef.current
    if (!container) return
    const bounds = container.getBoundingClientRect()
    let next: ItemDropTarget | null = null
    if (clientX >= bounds.left - 32 && clientX <= bounds.right + 32 && clientY >= bounds.top - 24 && clientY <= bounds.bottom + 24) {
      const cards = Array.from(container.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement && child.hasAttribute(itemAttribute) && child.getAttribute(itemAttribute) !== draggedId,
      )
      for (const card of cards) {
        const rect = card.getBoundingClientRect()
        if (clientY < rect.top + rect.height / 2) {
          next = { id: card.getAttribute(itemAttribute)!, edge: 'before' }
          break
        }
      }
      if (!next && cards.length > 0) {
        next = { id: cards[cards.length - 1].getAttribute(itemAttribute)!, edge: 'after' }
      }
    }
    dropRef.current = next
    setDropTarget((prev) => (prev?.id === next?.id && prev?.edge === next?.edge ? prev : next))
  }, [itemAttribute])

  const restoreFocus = useCallback((id: string) => {
    requestAnimationFrame(() => {
      document.getElementById(`module-item-drag-${id}`)?.focus({ preventScroll: true })
    })
  }, [])

  const finishDrag = useCallback((commit: boolean) => {
    const drag = dragRef.current
    if (!drag) return
    const destination = dropRef.current
    dragRef.current = null
    dropRef.current = null
    setDraggingId(null)
    setDropTarget(null)
    if (drag.capture.hasPointerCapture(drag.pointerId)) {
      drag.capture.releasePointerCapture(drag.pointerId)
    }
    if (commit && drag.active && destination) {
      onPlace(drag.id, destination.id, destination.edge)
      setAnnouncement(`${drag.label}已调整顺序`)
    }
    if (drag.active) restoreFocus(drag.id)
  }, [onPlace, restoreFocus])

  useEffect(() => {
    if (!draggingId) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      finishDrag(false)
    }
    const onCancel = () => finishDrag(false)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('blur', onCancel)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('blur', onCancel)
    }
  }, [draggingId, finishDrag])

  const startDrag = useCallback((event: PointerEvent<HTMLButtonElement>, id: string, label: string) => {
    const capture = containerRef.current
    const card = event.currentTarget.closest<HTMLElement>(`[${itemAttribute}]`)
    if (event.button !== 0 || !capture || !card) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.focus({ preventScroll: true })
    capture.setPointerCapture(event.pointerId)
    const width = Math.min(320, Math.max(180, card.getBoundingClientRect().width))
    dragRef.current = {
      id,
      label,
      pointerId: event.pointerId,
      capture,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
      width,
    }
    setDragLabel(label)
    setDragWidth(width)
  }, [itemAttribute])

  const moveDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    drag.x = event.clientX
    drag.y = event.clientY
    if (!drag.active && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 5) return
    event.preventDefault()
    drag.active = true
    setDraggingId(drag.id)
    setPosition({
      x: Math.max(8, Math.min(drag.x + 12, window.innerWidth - drag.width - 8)),
      y: Math.max(8, Math.min(drag.y + 10, window.innerHeight - 44)),
    })
    updateDrop(drag.x, drag.y, drag.id)
  }, [updateDrop])

  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) finishDrag(true)
  }, [finishDrag])

  const onPointerCancel = useCallback((event: PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) finishDrag(false)
  }, [finishDrag])

  const onLostPointerCapture = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && dragRef.current?.pointerId === event.pointerId) finishDrag(false)
  }, [finishDrag])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, id: string, label: string) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    onMove(id, event.key === 'ArrowUp' ? -1 : 1)
    setAnnouncement(`${label}已${event.key === 'ArrowUp' ? '上移' : '下移'}`)
    restoreFocus(id)
  }, [onMove, restoreFocus])

  return {
    containerRef,
    draggingId,
    dragLabel,
    dragWidth,
    position,
    dropTarget,
    announcement,
    startDrag,
    handleKeyDown,
    containerHandlers: {
      onPointerMove: moveDrag,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
    },
  }
}
