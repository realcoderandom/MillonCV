import type { Resume } from './model'

export type ResumeField = 'heading' | 'name' | 'title' | 'workExperience' | 'photo' | 'phone' | 'email' | 'location' | 'website' | 'github' | 'summary' | 'subtitle' | 'rightText' | 'description' | 'content'

// 定位只属于工作区交互，不写入简历正文、历史快照或导出文件。
export interface ResumeTarget {
  resumeId: string
  sectionId: string
  itemId?: string
  projectId?: string
  field?: ResumeField
}

export interface ResumeFocusRequest {
  target: ResumeTarget
  sequence: number
}

/** 删除、切版本或解析重建之后，旧定位只能退回仍存在的父级。 */
export function resolveResumeTarget(resume: Resume, target: ResumeTarget | null): ResumeTarget | null {
  if (!target || target.resumeId !== resume.id) return null
  const section = resume.sections.find((candidate) => candidate.id === target.sectionId)
  if (!section) return null
  const result: ResumeTarget = { resumeId: resume.id, sectionId: section.id }
  if (target.itemId) {
    if (!('items' in section.data)) return result
    const item = section.data.items.find((candidate) => candidate.id === target.itemId)
    if (!item) return result
    result.itemId = item.id
    if (target.projectId) {
      const project = item.projects?.find((candidate) => candidate.id === target.projectId)
      if (!project) return result
      result.projectId = project.id
    }
    if (target.field && ['title', 'subtitle', 'rightText', 'description'].includes(target.field)) result.field = target.field
  } else if (target.field === 'heading'
    || (section.type === 'basics' && ['name', 'title', 'workExperience', 'photo', 'phone', 'email', 'location', 'website', 'github', 'summary'].includes(target.field ?? ''))
    || ((section.type === 'skills' || section.type === 'custom') && target.field === 'content')) {
    result.field = target.field
  }
  return result
}

export function readResumeTarget(element: Element, root: HTMLElement, resumeId: string): ResumeTarget | null {
  const section = element.closest<HTMLElement>('[data-resume-section]')
  if (!section || !root.contains(section)) return null
  const item = element.closest<HTMLElement>('[data-resume-item]')
  const project = element.closest<HTMLElement>('[data-resume-project]')
  const field = element.closest<HTMLElement>('[data-resume-field]')
  return {
    resumeId,
    sectionId: section.dataset.resumeSection!,
    ...(item && section.contains(item) ? { itemId: item.dataset.resumeItem } : {}),
    ...(project && section.contains(project) ? { projectId: project.dataset.resumeProject } : {}),
    ...(field && section.contains(field) ? { field: field.dataset.resumeField as ResumeField } : {}),
  }
}

export function findResumeTarget(root: HTMLElement, target: ResumeTarget): HTMLElement | null {
  // 同一模块可能拆到多页，不能只在第一页的片段中查找后续条目。
  const sections = Array.from(root.querySelectorAll<HTMLElement>(`[data-resume-section="${CSS.escape(target.sectionId)}"]`))
  let fallback = sections[0] ?? null
  for (const section of sections) {
    let scope = section
    if (target.itemId) {
      const item = scope.querySelector<HTMLElement>(`[data-resume-item="${CSS.escape(target.itemId)}"]`)
      if (!item) continue
      scope = item
    }
    if (target.projectId) {
      const project = scope.querySelector<HTMLElement>(`[data-resume-project="${CSS.escape(target.projectId)}"]`)
      if (!project) continue
      scope = project
    }
    fallback = scope
    if (!target.field) return scope
    const field = Array.from(scope.querySelectorAll<HTMLElement>(`[data-resume-field="${target.field}"]`)).find((candidate) => {
      const location = readResumeTarget(candidate, root, target.resumeId)
      return location?.itemId === target.itemId && location?.projectId === target.projectId
    })
    if (field) return field
  }
  return fallback
}

/** 只滚动指定面板，避免 scrollIntoView 连带移动另一栏或页面。 */
export function scrollToResumeTarget(container: HTMLElement, element: HTMLElement) {
  let elementTop = element.getBoundingClientRect().top
  let view = element.ownerDocument.defaultView
  // 分页文档位于 iframe 中，要计入预览缩放与 iframe 在外层滚动面板的位置。
  while (view?.frameElement) {
    const frame = view.frameElement as HTMLElement
    const bounds = frame.getBoundingClientRect()
    const width = parseFloat(getComputedStyle(frame).width)
    elementTop = bounds.top + elementTop * (width ? bounds.width / width : 1)
    view = frame.ownerDocument.defaultView
  }
  const top = container.scrollTop + elementTop - container.getBoundingClientRect().top - 24
  container.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}
