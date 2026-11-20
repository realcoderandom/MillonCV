import { memo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, GripVertical, Plus } from 'lucide-react'
import type { DatedItem, ItemSection } from '@/resume/model'
import type { ResumeCommands } from '@/resume/commands'
import { ItemCard } from './ItemCard'
import { ITEM_LABELS, MODULE_CONFIG } from './moduleConfig'
import { useItemDrag } from './useItemDrag'

interface Props {
  section: ItemSection
  commands: ResumeCommands
  collapsedItems: ReadonlySet<string>
  onToggle: (id: string) => void
  onExpand: (id: string) => void
  onRemove: (sectionId: string, itemId: string, projectId?: string) => void
  onFocus: (id: string) => void
}

const SubprojectList = memo(function SubprojectList({ sectionId, sectionType, item, commands, collapsedItems, onToggle, onExpand, onRemove, onFocus, onAdd }: {
  sectionId: string
  sectionType: ItemSection['type']
  item: DatedItem
  commands: ResumeCommands
  collapsedItems: ReadonlySet<string>
  onToggle: (id: string) => void
  onExpand: (id: string) => void
  onRemove: (sectionId: string, itemId: string, projectId?: string) => void
  onFocus: (id: string) => void
  onAdd: (parentId: string) => void
}) {
  const projects = item.projects ?? []
  const labels = ITEM_LABELS[sectionType]
  const handlePlace = useCallback((projectId: string, targetId: string, edge: 'before' | 'after') => {
    commands.placeProject(sectionId, item.id, projectId, targetId, edge)
  }, [commands, item.id, sectionId])
  const handleMove = useCallback((projectId: string, direction: -1 | 1) => {
    commands.moveProject(sectionId, item.id, projectId, direction)
  }, [commands, item.id, sectionId])

  const drag = useItemDrag({
    itemAttribute: 'data-resume-project',
    onPlace: handlePlace,
    onMove: handleMove,
  })

  return (
    <div className={`module-subprojects${sectionType === 'education' && projects.length === 0 ? ' is-secondary' : ''}`} ref={drag.containerRef} data-item-dragging={Boolean(drag.draggingId)} {...drag.containerHandlers}>
      {projects.map((project, projectIndex) => (
        <ItemCard
          key={project.id}
          item={project}
          type="subproject"
          index={projectIndex}
          count={projects.length}
          collapsed={collapsedItems.has(project.id)}
          dragging={drag.draggingId === project.id}
          dropEdge={drag.dropTarget?.id === project.id ? drag.dropTarget.edge : undefined}
          onToggle={() => onToggle(project.id)}
          onChange={(patch) => commands.patchProject(sectionId, item.id, project.id, patch)}
          onMove={(direction) => { commands.moveProject(sectionId, item.id, project.id, direction); onFocus(`module-item-toggle-${project.id}`) }}
          onDuplicate={() => {
            const copy = commands.duplicateItem(sectionId, item.id, project.id)
            if (copy) { onExpand(copy.id); onFocus(`module-item-title-${copy.id}`) }
          }}
          onDelete={() => onRemove(sectionId, item.id, project.id)}
          onDragStart={drag.startDrag}
          onDragKeyDown={drag.handleKeyDown}
        />
      ))}
      <button type="button" className="module-text-button module-add-subproject" onClick={() => onAdd(item.id)}>
        <Plus size={14} />{labels.subprojectButton}<span>选填</span>
      </button>
      <div className="sr-only" role="status" aria-live="polite">{drag.announcement}</div>
      {drag.draggingId && createPortal(
        <div className="module-drag-ghost" data-no-print style={{ transform: `translate3d(${drag.position.x}px,${drag.position.y}px,0)`, width: drag.dragWidth }}>
          <GripVertical size={14} /><span>{drag.dragLabel}</span><small>{drag.dropTarget ? '松开排序' : '松开取消'}</small>
        </div>,
        document.body,
      )}
    </div>
  )
})

export const ItemsEditor = memo(function ItemsEditor({ section, commands, collapsedItems, onToggle, onExpand, onRemove, onFocus }: Props) {
  const labels = ITEM_LABELS[section.type]
  const Icon = MODULE_CONFIG[section.type].icon
  const addItem = useCallback((parentId?: string, position: 'start' | 'end' = 'end') => {
    const item = commands.addItem(section.id, parentId, position)
    if (item) {
      onExpand(item.id)
      onFocus(`module-item-title-${item.id}`)
    }
  }, [commands, onExpand, onFocus, section.id])

  const handlePlace = useCallback((itemId: string, targetId: string, edge: 'before' | 'after') => {
    commands.placeItem(section.id, itemId, targetId, edge)
  }, [commands, section.id])
  const handleMove = useCallback((itemId: string, direction: -1 | 1) => {
    commands.moveItem(section.id, itemId, direction)
  }, [commands, section.id])

  const drag = useItemDrag({
    itemAttribute: 'data-resume-item',
    onPlace: handlePlace,
    onMove: handleMove,
  })

  return (
    <div className="module-items" ref={drag.containerRef} data-item-dragging={Boolean(drag.draggingId)} {...drag.containerHandlers}>
      {section.data.items.length === 0 && (
        <div className="module-empty module-empty-entry">
          <span className="module-empty-icon" aria-hidden="true"><Icon size={23} /></span>
          <div className="module-empty-copy"><h3>添加你的第一条{labels.noun}</h3><p>{labels.emptyHint}</p></div>
          <button type="button" className="module-text-button" onClick={() => addItem()}><Plus size={15} />添加{labels.noun}</button>
        </div>
      )}
      {section.data.items.length > 0 && (
        <div className="module-items-top-actions">
          <button type="button" className="module-text-button module-add-top-entry" onClick={() => addItem(undefined, 'start')} aria-label={`在顶部添加最新${labels.noun}`}>
            <Plus size={14} /><span>在顶部添加最新{labels.noun}</span>
          </button>
        </div>
      )}
      {section.data.items.map((item, index) => (
        <ItemCard
          key={item.id}
          item={item}
          type={section.type}
          index={index}
          count={section.data.items.length}
          collapsed={collapsedItems.has(item.id)}
          dragging={drag.draggingId === item.id}
          dropEdge={drag.dropTarget?.id === item.id ? drag.dropTarget.edge : undefined}
          onToggle={() => onToggle(item.id)}
          onChange={(patch) => commands.patchItem(section.id, item.id, patch)}
          onMove={(direction) => { commands.moveItem(section.id, item.id, direction); onFocus(`module-item-toggle-${item.id}`) }}
          onDuplicate={() => {
            const copy = commands.duplicateItem(section.id, item.id)
            if (copy) { onExpand(copy.id); onFocus(`module-item-title-${copy.id}`) }
          }}
          onDelete={() => onRemove(section.id, item.id)}
          onDragStart={drag.startDrag}
          onDragKeyDown={drag.handleKeyDown}
        >
          <SubprojectList
            sectionId={section.id}
            sectionType={section.type}
            item={item}
            commands={commands}
            collapsedItems={collapsedItems}
            onToggle={onToggle}
            onExpand={onExpand}
            onRemove={onRemove}
            onFocus={onFocus}
            onAdd={(parentId) => addItem(parentId)}
          />
        </ItemCard>
      ))}
      {section.data.items.length > 0 && (
        <button type="button" className="module-text-button module-add-entry" onClick={() => addItem()} aria-label={`添加${labels.noun}`}>
          <span className="module-add-entry-icon"><Plus size={16} /></span>
          <span>添加{section.type === 'experience' ? '一段工作经历' : section.type === 'education' ? '一段教育经历' : '一个项目'}</span>
          <ChevronRight size={14} />
        </button>
      )}
      <div className="sr-only" role="status" aria-live="polite">{drag.announcement}</div>
      {drag.draggingId && createPortal(
        <div className="module-drag-ghost" data-no-print style={{ transform: `translate3d(${drag.position.x}px,${drag.position.y}px,0)`, width: drag.dragWidth }}>
          <GripVertical size={14} /><span>{drag.dragLabel}</span><small>{drag.dropTarget ? '松开排序' : '松开取消'}</small>
        </div>,
        document.body,
      )}
    </div>
  )
})
