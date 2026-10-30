import { describe, expect, it } from 'vitest'
import { createSampleResume } from '@/resume/sample'
import { migrateResumeState, RESUME_STORAGE_VERSION } from '../resumeMigrations'
import { normalizeStoredResume } from '../resumeNormalization'
import type { StoredResume, StoredResumeState } from '../types'

describe('存储版本与读取规范化', () => {
  it('v1 字段在主文档、快照、删除记录及解析撤销中一起迁移，原始输入不变', () => {
    const item = {
      id: 'legacy-project', title: '旧项目', subtitle: '开发', description: '- 完成开发',
      start: '2020', end: '2022', techStack: ' TypeScript ', summary: ' 项目简介 ', fieldOrder: ['summary', 'techStack'],
    }
    const resume: StoredResume = {
      ...createSampleResume(), template: 'asu', sections: [
        { id: 'projects', type: 'projects', title: '项目经历', data: { items: [item] } },
        { id: 'custom', type: 'custom', title: '项目经历', data: { title: '项目经历', content: '自定义正文' } },
      ],
    }
    const snapshot = { id: 'snapshot', createdAt: 1, resume }
    const stored: Partial<StoredResumeState> = {
      resumes: [resume], snapshots: { [resume.id]: [snapshot] },
      lastDeleted: { resume, snapshots: [snapshot], index: 0, deletedAt: 2 },
      parseNotice: { id: 'notice', resumeId: resume.id, previousSections: resume.sections, diagnostics: [] },
    }
    const before = structuredClone(stored)
    const migrated = migrateResumeState(stored, 1)
    const sectionLists = [
      migrated.resumes![0].sections, migrated.snapshots![resume.id][0].resume.sections,
      migrated.lastDeleted!.resume.sections, migrated.lastDeleted!.snapshots![0].resume.sections,
      migrated.parseNotice!.previousSections,
    ]
    for (const sections of sectionLists) {
      expect(sections[0]).toEqual({ id: 'projects', type: 'projects', title: '项目经验', data: { items: [{
        id: 'legacy-project', title: '旧项目', subtitle: '开发', rightText: '2020 - 2022',
        description: '项目简介\n\n**技术栈**：TypeScript\n\n- 完成开发',
      }] } })
      expect(sections[1]).toEqual(resume.sections[1])
    }
    expect(stored).toEqual(before)
    expect(migrateResumeState(migrated, RESUME_STORAGE_VERSION)).toBe(migrated)
  })

  it('读取边界统一模板别名与未知值，保留旧主题、布局和未来模板覆盖', () => {
    const original = createSampleResume()
    const raw: StoredResume = {
      ...original, template: 'future-template', theme: { fontSize: 18, primaryColor: '#123456' },
      templateThemeOverrides: { asu: { fontSize: 12 }, technicalCompact: { fontSize: 15 }, 'future-template': { fontSize: 17 } },
      layout: { order: ['missing', original.sections[0].id], sidebarWidth: 38 },
    }
    const normalized = normalizeStoredResume(raw)
    expect(normalized.template).toBe('classic')
    expect(normalized.theme).toMatchObject({ fontSize: 18, primaryColor: '#123456', lineHeight: 1.6 })
    expect(normalized.templateThemeOverrides).toEqual({ technicalCompact: { fontSize: 15 }, 'future-template': { fontSize: 17 } })
    expect(normalized.layout).toEqual({ order: [original.sections[0].id], sidebarWidth: 38 })
    expect(normalized.sections).toBe(raw.sections)
    expect(normalizeStoredResume({ ...raw, template: 'asu' }).template).toBe('technicalCompact')
    expect(raw.template).toBe('future-template')
  })

  it.each([
    { data: { groups: [] }, content: '' },
    { data: { content: null, groups: [{ id: 'tools', category: '工具', items: ['Git\n熟练使用'] }] }, content: '**工具**\n- Git\n  熟练使用' },
    { data: { content: '', groups: [{ id: 'old', category: '旧技能', items: ['已删除'] }] }, content: '' },
    { data: { content: '已编辑的 Markdown', groups: [{ id: 'old', category: '旧技能', items: ['旧内容'] }] }, content: '已编辑的 Markdown' },
  ])('旧技能迁移保留空分组、多行内容及已保存的正文：$content', ({ data, content }) => {
    const stored = { resumes: [{ ...createSampleResume(), sections: [{ id: 'skills', type: 'skills', title: '专业能力', data }] }] }
    const before = structuredClone(stored)
    const migrated = migrateResumeState(stored, 10)
    expect(migrated.resumes![0].sections[0]).toMatchObject({ id: 'skills', type: 'skills', title: '专业能力', data: { content } })
    expect(stored).toEqual(before)
    expect(migrateResumeState(migrated, RESUME_STORAGE_VERSION)).toBe(migrated)
  })
})
