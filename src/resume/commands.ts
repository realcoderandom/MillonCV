import type { BasicsData, Contact, DatedItem, Resume, ResumeLayout, Section, SectionType, Subproject } from './model'
import { SECTION_TYPE_LABELS } from './model'
import { createItem, createSection, isItemSection, moveItem as moveById } from './sections'
import { orderSections } from './layout'
import { uid } from '@/shared/lib/id'

export interface ContentUndo {
  id: string
  label: string
  restore: () => void
}

interface CommandState {
  resumes: readonly Resume[]
  setSections: (id: string, update: (sections: Section[]) => Section[]) => void
  setLayout: (id: string, layout: ResumeLayout | undefined) => void
}

interface Removal {
  undo: ContentUndo
  focusId?: string
}

function updateById<T extends { id: string }>(items: T[], id: string, update: (item: T) => T): T[] {
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) return items
  const nextItem = update(items[index])
  if (nextItem === items[index]) return items
  const next = [...items]
  next[index] = nextItem
  return next
}

function restoreAt<T extends { id: string }>(items: T[], item: T, index: number): T[] {
  return items.some((candidate) => candidate.id === item.id) ? items : [...items.slice(0, index), item, ...items.slice(index)]
}

// 命令绑定简历 id，每次读取最新状态；不订阅 React，也不操作焦点或 DOM。
export function createResumeCommands(resumeId: string, getState: () => CommandState) {
  const currentResume = () => getState().resumes.find((resume) => resume.id === resumeId)
  const updateSection = (id: string, update: (section: Section) => Section) => {
    getState().setSections(resumeId, (sections) => updateById(sections, id, update))
  }
  const updateItems = (id: string, update: (items: DatedItem[]) => DatedItem[]) => updateSection(id, (section) => {
    if (!isItemSection(section)) return section
    const items = update(section.data.items)
    return items === section.data.items ? section : { ...section, data: { ...section.data, items } }
  })
  const updateItem = (sectionId: string, id: string, update: (item: DatedItem) => DatedItem) => updateItems(sectionId, (items) => updateById(items, id, update))
  const updateProjects = (sectionId: string, itemId: string, update: (items: Subproject[]) => Subproject[]) => updateItem(sectionId, itemId, (item) => {
    const previous = item.projects ?? []
    const projects = update(previous)
    if (projects === previous) return item
    const { projects: _previous, ...rest } = item
    return projects.length ? { ...rest, projects } : rest
  })

  const removeSection = (sectionId: string): Removal | undefined => {
    const current = currentResume()
    if (!current) return
    const index = current.sections.findIndex((section) => section.id === sectionId)
    const removed = current.sections[index]
    if (!removed || removed.type === 'basics') return
    const displayed = orderSections(current.sections, current.layout?.order)
    const displayIndex = displayed.findIndex((section) => section.id === sectionId)
    const neighbor = displayed[displayIndex + 1] ?? displayed[displayIndex - 1]
    const previousLayout = current.layout
    getState().setSections(resumeId, (sections) => sections.filter((section) => section.id !== sectionId))
    return { focusId: neighbor?.id, undo: {
      id: uid(), label: removed.title || SECTION_TYPE_LABELS[removed.type],
      restore: () => {
        const current = currentResume()
        if (!current || current.sections.some((section) => section.id === removed.id)) return
        getState().setSections(resumeId, (sections) => restoreAt(sections, removed, index))
        const latest = currentResume()
        if (!latest || !(previousLayout || latest.layout)) return
        const order = orderSections(latest.sections, latest.layout?.order).map((section) => section.id).filter((id) => id !== removed.id)
        order.splice(Math.min(displayIndex, order.length), 0, removed.id)
        const region = previousLayout?.regions?.[removed.id]
        getState().setLayout(resumeId, { ...latest.layout, order, regions: { ...latest.layout?.regions, ...(region ? { [removed.id]: region } : {}) } })
      },
    } }
  }

  const removeItem = (sectionId: string, itemId: string, projectId?: string): Removal | undefined => {
    const section = currentResume()?.sections.find((section) => section.id === sectionId)
    if (!section || !isItemSection(section)) return
    const index = section.data.items.findIndex((item) => item.id === itemId)
    const item = section.data.items[index]
    if (!item) return
    if (projectId) {
      const projects = item.projects ?? []
      const projectIndex = projects.findIndex((project) => project.id === projectId)
      const project = projects[projectIndex]
      if (!project) return
      updateProjects(sectionId, itemId, (values) => values.filter((value) => value.id !== projectId))
      return { focusId: (projects[projectIndex + 1] ?? projects[projectIndex - 1])?.id ?? itemId, undo: {
        id: uid(), label: project.title || '子项目',
        restore: () => updateProjects(sectionId, itemId, (values) => restoreAt(values, project, projectIndex)),
      } }
    }
    updateItems(sectionId, (items) => items.filter((item) => item.id !== itemId))
    return { focusId: (section.data.items[index + 1] ?? section.data.items[index - 1])?.id, undo: {
      id: uid(), label: item.title || '条目',
      restore: () => updateItems(sectionId, (items) => restoreAt(items, item, index)),
    } }
  }

  return {
    currentResume,
    removeSection,
    removeItem,
    addSection(type: SectionType) {
      const current = currentResume()
      if (!current || (type === 'basics' && current.sections.some((section) => section.type === 'basics'))) return
      const section = createSection(type)
      getState().setSections(resumeId, (sections) => type === 'basics' ? [section, ...sections] : [...sections, section])
      return section
    },
    addItem(sectionId: string, parentId?: string) {
      const section = currentResume()?.sections.find((section) => section.id === sectionId)
      if (!section || !isItemSection(section) || (parentId && !section.data.items.some((item) => item.id === parentId))) return
      const item = createItem()
      if (parentId) updateProjects(sectionId, parentId, (projects) => [...projects, item])
      else updateItems(sectionId, (items) => [...items, item])
      return item
    },
    renameSection(sectionId: string, title: string) {
      updateSection(sectionId, (section) => section.type === 'custom'
        ? { ...section, title, data: { ...section.data, title } }
        : { ...section, title })
    },
    patchBasics(sectionId: string, patch: Partial<Omit<BasicsData, 'photo' | 'contact'>>) {
      updateSection(sectionId, (section) => section.type === 'basics' ? { ...section, data: { ...section.data, ...patch } } : section)
    },
    patchContact(sectionId: string, patch: Partial<Contact>) {
      updateSection(sectionId, (section) => section.type === 'basics'
        ? { ...section, data: { ...section.data, contact: { ...section.data.contact, ...patch } } }
        : section)
    },
    setContent(sectionId: string, content: string) {
      updateSection(sectionId, (section) => {
        switch (section.type) {
          case 'skills': return { ...section, data: { ...section.data, content } }
          case 'custom': return { ...section, data: { ...section.data, content } }
          default: return section
        }
      })
    },
    patchItem(sectionId: string, itemId: string, patch: Partial<Subproject>) {
      updateItem(sectionId, itemId, (item) => ({ ...item, ...patch }))
    },
    patchProject(sectionId: string, itemId: string, projectId: string, patch: Partial<Subproject>) {
      updateProjects(sectionId, itemId, (projects) => updateById(projects, projectId, (project) => ({ ...project, ...patch })))
    },
    moveItem(sectionId: string, itemId: string, direction: -1 | 1) {
      updateItems(sectionId, (items) => moveById(items, itemId, direction))
    },
    moveProject(sectionId: string, itemId: string, projectId: string, direction: -1 | 1) {
      updateProjects(sectionId, itemId, (projects) => moveById(projects, projectId, direction))
    },
  }
}

export type ResumeCommands = ReturnType<typeof createResumeCommands>
