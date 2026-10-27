import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { ChevronDown, List, Pencil, Plus } from 'lucide-react'
import type { Resume, Section, SectionType } from '@/resume/model'
import { SECTION_TYPE_LABELS } from '@/resume/model'
import { useResumeStore } from '@/state/useResumeStore'
import { isItemSection } from '@/resume/sections'
import { createResumeCommands, type ContentUndo } from '@/resume/commands'
import { getSectionRegion, orderSections, placeLayoutSection, type SectionPlacement } from '@/resume/layout'
import { usePageExitDraftFlush } from '@/state/editing/editorDraft'
import { findResumeTarget, readResumeTarget, resolveResumeTarget, scrollToResumeTarget, type ResumeFocusRequest, type ResumeTarget } from '@/resume/focus'
import { getTemplate } from '@/templates/registry'
import { MarkdownField } from '../fields/MarkdownField'
import { ModuleContentActions } from './ModuleContentActions'
import { BasicsEditor } from './BasicsEditor'
import { ItemsEditor } from './ItemsEditor'
import { ModuleNavigation } from './ModuleNavigation'
import { MODULE_CONFIG } from './moduleConfig'
import { maximumModuleNavigationWidth, MIN_EXPANDED_MODULE_EDITOR_WIDTH, MIN_MODULE_NAVIGATION_WIDTH, responsiveModuleNavigationWidth, resolveModuleNavigationMode } from '@/shared/layout/workspaceLayout'

interface Props {
  resume: Resume
  isMobile: boolean
  onRemove: (undo: ContentUndo) => void
  renderToolbar: (controls: ReactNode) => ReactNode
  onTargetChange: (target: ResumeTarget) => void
  focusRequest: ResumeFocusRequest | null
}

export function ModularEditor({ resume, isMobile, onRemove, renderToolbar, onTargetChange, focusRequest }: Props) {
  const commands = useMemo(() => createResumeCommands(resume.id, useResumeStore.getState), [resume.id])
  const setLayout = useResumeStore((state) => state.setLayout)
  const navigationWidth = useResumeStore((state) => state.moduleNavigationWidth)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(() => resume.sections.find((section) => section.type === 'basics')?.id ?? orderSections(resume.sections, resume.layout?.order)[0]?.id ?? null)
  const [managingModules, setManagingModules] = useState(false)
  const [navigationCollapsed, setNavigationCollapsed] = useState(false)
  const [mobileDirectoryOpen, setMobileDirectoryOpen] = useState(false)
  const [editorWidth, setEditorWidth] = useState(0)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set())
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(() => new Set(resume.sections.flatMap((section) => isItemSection(section) ? section.data.items.slice(1).map((item) => item.id) : [])))
  const directoryId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const navigationRef = useRef<HTMLElement>(null)
  const directoryToggleRef = useRef<HTMLButtonElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const mobileDirectoryExpanded = mobileDirectoryOpen || managingModules
  const navigationMode = resolveModuleNavigationMode(editorWidth, isMobile, navigationCollapsed, mobileDirectoryExpanded)
  const maxNavigationWidth = maximumModuleNavigationWidth(editorWidth)
  const automaticNavigationWidth = responsiveModuleNavigationWidth(navigationWidth, editorWidth, navigationCollapsed)
  const navigationPanelWidth = navigationMode === 'overlay' || navigationMode === 'drawer' ? navigationWidth : automaticNavigationWidth
  const navigationDensity = navigationMode === 'rail' ? 'icons' : navigationMode === 'expanded' && automaticNavigationWidth < MIN_MODULE_NAVIGATION_WIDTH ? 'compact' : 'full'
  useLayoutEffect(() => {
    if (!isMobile && editorWidth <= MIN_EXPANDED_MODULE_EDITOR_WIDTH) {
      setMobileDirectoryOpen(false)
      setManagingModules(false)
    }
  }, [editorWidth, isMobile])
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const measure = () => setEditorWidth(root.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])
  // 表单和字段富文本均同步写入 store；页面离开时仍需立即落盘防抖中的存储。
  usePageExitDraftFlush(() => {})

  const currentResume = commands.currentResume
  const focus = (id: string) => requestAnimationFrame(() => {
    const target = document.getElementById(id)
    target?.scrollIntoView({ block: 'nearest' })
    target?.focus({ preventScroll: true })
  })
  const showSection = (sectionId: string, rename = false) => {
    setActiveSectionId(sectionId)
    onTargetChange({ resumeId: resume.id, sectionId })
    setCollapsedSections((previous) => {
      if (!previous.has(sectionId)) return previous
      const next = new Set(previous)
      next.delete(sectionId)
      return next
    })
    if (isMobile || editorWidth <= MIN_EXPANDED_MODULE_EDITOR_WIDTH) {
      setMobileDirectoryOpen(false)
      setManagingModules(false)
    } else if (!managingModules) setMobileDirectoryOpen(false)
    requestAnimationFrame(() => {
      const container = scrollRef.current
      const panel = document.getElementById(`module-panel-${sectionId}`)
      if (!container || !panel) return
      container.scrollTo({
        top: container.scrollTop + panel.getBoundingClientRect().top - container.getBoundingClientRect().top - 12,
        behavior: rename || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
      if (rename) {
        const input = document.getElementById(`module-title-${sectionId}`) as HTMLInputElement | null
        input?.focus({ preventScroll: true })
        input?.select()
      }
    })
  }
  const addSection = (type: SectionType) => {
    const section = commands.addSection(type)
    if (section) showSection(section.id, true)
  }
  const removeSection = (sectionId: string) => {
    const removal = commands.removeSection(sectionId)
    if (!removal) return
    if (activeSectionId === sectionId) setActiveSectionId(removal.focusId ?? null)
    requestAnimationFrame(() => {
      const target = removal.focusId ? document.getElementById(`module-open-${removal.focusId}`) : document.querySelector<HTMLElement>('.module-add-button')
      target?.focus({ preventScroll: true })
    })
    onRemove(removal.undo)
  }
  const removeItem = (sectionId: string, itemId: string, projectId?: string) => {
    const removal = commands.removeItem(sectionId, itemId, projectId)
    if (!removal) return
    requestAnimationFrame(() => {
      const target = removal.focusId ? document.getElementById(`module-item-toggle-${removal.focusId}`) : null
      const next = target ?? document.getElementById(`module-panel-${sectionId}`)?.querySelector<HTMLElement>('.module-add-entry, .module-empty button')
      next?.scrollIntoView({ block: 'nearest' })
      next?.focus({ preventScroll: true })
    })
    onRemove(removal.undo)
  }

  const sidebar = getTemplate(resume.template).sidebar
  const ordered = orderSections(resume.sections, resume.layout?.order)
  const sections = ordered
  const regionOf = (section: Section) => sidebar ? getSectionRegion(section, resume.layout, sidebar.defaultSectionTypes) : 'main'
  const peersOf = (section: Section) => sections.filter((candidate) => regionOf(candidate) === regionOf(section))
  const placeSection = (sectionId: string, placement: SectionPlacement) => {
    const current = currentResume()
    const section = current?.sections.find((candidate) => candidate.id === sectionId)
    if (!current || !section) return
    const currentSidebar = getTemplate(current.template).sidebar
    const sameRegion = !currentSidebar || getSectionRegion(section, current.layout, currentSidebar.defaultSectionTypes) === placement.region
    const layout = placeLayoutSection(current.sections, current.layout, sectionId, { ...placement, region: sameRegion ? undefined : placement.region })
    if (layout !== current.layout) setLayout(resume.id, layout)
  }
  const moveSection = (section: Section, direction: -1 | 1) => {
    const peers = peersOf(section)
    const neighbor = peers[peers.findIndex((candidate) => candidate.id === section.id) + direction]
    if (!neighbor) return
    placeSection(section.id, { sectionId: neighbor.id, edge: direction < 0 ? 'before' : 'after' })
  }

  const renderBody = (section: Section): ReactElement => {
    switch (section.type) {
      case 'basics': return <BasicsEditor section={section} resume={resume} commands={commands} />
      case 'experience': case 'education': case 'projects': return <ItemsEditor section={section} commands={commands} collapsedItems={collapsedItems} onToggle={toggleItem} onRemove={removeItem} onFocus={focus} />
      case 'skills': case 'custom': return <MarkdownField field="content" label={section.type === 'skills' ? '技能内容' : '模块内容'} placeholder={section.type === 'skills' ? '按类别列出你的专业技能、工具与技术栈…' : '填写证书、荣誉、个人作品或其他补充内容…'} hint={section.type === 'skills' ? '按类别组织，优先填写与目标岗位相关的技能。' : '补充证书、荣誉或其他值得展示的内容。'} value={section.data.content} onChange={(content) => commands.setContent(section.id, content)} />
    }
  }

  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0]
  const sectionOrder = sections.map((section) => section.id).join(',')

  // 目录跟随连续表单的滚动位置；内容增减或窗口变化时重新测量，不抢输入焦点。
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    let frame = 0
    const updateActive = () => {
      frame = 0
      const panels = Array.from(container.querySelectorAll<HTMLElement>('.module-detail'))
      if (!panels.length) return
      const threshold = container.getBoundingClientRect().top + Math.min(120, container.clientHeight / 4)
      let current = panels[0]
      for (const panel of panels) {
        if (panel.getBoundingClientRect().top > threshold) break
        current = panel
      }
      if (container.scrollHeight <= container.clientHeight + 2) current = panels[0]
      else if (container.scrollTop + container.clientHeight >= container.scrollHeight - 2) current = panels[panels.length - 1]
      setActiveSectionId(current.dataset.sectionId ?? null)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(updateActive)
    }
    container.addEventListener('scroll', schedule, { passive: true })
    const observer = new ResizeObserver(schedule)
    observer.observe(container)
    container.querySelectorAll('.module-detail').forEach((panel) => observer.observe(panel))
    schedule()
    return () => {
      container.removeEventListener('scroll', schedule)
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [sectionOrder])

  const sectionActions = (section: Section) => {
    const name = section.title || SECTION_TYPE_LABELS[section.type]
    const peers = peersOf(section)
    return <ModuleContentActions label={`模块：${name}`} onRename={() => showSection(section.id, true)}
      itemsCollapsed={isItemSection(section) && section.data.items.every((item) => collapsedItems.has(item.id))}
      onToggleItems={isItemSection(section) && section.data.items.length ? () => {
        const ids = section.data.items.map((item) => item.id)
        setCollapsedItems((previous) => {
          const next = new Set(previous)
          const expand = ids.every((id) => next.has(id))
          ids.forEach((id) => expand ? next.delete(id) : next.add(id))
          return next
        })
      } : undefined}
      index={peers.findIndex((candidate) => candidate.id === section.id)} count={peers.length}
      onMove={(direction) => moveSection(section, direction)}
      onDelete={section.type === 'basics' ? undefined : () => removeSection(section.id)} />
  }

  const toggleSection = (sectionId: string) => setCollapsedSections((previous) => {
    const next = new Set(previous)
    if (next.has(sectionId)) next.delete(sectionId)
    else next.add(sectionId)
    return next
  })
  const toggleItem = (itemId: string) => setCollapsedItems((previous) => {
    const next = new Set(previous)
    if (next.has(itemId)) next.delete(itemId)
    else next.add(itemId)
    return next
  })
  // 布局阶段同步展开父级，再于下一帧定位，避免对尚未显示的字段调用 focus。
  useLayoutEffect(() => {
    if (!focusRequest) return
    const current = useResumeStore.getState().resumes.find((candidate) => candidate.id === resume.id)
    const target = current && resolveResumeTarget(current, focusRequest.target)
    if (!target) return
    setCollapsedSections((previous) => { const next = new Set(previous); next.delete(target.sectionId); return next })
    setCollapsedItems((previous) => { const next = new Set(previous); if (target.itemId) next.delete(target.itemId); if (target.projectId) next.delete(target.projectId); return next })
    setMobileDirectoryOpen(false)
    setManagingModules(false)
    const frame = requestAnimationFrame(() => {
      const root = rootRef.current
      const container = scrollRef.current
      if (!root || !container) return
      const element = findResumeTarget(root, target)
      if (!element) return
      const details = element.closest('details')
      if (details) details.open = true
      const control = target.field
        ? element.querySelector<HTMLElement>('input, textarea, [contenteditable="true"]') ?? element.querySelector<HTMLElement>('button') ?? element
        : element.querySelector<HTMLElement>('.module-item-toggle, .module-title-input') ?? element
      control.focus({ preventScroll: true })
      scrollToResumeTarget(container, element)
    })
    return () => cancelAnimationFrame(frame)
  }, [focusRequest, resume.id])

  useEffect(() => {
    if (navigationMode !== 'overlay' && navigationMode !== 'drawer') return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!navigationRef.current?.contains(target) && !directoryToggleRef.current?.contains(target)
        && !(event.target as Element).closest('.precision-popover')) {
        setMobileDirectoryOpen(false)
        setManagingModules(false)
      }
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !mobileDirectoryOpen) return
      setMobileDirectoryOpen(false)
      setManagingModules(false)
      const toggle = isMobile ? directoryToggleRef.current : navigationRef.current?.querySelector<HTMLButtonElement>('.module-directory-collapse')
      toggle?.focus({ preventScroll: true })
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [navigationMode, mobileDirectoryOpen, isMobile])

  const compactControls = <div className="module-compact-controls">
    {sections.length > 0 && <label className="module-jump"><span className="sr-only">跳转到模块</span><select value={activeSection?.id ?? ''} onChange={(event) => showSection(event.target.value)}>{sections.map((section) => <option key={section.id} value={section.id}>{section.title || SECTION_TYPE_LABELS[section.type]}</option>)}</select><ChevronDown size={13} aria-hidden="true" /></label>}
    <button ref={directoryToggleRef} type="button" className="module-navigation-button module-directory-toggle" aria-label={mobileDirectoryExpanded ? '收起模块目录' : '展开模块目录'} title="模块目录与管理" aria-expanded={mobileDirectoryExpanded} aria-controls={directoryId} onClick={() => { setMobileDirectoryOpen(!mobileDirectoryExpanded); if (mobileDirectoryExpanded) setManagingModules(false) }}><List size={16} /></button>
  </div>

  return <div className="modular-editor" ref={rootRef} style={{ '--module-navigation-width': `${automaticNavigationWidth}px`, '--module-navigation-overlay-width': `${navigationWidth}px` } as CSSProperties} data-navigation-mode={navigationMode} data-navigation-density={navigationDensity} onFocusCapture={(event) => {
    const target = readResumeTarget(event.target, event.currentTarget, resume.id)
    if (target) onTargetChange(target)
  }}>
    {renderToolbar(compactControls)}
    <ModuleNavigation resume={resume} sections={sections} activeSectionId={activeSection?.id} id={directoryId} navigationRef={navigationRef} mode={navigationMode} width={navigationPanelWidth} maximumWidth={maxNavigationWidth} managing={managingModules}
      onSelect={showSection} onPlace={placeSection} onAdd={addSection} renderActions={sectionActions}
      onToggleManaging={() => { setManagingModules(!managingModules); setNavigationCollapsed(false) }}
      onToggleCollapsed={() => {
        if (editorWidth <= MIN_EXPANDED_MODULE_EDITOR_WIDTH) setMobileDirectoryOpen(!mobileDirectoryExpanded)
        else { setNavigationCollapsed(!navigationCollapsed); setMobileDirectoryOpen(false) }
        setManagingModules(false)
      }} />
    <div className="module-editor-scroll" ref={scrollRef}>
    {sections.length > 0 ? sections.map((section) => {
      const collapsed = collapsedSections.has(section.id)
      const name = section.title || SECTION_TYPE_LABELS[section.type]
      const Icon = MODULE_CONFIG[section.type].icon
      return <section key={section.id} id={`module-panel-${section.id}`} className="module-detail" data-section-id={section.id} data-resume-section={section.id} data-collapsed={collapsed} data-active={activeSection?.id === section.id} aria-labelledby={`module-heading-${section.id}`}>
      <header className="module-detail-heading">
        <h2 id={`module-heading-${section.id}`} className="sr-only">{name}</h2>
        <div className="module-title-row">
          <span className="module-section-icon" aria-hidden="true"><Icon size={19} /></span>
          <div className="module-heading-copy">
            <div className="module-heading-title" data-resume-field="heading"><input id={`module-title-${section.id}`} className="module-title-input" aria-label="模块标题" aria-describedby={`module-description-${section.id}`} title="点击修改模块标题" placeholder={SECTION_TYPE_LABELS[section.type]} value={section.title} onChange={(event) => commands.renameSection(section.id, event.target.value)} /><Pencil className="module-title-edit" size={12} aria-hidden="true" /></div>
            <p id={`module-description-${section.id}`} className="module-section-description">{MODULE_CONFIG[section.type].description}</p>
          </div>
          <button type="button" className="module-icon-button module-collapse-button" aria-label={`${collapsed ? '展开' : '收起'}模块：${name}`} title={collapsed ? '展开模块' : '收起模块'} aria-expanded={!collapsed} aria-controls={`module-body-${section.id}`} onClick={() => toggleSection(section.id)}><ChevronDown size={16} /></button>
          {sectionActions(section)}
        </div>
      </header>
      {/* 收起时保留字段实例，避免重建富文本编辑器及丢失光标、撤销历史。 */}
      <div id={`module-body-${section.id}`} className="module-detail-body" hidden={collapsed}>{renderBody(section)}</div>
    </section>}) : <div className="module-empty module-empty-resume"><p>还没有简历模块</p><button type="button" className="module-text-button" onClick={() => addSection('basics')}><Plus size={15} />添加基本信息</button></div>}
    </div>
  </div>
}
