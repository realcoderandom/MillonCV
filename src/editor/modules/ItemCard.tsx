import type { ReactNode } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import type { Subproject } from '@/resume/model'
import { inlineToPlain } from '@/resume/markdown/plain'
import { ModuleField } from '../fields/ModuleField'
import { ModuleContentActions } from './ModuleContentActions'
import { MarkdownField } from '../fields/MarkdownField'
import { ITEM_LABELS } from './moduleConfig'

export function ItemCard({ item, type, index, count, collapsed, onToggle, onChange, onMove, onDelete, children }: {
  item: Subproject; type: keyof typeof ITEM_LABELS; index: number; count: number
  collapsed: boolean; onToggle: () => void
  onChange: (patch: Partial<Subproject>) => void; onMove: (direction: -1 | 1) => void; onDelete: () => void; children?: ReactNode
}) {
  const labels = ITEM_LABELS[type]
  const name = item.title || `新${labels.noun}`
  const excerpt = collapsed ? inlineToPlain(item.description.replace(/(?:^|\n)\s*[-*+]\s+/g, ' ').replace(/\n+/g, ' ')) : ''
  return <section className={`module-item${type === 'subproject' ? ' module-subproject' : ''}`} data-item-id={item.id} data-resume-item={type === 'subproject' ? undefined : item.id} data-resume-project={type === 'subproject' ? item.id : undefined} data-collapsed={collapsed} aria-labelledby={`module-item-heading-${item.id}`}>
    <div className="module-item-head">
      <h3 id={`module-item-heading-${item.id}`} className="module-item-heading" aria-label={name}>
        <button id={`module-item-toggle-${item.id}`} type="button" className="module-item-toggle" onClick={onToggle} aria-label={`${collapsed ? '展开' : '收起'}${labels.noun}：${name}`} aria-expanded={!collapsed} aria-controls={`module-item-body-${item.id}`}>
          <span className="module-item-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <span className="module-item-overview"><span className="module-item-name">{name}</span>{(item.subtitle || item.rightText) && <span className="module-item-meta">{item.subtitle && <span>{item.subtitle}</span>}{item.rightText && <span className="module-item-date">{inlineToPlain(item.rightText)}</span>}</span>}{excerpt && <span className="module-item-excerpt">{excerpt}</span>}</span>
          <ChevronDown size={15} className="module-item-chevron" />
        </button>
      </h3>
      <ModuleContentActions label={`${labels.noun}：${name}`} index={index} count={count} onMove={onMove} onDelete={onDelete} />
    </div>
    <div id={`module-item-body-${item.id}`} className="module-item-body" hidden={collapsed}>
      <ModuleField id={`module-item-title-${item.id}`} field="title" label={labels.title} value={item.title} placeholder={`填写${labels.title}`} onChange={(title) => onChange({ title })} />
      <div className="module-field-grid">
        <ModuleField field="subtitle" label={labels.subtitle} placeholder={labels.subtitlePlaceholder} value={item.subtitle} onChange={(subtitle) => onChange({ subtitle })} />
        <ModuleField field="rightText" label="时间 / 补充信息" icon={CalendarDays} placeholder="2023.06 — 至今" value={item.rightText ?? ''} onChange={(rightText) => onChange({ rightText: rightText || undefined })} />
      </div>
      <MarkdownField field="description" label={labels.description} placeholder={labels.placeholder} hint={labels.hint} value={item.description} onChange={(description) => onChange({ description })} />
      {children}
    </div>
  </section>
}
