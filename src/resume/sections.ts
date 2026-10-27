import { uid } from '@/shared/lib/id'
import { SECTION_TYPE_LABELS, type DatedItem, type ItemSection, type Section, type SectionType } from './model'

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

export function moveItem<T extends { id: string }>(items: T[], id: string, direction: -1 | 1): T[] {
  const index = items.findIndex((item) => item.id === id)
  if (index < 0 || !items[index + direction]) return items
  const next = [...items]
  ;[next[index], next[index + direction]] = [next[index + direction], next[index]]
  return next
}
