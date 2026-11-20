import { uid } from '@/shared/lib/id'
import { SECTION_TYPE_LABELS, type DatedItem, type ItemSection, type Section, type SectionType, type Subproject } from './model'

export function isItemSection(section: Section): section is ItemSection {
  return section.type === 'experience' || section.type === 'education' || section.type === 'projects'
}

export function createSection(type: SectionType): Section {
  const id = uid()
  const title = SECTION_TYPE_LABELS[type]
  switch (type) {
    case 'basics': return {
      id, type, title,
      data: { name: '', title: '', contact: { phone: '', email: '', location: '', website: '', github: '' }, summary: '' },
    }
    case 'experience': case 'education': case 'projects': return { id, type, title, data: { items: [] } }
    case 'skills': return { id, type, title, data: { content: '' } }
    case 'custom': return { id, type, title, data: { title, content: '' } }
  }
}

export function createItem(): DatedItem {
  return { id: uid(), title: '', subtitle: '', description: '' }
}

export function cloneSubproject(project: Subproject): Subproject {
  return { ...project, id: uid() }
}

export function cloneItem(item: DatedItem): DatedItem {
  const { projects, ...rest } = item
  return projects?.length
    ? { ...rest, id: uid(), projects: projects.map(cloneSubproject) }
    : { ...rest, id: uid() }
}

export function moveItem<T extends { id: string }>(items: T[], id: string, direction: -1 | 1): T[] {
  const index = items.findIndex((item) => item.id === id)
  if (index < 0 || !items[index + direction]) return items
  const next = [...items]
  ;[next[index], next[index + direction]] = [next[index + direction], next[index]]
  return next
}

export function placeItem<T extends { id: string }>(items: T[], id: string, targetId: string, edge: 'before' | 'after'): T[] {
  if (id === targetId) return items
  const from = items.findIndex((item) => item.id === id)
  const target = items.findIndex((item) => item.id === targetId)
  if (from < 0 || target < 0) return items
  const next = items.filter((item) => item.id !== id)
  const targetIndex = next.findIndex((item) => item.id === targetId)
  const insertAt = edge === 'before' ? targetIndex : targetIndex + 1
  next.splice(insertAt, 0, items[from])
  return next.every((item, index) => item === items[index]) ? items : next
}
