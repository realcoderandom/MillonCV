import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hidden
      && !element.closest('[aria-hidden="true"]')
      && element.getClientRects().length > 0,
  )
}

interface ModalFocusOptions {
  active?: boolean
  containerRef: RefObject<HTMLElement | null>
  initialFocusRef?: RefObject<HTMLElement | null>
  restoreFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
}

/** 模态弹窗统一焦点协议：进入弹窗、锁定 Tab、Esc 关闭、卸载后恢复原焦点。 */
export function useModalFocus({ active = true, containerRef, initialFocusRef, restoreFocusRef, onClose }: ModalFocusOptions) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const restoreFocus = restoreFocusRef?.current ?? previousFocus
    const frame = requestAnimationFrame(() => {
      const focusables = focusableElements(container)
      const initial = initialFocusRef?.current
      const target = initial && focusables.includes(initial) ? initial : focusables[0] ?? container
      target.focus()
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusables = focusableElements(container)
      if (focusables.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      requestAnimationFrame(() => restoreFocus?.focus())
    }
  }, [active, containerRef, initialFocusRef, restoreFocusRef])
}
