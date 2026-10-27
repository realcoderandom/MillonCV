import { useLayoutEffect, useRef, type RefObject } from 'react'

/** 碰撞检测使用最终布局位置，不使用动画途中正在移动的矩形。 */
export function moduleLayoutRect(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const transform = getComputedStyle(element).transform
  const matrix = transform === 'none' ? null : new DOMMatrixReadOnly(transform)
  const motionX = matrix?.m41 ?? 0
  const motionY = matrix?.m42 ?? 0
  return { left: rect.left - motionX, top: rect.top - motionY, width: rect.width, height: rect.height, motionX, motionY }
}

// FLIP 只改变视觉位移，不在动画期间挤压高度或改变命中区域。
export function useModuleListMotion(rootRef: RefObject<HTMLElement>, layoutKey: string, enabled: boolean, resetKey: string, landingId?: string) {
  const previous = useRef(new Map<string, { left: number; top: number }>())
  const animations = useRef(new Map<string, Animation>())
  const previousReset = useRef(resetKey)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const rootRect = root.getBoundingClientRect()
    const next = new Map<string, { left: number; top: number }>()
    const animate = enabled && previousReset.current === resetKey && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    for (const element of root.querySelectorAll<HTMLElement>('[data-module-motion]')) {
      const key = element.dataset.moduleMotion!
      const rect = moduleLayoutRect(element)
      const position = { left: rect.left - rootRect.left + root.scrollLeft, top: rect.top - rootRect.top + root.scrollTop }
      const before = previous.current.get(key)
      next.set(key, position)
      animations.current.get(key)?.cancel()
      animations.current.delete(key)
      if (!animate || !before || element.hasAttribute('data-module-placeholder') || element.dataset.moduleId === landingId) continue
      const x = before.left + rect.motionX - position.left
      const y = before.top + rect.motionY - position.top
      if (Math.abs(x) < .5 && Math.abs(y) < .5) continue
      const animation = element.animate([{ transform: `translate3d(${x}px,${y}px,0)` }, { transform: 'translate3d(0,0,0)' }], { duration: 200, easing: 'cubic-bezier(.2,.75,.25,1)' })
      animations.current.set(key, animation)
      const release = () => { if (animations.current.get(key) === animation) animations.current.delete(key) }
      void animation.finished.then(release, release)
    }
    for (const [key, animation] of animations.current) if (!next.has(key)) { animation.cancel(); animations.current.delete(key) }
    previous.current = next
    previousReset.current = resetKey
  }, [rootRef, layoutKey, enabled, resetKey, landingId])

  useLayoutEffect(() => () => {
    for (const animation of animations.current.values()) animation.cancel()
    animations.current.clear()
  }, [])
}
