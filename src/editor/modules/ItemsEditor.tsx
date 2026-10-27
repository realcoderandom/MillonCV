import { ChevronRight, Plus } from 'lucide-react'
import type { ItemSection } from '@/resume/model'
import type { ResumeCommands } from '@/resume/commands'
import { ItemCard } from './ItemCard'
import { ITEM_LABELS, MODULE_CONFIG } from './moduleConfig'

interface Props {
  section: ItemSection
  commands: ResumeCommands
  collapsedItems: ReadonlySet<string>
  onToggle: (id: string) => void
  onRemove: (sectionId: string, itemId: string, projectId?: string) => void
  onFocus: (id: string) => void
}

export function ItemsEditor({ section, commands, collapsedItems, onToggle, onRemove, onFocus }: Props) {
  const labels = ITEM_LABELS[section.type]
  const Icon = MODULE_CONFIG[section.type].icon
  const addItem = (parentId?: string) => {
    const item = commands.addItem(section.id, parentId)
    if (item) onFocus(`module-item-title-${item.id}`)
  }
  return <div className="module-items">
    {section.data.items.length === 0 && <div className="module-empty module-empty-entry"><span className="module-empty-icon" aria-hidden="true"><Icon size={23} /></span><div className="module-empty-copy"><h3>添加你的第一条{labels.noun}</h3><p>{labels.emptyHint}</p></div><button type="button" className="module-text-button" onClick={() => addItem()}><Plus size={15} />添加{labels.noun}</button></div>}
    {section.data.items.map((item, index) => <ItemCard key={item.id} item={item} type={section.type} index={index} count={section.data.items.length}
      collapsed={collapsedItems.has(item.id)} onToggle={() => onToggle(item.id)}
      onChange={(patch) => commands.patchItem(section.id, item.id, patch)}
      onMove={(direction) => { commands.moveItem(section.id, item.id, direction); onFocus(`module-item-toggle-${item.id}`) }}
      onDelete={() => onRemove(section.id, item.id)}>
      <div className="module-subprojects">
        {(item.projects ?? []).map((project, projectIndex) => <ItemCard key={project.id} item={project} type="subproject" index={projectIndex} count={item.projects!.length}
          collapsed={collapsedItems.has(project.id)} onToggle={() => onToggle(project.id)}
          onChange={(patch) => commands.patchProject(section.id, item.id, project.id, patch)}
          onMove={(direction) => { commands.moveProject(section.id, item.id, project.id, direction); onFocus(`module-item-toggle-${project.id}`) }}
          onDelete={() => onRemove(section.id, item.id, project.id)} />)}
        <button type="button" className="module-text-button module-add-subproject" onClick={() => addItem(item.id)}><Plus size={14} />添加子项目<span>选填</span></button>
      </div>
    </ItemCard>)}
    {section.data.items.length > 0 && <button type="button" className="module-text-button module-add-entry" onClick={() => addItem()} aria-label={`添加${labels.noun}`}><span className="module-add-entry-icon"><Plus size={16} /></span><span>添加{section.type === 'experience' ? '一段工作经历' : section.type === 'education' ? '一段教育经历' : '一个项目'}</span><ChevronRight size={14} /></button>}
  </div>
}
