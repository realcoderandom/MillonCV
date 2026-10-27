// 分节布局只影响预览：正文仍以原始 sections 为唯一数据源。
import type { ResumeLayout, Section, SectionRegion, SectionType } from './model'

export const MIN_SIDEBAR_WIDTH = 24
export const MAX_SIDEBAR_WIDTH = 45

export function clampSidebarWidth(value: number): number {
  return Number.isFinite(value)
    ? Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value))
    : 32
}

// 新增分节自动追加，过期或重复的 id 不会导致内容遗漏或重复显示。
export function orderSections(sections: Section[], order?: string[]): Section[] {
  if (!order?.length) return sections
  const byId = new Map(sections.map((section) => [section.id, section]))
  const ordered: Section[] = []
  for (const id of order) {
    const section = byId.get(id)
    if (!section) continue
    ordered.push(section)
    byId.delete(id)
  }
  for (const section of sections) {
    if (byId.delete(section.id)) ordered.push(section)
  }
  return ordered
}

export function getSectionRegion(
  section: Section,
  layout: ResumeLayout | undefined,
  sidebarTypes: readonly SectionType[],
): SectionRegion {
  const region = layout?.regions?.[section.id]
  if (region === 'main' || region === 'sidebar') return region
  return sidebarTypes.includes(section.type) ? 'sidebar' : 'main'
}

export function splitSections(
  sections: Section[],
  layout: ResumeLayout | undefined,
  sidebarTypes: readonly SectionType[],
): { main: Section[]; sidebar: Section[] } {
  const main: Section[] = []
  const sidebar: Section[] = []
  for (const section of orderSections(sections, layout?.order)) {
    const region = getSectionRegion(section, layout, sidebarTypes)
    ;(region === 'sidebar' ? sidebar : main).push(section)
  }
  return { main, sidebar }
}

export interface SectionPlacement {
  sectionId?: string
  edge: 'before' | 'after'
  region?: SectionRegion
}

// 先移除再按相邻分节插入，避免向下拖动时因索引偏移而多移一位。
export function placeLayoutSection(
  sections: Section[],
  layout: ResumeLayout | undefined,
  sectionId: string,
  placement: SectionPlacement,
): ResumeLayout | undefined {
  const ordered = orderSections(sections, layout?.order)
  if (!ordered.some((section) => section.id === sectionId)
    || placement.sectionId === sectionId
    || (placement.sectionId && !ordered.some((section) => section.id === placement.sectionId))) return layout
  const order = ordered.map((section) => section.id).filter((id) => id !== sectionId)
  const index = placement.sectionId
    ? order.indexOf(placement.sectionId) + (placement.edge === 'after' ? 1 : 0)
    : order.length
  order.splice(index, 0, sectionId)
  const sameOrder = order.every((id, position) => id === ordered[position].id)
  if (sameOrder && (!placement.region || layout?.regions?.[sectionId] === placement.region)) return layout
  return {
    ...layout,
    order,
    ...(placement.region ? { regions: { ...layout?.regions, [sectionId]: placement.region } } : {}),
  }
}

// hydrate / 显式修改布局时收敛到有效配置；旧文档无需迁移即可使用模板默认布局。
export function normalizeResumeLayout(
  layout: ResumeLayout | undefined,
  sections: Section[],
): ResumeLayout | undefined {
  if (!layout || typeof layout !== 'object') return undefined
  const ids = new Set(sections.map((section) => section.id))
  const normalized: ResumeLayout = {}
  if (Array.isArray(layout.order)) {
    const order = [...new Set(layout.order.filter((id) => ids.has(id)))]
    if (order.length) normalized.order = order
  }
  if (layout.regions && typeof layout.regions === 'object') {
    const regions = Object.fromEntries(
      Object.entries(layout.regions).filter(
        ([id, region]) => ids.has(id) && (region === 'main' || region === 'sidebar'),
      ),
    ) as Record<string, SectionRegion>
    if (Object.keys(regions).length) normalized.regions = regions
  }
  if (typeof layout.sidebarWidth === 'number' && Number.isFinite(layout.sidebarWidth)) {
    normalized.sidebarWidth = clampSidebarWidth(layout.sidebarWidth)
  }
  return Object.keys(normalized).length ? normalized : undefined
}
