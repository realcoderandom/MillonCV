import { memo, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { CalendarDays, ChevronDown, GripVertical } from 'lucide-react'
import type { DatedItem, Subproject } from '@/resume/model'
import { inlineToPlain } from '@/resume/markdown/plain'
import { ModuleField } from '../fields/ModuleField'
import { applyPresentDate } from '../fields/formHelpers'
import { ModuleContentActions } from './ModuleContentActions'
import { MarkdownField } from '../fields/MarkdownField'
import { ITEM_LABELS } from './moduleConfig'
import type { ItemDropEdge } from './useItemDrag'

export const ItemCard = memo(function ItemCard({ item, type, index, count, collapsed, dragging, dropEdge, onToggle, onChange, onMove, onDuplicate, onDelete, onDragStart, onDragKeyDown, children }: {
  item: DatedItem; type: keyof typeof ITEM_LABELS; index: number; count: number
  collapsed: boolean; dragging?: boolean; dropEdge?: ItemDropEdge; onToggle: () => void
  onChange: (patch: Partial<Subproject>) => void; onMove: (direction: -1 | 1) => void; onDuplicate: () => void; onDelete: () => void
  onDragStart?: (event: PointerEvent<HTMLButtonElement>, id: string, label: string) => void
  onDragKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, id: string, label: string) => void
  children?: ReactNode
}) {
  const labels = ITEM_LABELS[type]
  const name = item.title || `新${labels.noun}`
  const projectCount = type === 'subproject' ? 0 : (item.projects?.length ?? 0)
  const excerpt = collapsed ? inlineToPlain(item.description.replace(/(?:^|\n)\s*[-*+]\s+/g, ' ').replace(/\n+/g, ' ')) : ''
  const showPresentAction = type !== 'education' && !/至今\s*$/.test(item.rightText ?? '')
  return <section
    className={`module-item${type === 'subproject' ? ' module-subproject' : ''}`}
    data-item-id={item.id}
    data-resume-item={type === 'subproject' ? undefined : item.id}
    data-resume-project={type === 'subproject' ? item.id : undefined}
    data-collapsed={collapsed}
    data-dragging={dragging || undefined}
    data-drop-edge={dropEdge}
    aria-labelledby={`module-item-heading-${item.id}`}
  >
    <div className="module-item-head">
      {count > 1 && onDragStart && (
        <button
          type="button"
          id={`module-item-drag-${item.id}`}
          className="module-item-drag-handle"
          aria-label={`拖动排序${labels.noun}：${name}`}
          title="拖动调整顺序；聚焦后可用上下方向键移动"
          onPointerDown={(event) => onDragStart(event, item.id, name)}
          onKeyDown={(event) => onDragKeyDown?.(event, item.id, name)}
        >
          <GripVertical size={13} />
        </button>
      )}
      <h3 id={`module-item-heading-${item.id}`} className="module-item-heading" aria-label={name}>
        <button id={`module-item-toggle-${item.id}`} type="button" className="module-item-toggle" onClick={onToggle} aria-label={`${collapsed ? '展开' : '收起'}${labels.noun}：${name}`} aria-expanded={!collapsed} aria-controls={`module-item-body-${item.id}`}>
          <span className="module-item-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <span className="module-item-overview"><span className="module-item-name">{name}</span>{(item.subtitle || item.rightText || (collapsed && projectCount > 0)) && <span className="module-item-meta">{item.subtitle && <span>{item.subtitle}</span>}{item.rightText && <span className="module-item-date">{inlineToPlain(item.rightText)}</span>}{collapsed && projectCount > 0 && <span className="module-item-projects">{projectCount} 个子项目</span>}</span>}{excerpt && <span className="module-item-excerpt">{excerpt}</span>}</span>
          <ChevronDown size={15} className="module-item-chevron" />
        </button>
      </h3>
      <ModuleContentActions label={`${labels.noun}：${name}`} index={index} count={count} onMove={onMove} onDuplicate={onDuplicate} onDelete={onDelete} />
    </div>
    <div id={`module-item-body-${item.id}`} className="module-item-body" hidden={collapsed}>
      <ModuleField id={`module-item-title-${item.id}`} field="title" label={labels.title} value={item.title} placeholder={`填写${labels.title}`} onChange={(title) => onChange({ title })} />
      <div className="module-field-grid">
        <ModuleField field="subtitle" label={labels.subtitle} placeholder={labels.subtitlePlaceholder} value={item.subtitle} onChange={(subtitle) => onChange({ subtitle })} />
        <ModuleField
          field="rightText"
          label={labels.rightTextLabel}
          icon={CalendarDays}
          placeholder={labels.rightTextPlaceholder}
          value={item.rightText ?? ''}
          action={showPresentAction ? <button type="button" tabIndex={-1} className="module-field-quick-action" title="快捷设为“至今”" onMouseDown={(event) => event.preventDefault()} onClick={() => onChange({ rightText: applyPresentDate(item.rightText) })}>+ 至今</button> : undefined}
          onChange={(rightText) => onChange({ rightText: rightText || undefined })}
        />
      </div>
      <MarkdownField field="description" label={labels.description} placeholder={labels.placeholder} hint={labels.hint} value={item.description} onChange={(description) => onChange({ description })} />
      {children}
    </div>
  </section>
})
