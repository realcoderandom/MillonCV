// 通用轻量 Popover：trigger 触发，children 渲染为悬浮面板；外部点击 / Esc 关闭
// 无第三方依赖（KISS）；面板 absolute 定位，z-50 高于预览区
import { createPortal } from 'react-dom'
import {
  cloneElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { popoverPanelCls } from './classes'

interface Props {
  trigger: ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>
  children: ReactNode
  /** 面板相对触发容器的水平对齐，默认 left */
  align?: 'left' | 'right'
  contentRole?: 'dialog' | 'menu'
  ariaLabel: string
}

export function Popover({ trigger, children, align = 'left', contentRole = 'dialog', ariaLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null)
  const panelId = useId()
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const getTriggerButton = () => triggerRef.current?.querySelector<HTMLButtonElement>('button') ?? null

  // 浮层挂到 body，避开工具栏横向滚动容器的 overflow 裁切；
  // 同时根据可用空间决定向下或向上展开，窗口变化时保持贴合触发器。
  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null)
      return
    }

    const positionPanel = () => {
      const triggerEl = getTriggerButton() ?? triggerRef.current
      const panelEl = panelRef.current
      if (!triggerEl || !panelEl) return

      const triggerRect = triggerEl.getBoundingClientRect()
      const panelRect = panelEl.getBoundingClientRect()
      const toolbarRect = triggerEl.closest('.preview-toolbar')?.getBoundingClientRect()
      const viewportGap = 8
      const triggerGap = 6
      const anchorTop = Math.min(triggerRect.top, toolbarRect?.top ?? triggerRect.top)
      const anchorBottom = Math.max(triggerRect.bottom, toolbarRect?.bottom ?? triggerRect.bottom)
      const roomBelow = window.innerHeight - anchorBottom
      const openAbove = roomBelow < panelRect.height + triggerGap + viewportGap
        && anchorTop >= panelRect.height + triggerGap + viewportGap
      const top = openAbove
        ? anchorTop - panelRect.height - triggerGap
        : Math.min(anchorBottom + triggerGap, window.innerHeight - panelRect.height - viewportGap)
      const idealLeft = align === 'right'
        ? triggerRect.right - panelRect.width
        : triggerRect.left
      const left = Math.min(
        Math.max(viewportGap, idealLeft),
        Math.max(viewportGap, window.innerWidth - panelRect.width - viewportGap),
      )

      setPanelStyle({ top: Math.max(viewportGap, top), left })
    }

    positionPanel()
    const observer = new ResizeObserver(positionPanel)
    if (panelRef.current) observer.observe(panelRef.current)
    window.addEventListener('resize', positionPanel)
    window.addEventListener('scroll', positionPanel, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', positionPanel)
      window.removeEventListener('scroll', positionPanel, true)
    }
  }, [align, open])

  // 外部点击 / Esc 关闭面板（仅 open 时挂载监听，避免常驻开销）
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        getTriggerButton()?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>('[data-popover-autofocus]') ?? panelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )
      ;(firstFocusable ?? panelRef.current)?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  const originalOnClick = trigger.props.onClick
  const actualTrigger = cloneElement(trigger, {
    'aria-controls': open ? panelId : undefined,
    'aria-expanded': open,
    'aria-haspopup': contentRole,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      originalOnClick?.(event)
      if (!event.defaultPrevented) setOpen((value) => !value)
    },
  })

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (contentRole !== 'menu' || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])') ?? [],
    )
    if (items.length === 0) return
    event.preventDefault()
    const current = items.indexOf(document.activeElement as HTMLElement)
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
          ? (current + 1 + items.length) % items.length
          : (current - 1 + items.length) % items.length
    items[next].focus()
  }

  return (
    <div className="relative inline-flex" ref={triggerRef}>
      {actualTrigger}
      {open && createPortal(
        <div
          id={panelId}
          data-no-print
          ref={panelRef}
          role={contentRole}
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={handlePanelKeyDown}
          onClick={(event) => {
            if ((contentRole === 'menu' && (event.target as Element).closest('[role^="menuitem"]'))
              || (event.target as Element).closest('[data-popover-close]')) {
              setOpen(false)
              getTriggerButton()?.focus()
            }
          }}
          className={popoverPanelCls}
          style={panelStyle ?? { top: 0, left: 0, visibility: 'hidden' }}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  )
}
