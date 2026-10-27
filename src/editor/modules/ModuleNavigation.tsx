import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Check, GripVertical, PanelLeftClose, PanelLeftOpen, Plus, Settings2, Undo2 } from 'lucide-react'
import type { Resume, Section, SectionRegion, SectionType } from '@/resume/model'
import { SECTION_TYPE_LABELS } from '@/resume/model'
import { clampSidebarWidth, MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, orderSections, placeLayoutSection, splitSections, type SectionPlacement } from '@/resume/layout'
import { DEFAULT_MODULE_NAVIGATION_WIDTH, MIN_MODULE_NAVIGATION_WIDTH, type ModuleNavigationMode } from '@/shared/layout/workspaceLayout'
import { getTemplate } from '@/templates/registry'
import { useResumeStore } from '@/state/useResumeStore'
import { Popover } from '@/shared/ui/Popover'
import { MODULE_CONFIG } from './moduleConfig'
import { moduleLayoutRect, useModuleListMotion } from './useModuleListMotion'

interface Props {
  resume: Resume
  sections: Section[]
  activeSectionId?: string
  id: string
  navigationRef: RefObject<HTMLElement>
  mode: ModuleNavigationMode
  width: number
  maximumWidth: number
  managing: boolean
  onToggleManaging: () => void
  onToggleCollapsed: () => void
  onSelect: (id: string) => void
  onPlace: (id: string, placement: SectionPlacement) => void
  onAdd: (type: SectionType) => void
  renderActions: (section: Section) => ReactNode
}

type DropTarget = SectionPlacement & { region: SectionRegion }
interface Drag {
  id: string
  pointerId: number
  capture: HTMLElement
  startX: number
  startY: number
  x: number
  y: number
  active: boolean
  width: number
  height: number
}

interface Landing { id: string; width: number; height: number }

export function ModuleNavigation({ resume, sections, activeSectionId, id, navigationRef, mode, width, maximumWidth, managing, onToggleManaging, onToggleCollapsed, onSelect, onPlace, onAdd, renderActions }: Props) {
  const setWidth = useResumeStore((s) => s.setModuleNavigationWidth)
  const setLayout = useResumeStore((s) => s.setLayout)
  const sidebar = getTemplate(resume.template).sidebar
  const groups = sidebar ? splitSections(sections, resume.layout, sidebar.defaultSectionTypes) : { main: sections, sidebar: [] }
  const regions: SectionRegion[] = sidebar ? ['main', 'sidebar'] : ['main']
  const navigationOrder = regions.flatMap((region) => groups[region])
  const sidebarWidth = clampSidebarWidth(resume.layout?.sidebarWidth ?? sidebar?.defaultWidth ?? 34)
  const helpId = useId()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [drop, setDrop] = useState<DropTarget | null>(null)
  const [visualDrop, setVisualDrop] = useState<DropTarget | null>(null)
  const [landing, setLanding] = useState<Landing | null>(null)
  const [dragSize, setDragSize] = useState({ width: 160, height: 43 })
  const [announcement, setAnnouncement] = useState('')
  const [resizing, setResizing] = useState(false)
  const dragRef = useRef<Drag | null>(null)
  const dropRef = useRef<DropTarget | null>(null)
  const resizeRef = useRef<{ x: number; width: number } | null>(null)
  const cancelRef = useRef(() => {})
  const ghostRef = useRef<HTMLDivElement>(null)
  const keyboardMotion = useRef(false)
  const visualDropRef = useRef<DropTarget | null>(null)

  const previewGroups = (sectionId: string, destination: DropTarget) => {
    const preview = placeLayoutSection(sections, resume.layout, sectionId, { ...destination, region: sidebar ? destination.region : undefined })
    return sidebar ? splitSections(sections, preview, sidebar.defaultSectionTypes) : { main: orderSections(sections, preview?.order), sidebar: [] }
  }
  const displayGroups = draggingId && visualDrop ? previewGroups(draggingId, visualDrop) : groups
  const layoutKey = `${regions.map((region) => `${region}:${displayGroups[region].map((section) => section.id).join(',')}`).join('|')}:${draggingId ?? ''}:${managing}`
  useModuleListMotion(navigationRef, layoutKey, Boolean(draggingId || landing || keyboardMotion.current), `${mode}:${width}`, landing?.id)
  useLayoutEffect(() => { keyboardMotion.current = false }, [layoutKey])

  const updateDrop = useCallback((x: number, y: number, draggedId: string) => {
    const nav = navigationRef.current
    const directory = nav?.querySelector<HTMLElement>('.module-directory')
    const bounds = directory?.getBoundingClientRect()
    let next: DropTarget | null = null
    if (directory && bounds && x >= bounds.left && x <= bounds.right && y >= bounds.top - 8 && y <= bounds.bottom + 8) {
      // 使用布局几何选择分组，避免动画中的行越界后命中错误分栏。
      const candidates = Array.from(directory.querySelectorAll<HTMLElement>('[data-module-region]'))
      const group = candidates.sort((a, b) => {
        const distance = (element: HTMLElement) => { const r = element.getBoundingClientRect(); return Math.max(r.top - y, 0, y - r.bottom) }
        return distance(a) - distance(b)
      })[0]
      if (group) {
        const region = group.dataset.moduleRegion as SectionRegion
        const placeholder = group.querySelector<HTMLElement>('[data-module-placeholder]')
        const slot = placeholder && moduleLayoutRect(placeholder)
        // 占位范围内保持原目标，模块让位后不会在相邻位置间来回抖动。
        if (slot && visualDropRef.current?.region === region && y >= slot.top - 5 && y <= slot.top + slot.height + 5) next = visualDropRef.current
        else {
          const rows = Array.from(group.querySelectorAll<HTMLElement>('[data-module-id]')).filter((row) => row.dataset.moduleId !== draggedId)
          const before = rows.find((row) => { const r = moduleLayoutRect(row); return y < r.top + r.height / 2 })
          next = before ? { region, sectionId: before.dataset.moduleId, edge: 'before' }
            : { region, sectionId: rows[rows.length - 1]?.dataset.moduleId, edge: 'after' }
        }
      }
    }
    dropRef.current = next
    setDrop((previous) => previous?.region === next?.region && previous?.sectionId === next?.sectionId && previous?.edge === next?.edge ? previous : next)
    if (next) {
      visualDropRef.current = next
      setVisualDrop((previous) => previous?.region === next?.region && previous?.sectionId === next?.sectionId && previous?.edge === next?.edge ? previous : next)
    }
  }, [navigationRef])

  useEffect(() => {
    if (!draggingId) return
    let frame = 0
    const tick = () => {
      const drag = dragRef.current
      const nav = navigationRef.current
      if (!drag?.active || !nav) return
      const rect = nav.getBoundingClientRect()
      if (drag.x >= rect.left && drag.x <= rect.right) {
        if (drag.y < rect.top + 40) nav.scrollTop -= 8
        else if (drag.y > rect.bottom - 40) nav.scrollTop += 8
      }
      updateDrop(drag.x, drag.y, drag.id)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [draggingId, navigationRef, updateDrop])

  // 放下时浮层落到真实模块的位置，列表已经让位，因此提交布局不会再次跳动。
  useLayoutEffect(() => {
    if (!landing) return
    const ghost = ghostRef.current
    const row = document.getElementById(`module-open-${landing.id}`)?.closest<HTMLElement>('.module-nav-row')
    if (!ghost || !row || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setLanding(null); return }
    const target = moduleLayoutRect(row)
    const nav = navigationRef.current?.getBoundingClientRect()
    const visible = nav && target.top + target.height >= nav.top && target.top <= nav.bottom
    const endTransform = visible ? `translate3d(${target.left}px,${target.top}px,0)` : getComputedStyle(ghost).transform
    const float = ghost.animate([
      { transform: getComputedStyle(ghost).transform, opacity: .98, width: `${landing.width}px`, height: `${landing.height}px` },
      { transform: endTransform, opacity: 0, width: `${visible ? target.width : landing.width}px`, height: `${visible ? target.height : landing.height}px` },
    ], { duration: 180, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards' })
    const arrive = row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, delay: 60, easing: 'ease-out', fill: 'both' })
    let active = true
    void Promise.all([float.finished, arrive.finished]).then(() => { if (active) setLanding(null) }).catch(() => {})
    return () => { active = false; float.cancel(); arrive.cancel() }
  }, [landing, navigationRef])

  const restoreHandleFocus = (sectionId: string) => requestAnimationFrame(() => {
    const handle = document.getElementById(`module-drag-${sectionId}`)
    if (handle?.getClientRects().length) handle.focus({ preventScroll: true })
  })
  const finishDrag = (commit: boolean, animate = true) => {
    const drag = dragRef.current
    if (!drag) return
    const destination = dropRef.current
    dragRef.current = null
    dropRef.current = null
    visualDropRef.current = null
    setDraggingId(null)
    setDrop(null)
    setVisualDrop(null)
    if (drag.capture.hasPointerCapture(drag.pointerId)) drag.capture.releasePointerCapture(drag.pointerId)
    if (commit && drag.active && destination) {
      const proposed = previewGroups(drag.id, destination)
      const changed = regions.some((region) => groups[region].length !== proposed[region].length || groups[region].some((section, index) => section.id !== proposed[region][index].id))
      if (changed) onPlace(drag.id, { ...destination, region: sidebar ? destination.region : undefined })
      const peers = proposed[destination.region]
      const index = peers.findIndex((section) => section.id === drag.id)
      setAnnouncement(`${sections.find((section) => section.id === drag.id)?.title || '模块'}已移至${sidebar ? (destination.region === 'main' ? '主栏' : '侧栏') : ''}第${index + 1}项`)
    }
    if (drag.active && animate) setLanding({ id: drag.id, width: drag.width, height: drag.height })
    else setLanding(null)
    restoreHandleFocus(drag.id)
  }
  const finishResize = () => { resizeRef.current = null; setResizing(false) }
  cancelRef.current = () => { finishDrag(false, false); setLanding(null); finishResize() }
  useEffect(() => {
    const cancel = () => cancelRef.current()
    const keyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || (!dragRef.current && !resizeRef.current)) return
      event.preventDefault()
      event.stopPropagation()
      if (dragRef.current) finishRef.current()
      else cancel()
    }
    window.addEventListener('blur', cancel)
    window.addEventListener('resize', cancel)
    window.addEventListener('keydown', keyDown, true)
    return () => {
      window.removeEventListener('blur', cancel)
      window.removeEventListener('resize', cancel)
      window.removeEventListener('keydown', keyDown, true)
      const drag = dragRef.current
      dragRef.current = null
      if (drag?.capture.hasPointerCapture(drag.pointerId)) drag.capture.releasePointerCapture(drag.pointerId)
    }
  }, [])
  const finishRef = useRef(() => {})
  finishRef.current = () => finishDrag(false)
  useLayoutEffect(() => { cancelRef.current() }, [mode])

  const startDrag = (event: PointerEvent<HTMLButtonElement>, sectionId: string) => {
    const capture = navigationRef.current
    const row = event.currentTarget.closest<HTMLElement>('.module-nav-row')
    if (event.button !== 0 || !capture || !row) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    capture.setPointerCapture(event.pointerId)
    const rect = row.getBoundingClientRect()
    const region = row.closest<HTMLElement>('[data-module-region]')!.dataset.moduleRegion as SectionRegion
    const peers = groups[region]
    const index = peers.findIndex((section) => section.id === sectionId)
    const origin: DropTarget = peers[index + 1] ? { region, sectionId: peers[index + 1].id, edge: 'before' } : { region, sectionId: peers[index - 1]?.id, edge: 'after' }
    visualDropRef.current = origin
    dropRef.current = origin
    setVisualDrop(origin)
    setLanding(null)
    setDragSize({ width: rect.width, height: rect.height })
    dragRef.current = { id: sectionId, pointerId: event.pointerId, capture, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false, width: rect.width, height: rect.height }
  }
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    drag.x = event.clientX
    drag.y = event.clientY
    if (!drag.active && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 5) return
    event.preventDefault()
    drag.active = true
    setDraggingId(drag.id)
    const next = { x: Math.max(8, Math.min(drag.x + 12, window.innerWidth - drag.width - 8)), y: Math.max(8, Math.min(drag.y + 10, window.innerHeight - drag.height - 8)) }
    setPosition(next)
    updateDrop(drag.x, drag.y, drag.id)
  }
  const keyboardMove = (event: KeyboardEvent, section: Section, region: SectionRegion) => {
    const peers = groups[region]
    const index = peers.findIndex((candidate) => candidate.id === section.id)
    let destination: DropTarget | null = null
    if (event.key === 'ArrowUp' && index > 0) destination = { region, sectionId: peers[index - 1].id, edge: 'before' }
    if (event.key === 'ArrowDown' && index < peers.length - 1) destination = { region, sectionId: peers[index + 1].id, edge: 'after' }
    const nextRegion = event.key === 'ArrowLeft' ? 'main' : event.key === 'ArrowRight' ? 'sidebar' : null
    if (sidebar && nextRegion && nextRegion !== region) destination = { region: nextRegion, sectionId: groups[nextRegion][groups[nextRegion].length - 1]?.id, edge: 'after' }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    if (!destination) return
    keyboardMotion.current = true
    onPlace(section.id, { ...destination, region: sidebar ? destination.region : undefined })
    setAnnouncement(`${section.title || SECTION_TYPE_LABELS[section.type]}已调整位置`)
    restoreHandleFocus(section.id)
  }
  const navigate = (event: KeyboardEvent, sectionId: string) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !navigationOrder.length) return
    event.preventDefault()
    const index = navigationOrder.findIndex((section) => section.id === sectionId)
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? navigationOrder.length - 1
      : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + navigationOrder.length) % navigationOrder.length
    const next = navigationOrder[nextIndex]
    onSelect(next.id)
    document.getElementById(`module-open-${next.id}`)?.focus({ preventScroll: true })
  }
  const draggedSection = sections.find((section) => section.id === (draggingId ?? landing?.id))

  return <>
    <aside className="module-navigation" ref={navigationRef} aria-label="简历模块目录" data-managing={managing} data-open={mode === 'overlay' || mode === 'drawer'} data-module-dragging={Boolean(draggingId)}
      onPointerMove={moveDrag} onPointerUp={(event) => { if (dragRef.current?.pointerId === event.pointerId) finishDrag(true) }}
      onPointerCancel={(event) => { if (dragRef.current?.pointerId === event.pointerId) finishDrag(false) }}
      onLostPointerCapture={(event) => { if (event.target === event.currentTarget && dragRef.current?.pointerId === event.pointerId) finishDrag(false) }}>
      <div className="module-navigation-heading">
        <h2>简历模块<span className="module-navigation-count" aria-label={`${sections.length} 个模块`}>{sections.length}</span></h2>
        <div className="module-navigation-tools">
          <button type="button" className={`module-navigation-button module-manage-toggle${managing ? ' is-active' : ''}`} aria-label="管理模块与布局" aria-pressed={managing} title={managing ? '完成调整' : '模块与布局设置'} onClick={onToggleManaging}>{managing ? <Check size={15} /> : <Settings2 size={15} />}</button>
          <button type="button" className="module-navigation-button module-directory-collapse" aria-label={mode === 'rail' ? '展开模块目录' : '收起模块目录'} title={mode === 'rail' ? '展开目录' : '收起目录'} aria-expanded={mode !== 'rail'} aria-controls={id} onClick={onToggleCollapsed}>{mode === 'rail' ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>
        </div>
      </div>
      <p className="module-navigation-hint">{sidebar ? '拖动调整顺序或主／侧栏' : '拖动模块调整简历顺序'}</p>
      <span className="sr-only" id={helpId}>按住手柄拖动模块。聚焦手柄后，上下方向键调整顺序，左右方向键切换主栏和侧栏。拖动时按 Escape 取消。</span>
      <nav id={id} className="module-directory" aria-label="模块导航">
        {regions.map((region) => <div key={region} className="module-nav-group" data-module-region={region}>
          {sidebar && <div className="module-nav-group-heading" data-module-motion={`region:${region}`}><h3>{region === 'main' ? '主栏' : '侧栏'}</h3><span>{displayGroups[region].length}</span></div>}
          {displayGroups[region].map((section, index) => {
            const Icon = MODULE_CONFIG[section.type].icon
            const selected = activeSectionId === section.id
            const name = section.title || SECTION_TYPE_LABELS[section.type]
            if (draggingId === section.id) return <div key={section.id} className="module-drop-placeholder" data-module-placeholder={section.id} data-module-motion={`section:${section.id}`} data-valid={Boolean(drop)} style={{ height: dragSize.height }} aria-hidden="true"><strong>放在此处</strong><span>{sidebar ? (region === 'main' ? '主栏 · ' : '侧栏 · ') : ''}第 {index + 1} 项</span></div>
            return <div className={`module-nav-row${selected ? ' is-active' : ''}`} key={section.id} data-module-id={section.id} data-module-motion={`section:${section.id}`}>
              <button type="button" id={`module-drag-${section.id}`} className="module-drag-handle" aria-label={`拖动模块：${name}`} aria-describedby={helpId} title="拖动调整布局；方向键也可移动" onPointerDown={(event) => startDrag(event, section.id)} onKeyDown={(event) => keyboardMove(event, section, region)}><GripVertical size={13} /></button>
              <button type="button" className="module-nav-select" id={`module-open-${section.id}`} aria-label={`编辑模块：${name}`} aria-current={selected ? 'location' : undefined} aria-controls={`module-panel-${section.id}`} onClick={() => onSelect(section.id)} onKeyDown={(event) => navigate(event, section.id)} title={name}>
                <span className="module-nav-icon" aria-hidden="true"><Icon size={16} /></span><span className="module-nav-label">{name}</span>
                {'items' in section.data && <span className="module-nav-count" aria-hidden="true">{section.data.items.length}</span>}
              </button>
              {managing && renderActions(section)}
            </div>
          })}
          {!displayGroups[region].length && <p className="module-nav-empty" data-module-motion={`empty:${region}`}>拖动模块到此处</p>}
        </div>)}
      </nav>
      <div className="module-navigation-settings" hidden={!managing} data-module-motion="settings">
        <div className="module-directory-width-setting"><label htmlFor={`${helpId}-directory-width`}>目录宽度</label><output>{width}px</output><input id={`${helpId}-directory-width`} type="range" min={MIN_MODULE_NAVIGATION_WIDTH} max={maximumWidth} value={width} onChange={(event) => setWidth(Number(event.target.value))} /></div>
        {sidebar && <div><label htmlFor={`${helpId}-sidebar-width`}>简历侧栏宽度</label><output>{sidebarWidth}%</output><input id={`${helpId}-sidebar-width`} type="range" min={MIN_SIDEBAR_WIDTH} max={MAX_SIDEBAR_WIDTH} value={sidebarWidth} onChange={(event) => setLayout(resume.id, { ...resume.layout, sidebarWidth: Number(event.target.value) })} /></div>}
        <button type="button" className="module-layout-reset" disabled={!resume.layout} onClick={() => setLayout(resume.id, undefined)}><Undo2 size={13} />恢复模板布局</button>
      </div>
      <div className="module-navigation-add" data-module-motion="add"><ModulePicker hasBasics={sections.some((section) => section.type === 'basics')} onAdd={onAdd} /></div>
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
    </aside>
    <div className="module-navigation-resize" role="separator" aria-label="调整模块目录宽度" aria-orientation="vertical" aria-valuemin={MIN_MODULE_NAVIGATION_WIDTH} aria-valuemax={maximumWidth} aria-valuenow={width} aria-valuetext={`${width} 像素`} tabIndex={0} data-resizing={resizing} title="拖动调整目录宽度，双击恢复默认；方向键也可调整"
      onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId); resizeRef.current = { x: event.clientX, width }; setResizing(true) }}
      onPointerMove={(event) => { if (resizeRef.current) setWidth(Math.min(maximumWidth, resizeRef.current.width + event.clientX - resizeRef.current.x)) }}
      onPointerUp={(event) => { finishResize(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }} onPointerCancel={finishResize} onLostPointerCapture={finishResize}
      onDoubleClick={() => setWidth(DEFAULT_MODULE_NAVIGATION_WIDTH)}
      onKeyDown={(event) => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); setWidth(event.key === 'Home' ? MIN_MODULE_NAVIGATION_WIDTH : event.key === 'End' ? maximumWidth : Math.min(maximumWidth, width + (event.key === 'ArrowRight' ? 8 : -8))) }} />
    {draggedSection && createPortal(<div ref={ghostRef} className="module-drag-ghost" data-phase={landing ? 'landing' : 'dragging'} data-no-print style={{ transform: `translate3d(${position.x}px,${position.y}px,0)`, width: landing?.width ?? dragSize.width, height: landing?.height ?? dragSize.height }}><GripVertical size={14} /><span>{draggedSection.title || SECTION_TYPE_LABELS[draggedSection.type]}</span>{!landing && <small>{drop ? (sidebar ? (drop.region === 'main' ? '主栏' : '侧栏') : '移动') : '松开取消'}</small>}</div>, document.body)}
  </>
}

function ModulePicker({ hasBasics, onAdd }: { hasBasics: boolean; onAdd: (type: SectionType) => void }) {
  return <Popover contentRole="menu" align="right" ariaLabel="选择模块类型" trigger={<button type="button" className="module-add-button" aria-label="添加模块" title="添加模块"><Plus size={16} /><span>添加模块</span></button>}>
    <div className="module-picker">
      <div className="module-picker-heading">添加模块</div>
      <div className="module-type-menu">{(Object.keys(SECTION_TYPE_LABELS) as SectionType[]).map((type) => {
        const Icon = MODULE_CONFIG[type].icon
        const disabled = type === 'basics' && hasBasics
        return <button key={type} type="button" role="menuitem" disabled={disabled} onClick={() => onAdd(type)}><Icon size={19} /><span><strong>{SECTION_TYPE_LABELS[type]}{disabled && <small>已添加</small>}</strong><span>{MODULE_CONFIG[type].description}</span></span></button>
      })}</div>
    </div>
  </Popover>
}
