import { describe, expect, it } from 'vitest'
import type { ResumeLayout, Section } from '../model'
import {
  clampSidebarWidth,
  normalizeResumeLayout,
  orderSections,
  placeLayoutSection,
  splitSections,
} from '../layout'

const sections: Section[] = [
  { id: 'skills-a', type: 'skills', title: '专业技能', data: { content: '- React' } },
  { id: 'experience', type: 'experience', title: '工作经历', data: { items: [] } },
  { id: 'skills-b', type: 'skills', title: '语言技能', data: { content: '- 英语' } },
  { id: 'education', type: 'education', title: '教育背景', data: { items: [] } },
]

describe('简历分节布局', () => {
  it('未配置时保留正文顺序，并使用各模板的默认侧栏分节', () => {
    expect(orderSections(sections)).toBe(sections)
    const modern = splitSections(sections, undefined, ['basics', 'skills'])
    const twoColumn = splitSections(sections, undefined, ['basics', 'skills', 'education'])
    expect(modern.sidebar.map((s) => s.id)).toEqual(['skills-a', 'skills-b'])
    expect(modern.main.map((s) => s.id)).toEqual(['experience', 'education'])
    expect(twoColumn.sidebar.map((s) => s.id)).toEqual(['skills-a', 'skills-b', 'education'])
  })

  it('同类型分节可以分别放在主栏与侧栏，移动后每个分节仍只出现一次', () => {
    const layout: ResumeLayout = {
      order: ['education', 'skills-b', 'experience', 'skills-a'],
      regions: { 'skills-a': 'main', education: 'sidebar', experience: 'sidebar' },
    }
    const resolved = splitSections(sections, layout, ['skills'])
    expect(resolved.sidebar.map((s) => s.id)).toEqual(['education', 'skills-b', 'experience'])
    expect(resolved.main.map((s) => s.id)).toEqual(['skills-a'])
    expect(new Set([...resolved.main, ...resolved.sidebar].map((s) => s.id)).size).toBe(4)
    expect(sections.map((s) => s.id)).toEqual(['skills-a', 'experience', 'skills-b', 'education'])
  })

  it('分节增删后忽略失效或重复引用，新分节仍然显示', () => {
    const ordered = orderSections(sections, ['deleted', 'education', 'education', 'skills-a'])
    expect(ordered.map((s) => s.id)).toEqual(['education', 'skills-a', 'experience', 'skills-b'])
    expect(ordered[0]).toBe(sections[3])
  })

  it('全部分节移动到同一栏时不遗漏内容', () => {
    const regions = Object.fromEntries(sections.map((s) => [s.id, 'main' as const]))
    const { main, sidebar } = splitSections(sections, { regions }, ['skills', 'education'])
    expect(sidebar).toEqual([])
    expect(main).toEqual(sections)
  })

  it('清理失效的分节配置，并限制侧栏宽度', () => {
    expect(normalizeResumeLayout({
      order: ['deleted', 'skills-a', 'skills-a'],
      regions: { deleted: 'sidebar', 'skills-a': 'main' },
      sidebarWidth: 80,
    }, sections)).toEqual({
      order: ['skills-a'],
      regions: { 'skills-a': 'main' },
      sidebarWidth: 45,
    })
    expect(clampSidebarWidth(10)).toBe(24)
    expect(clampSidebarWidth(34)).toBe(34)
    expect(normalizeResumeLayout({ sidebarWidth: Number.NaN }, sections)).toBeUndefined()
    expect(normalizeResumeLayout({ order: ['deleted'] }, sections)).toBeUndefined()
    expect(normalizeResumeLayout(undefined, sections)).toBeUndefined()
  })

  it('向下拖动先移除原位置，向上拖动准确插入相邻模块前', () => {
    const down = placeLayoutSection(sections, undefined, 'skills-a', { sectionId: 'skills-b', edge: 'after' })
    expect(orderSections(sections, down?.order).map((section) => section.id)).toEqual(['experience', 'skills-b', 'skills-a', 'education'])
    const up = placeLayoutSection(sections, undefined, 'education', { sectionId: 'experience', edge: 'before' })
    expect(up?.order).toEqual(['skills-a', 'education', 'experience', 'skills-b'])
    expect(sections.map((section) => section.id)).toEqual(['skills-a', 'experience', 'skills-b', 'education'])
  })

  it('跨栏插入同时更新归属与顺序，保留栏宽和其他模块配置', () => {
    const layout: ResumeLayout = { sidebarWidth: 36, regions: { 'skills-b': 'main' } }
    const moved = placeLayoutSection(sections, layout, 'education', { sectionId: 'skills-a', edge: 'after', region: 'sidebar' })
    expect(moved).toEqual({ sidebarWidth: 36, regions: { 'skills-b': 'main', education: 'sidebar' }, order: ['skills-a', 'education', 'experience', 'skills-b'] })
    const groups = splitSections(sections, moved, ['skills'])
    expect(groups.sidebar.map((section) => section.id)).toEqual(['skills-a', 'education'])
    expect(groups.main.map((section) => section.id)).toEqual(['experience', 'skills-b'])
    expect(layout).toEqual({ sidebarWidth: 36, regions: { 'skills-b': 'main' } })
  })

  it('可以将模块拖入空栏，每个模块恰好显示一次', () => {
    const layout: ResumeLayout = { regions: Object.fromEntries(sections.map((section) => [section.id, 'main' as const])) }
    const moved = placeLayoutSection(sections, layout, 'skills-a', { edge: 'after', region: 'sidebar' })
    const groups = splitSections(sections, moved, [])
    expect(groups.sidebar).toEqual([sections[0]])
    expect(groups.main).toEqual(sections.slice(1))
    expect(new Set(moved?.order).size).toBe(sections.length)
  })

  it('单栏排序不清除双栏模板的归属和宽度偏好', () => {
    const layout: ResumeLayout = { regions: { experience: 'sidebar' }, sidebarWidth: 40 }
    const moved = placeLayoutSection(sections, layout, 'education', { sectionId: 'skills-a', edge: 'before' })
    expect(moved?.regions).toEqual(layout.regions)
    expect(moved?.sidebarWidth).toBe(40)
    expect(moved?.order?.[0]).toBe('education')
  })

  it('失效目标、原位放下与自身定位不会改写布局', () => {
    const layout: ResumeLayout = { sidebarWidth: 32 }
    expect(placeLayoutSection(sections, layout, 'missing', { edge: 'after' })).toBe(layout)
    expect(placeLayoutSection(sections, layout, 'skills-a', { sectionId: 'removed', edge: 'before' })).toBe(layout)
    expect(placeLayoutSection(sections, layout, 'skills-a', { sectionId: 'skills-a', edge: 'after' })).toBe(layout)
    expect(placeLayoutSection(sections, layout, 'skills-a', { sectionId: 'experience', edge: 'before' })).toBe(layout)
  })
})
