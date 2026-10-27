import { describe, expect, it } from 'vitest'
import { createSampleResume } from '../../sample'
import { serializeSections } from '../serialize'
import { parseMarkdownToSections } from '../parse'
import { isResumePhoto } from '../../photo'
import { getTemplate } from '@/templates/registry'
import type { ExperienceSection } from '../../model'

const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII='

function sample() {
  const resume = createSampleResume()
  const basics = resume.sections.find((section) => section.type === 'basics')!
  if (basics.type === 'basics') basics.data.photo = PHOTO
  const experience = resume.sections.find((section): section is ExperienceSection => section.type === 'experience')!
  experience.data.items[0].projects = [
    { id: 'child-a', title: '文档检索', subtitle: '核心开发', rightText: '2024 - 2025', description: '- **检索**：实现召回\n  - 增加重排\n\n[源码](https://example.com/code)' },
    { id: 'child-b', title: '任务编排', subtitle: '', description: '设计工作流。\n\n> 保留个人贡献与边界。' },
  ]
  experience.data.items[1].projects = [
    { id: 'child-c', title: '文档检索', subtitle: '', description: '- 另一家公司中的同名项目。' },
  ]
  return resume
}

describe('照片与子项目的 Markdown 协议', () => {
  it('照片、公司说明、多个子项目和下一家公司整体往返无损', () => {
    const { sections } = sample()
    const markdown = serializeSections(sections)
    expect(markdown).toContain(`![证件照](${PHOTO})`)
    expect(markdown).toContain('#### 子项目：文档检索 — 核心开发 || 2024 - 2025')
    expect(parseMarkdownToSections(markdown, sections)).toEqual(sections)
  })

  it('独立导入无需依赖旧数据，重复编辑的 Markdown 保持稳定', () => {
    const markdown = serializeSections(sample().sections)
    let sections = parseMarkdownToSections(markdown)
    for (let index = 0; index < 3; index += 1) {
      const next = parseMarkdownToSections(serializeSections(sections), sections)
      expect(next).toEqual(sections)
      expect(serializeSections(next)).toBe(markdown)
      sections = next
    }
  })

  it('删除照片语法后不从旧数据复活照片，其他正文保留', () => {
    const { sections } = sample()
    const markdown = serializeSections(sections).replace(`![证件照](${PHOTO})\n\n`, '')
    const next = parseMarkdownToSections(markdown, sections)
    const basics = next.find((section) => section.type === 'basics')!
    expect(basics.type === 'basics' && basics.data.photo).toBeUndefined()
    expect(next.filter((section) => section.type !== 'basics')).toEqual(sections.filter((section) => section.type !== 'basics'))
  })

  it('旧版普通 H4 仍解析为同级条目，不会被自动嵌入前一个公司', () => {
    const sections = parseMarkdownToSections('## 工作经历\n### 公司甲 — 工程师\n- 甲工作\n#### 公司乙 — 实习生\n- 乙工作')
    const experience = sections[0] as ExperienceSection
    expect(experience.data.items.map((item) => item.title)).toEqual(['公司甲', '公司乙'])
    expect(experience.data.items.every((item) => item.projects === undefined)).toBe(true)
  })

  it('孤立子项目标题保留为条目，不丢弃内容', () => {
    const sections = parseMarkdownToSections('## 工作经历\n#### 子项目：独立记录\n- 保留内容')
    const item = (sections[0] as ExperienceSection).data.items[0]
    expect(item.title).toBe('子项目：独立记录')
    expect(item.description).toBe('- 保留内容')
  })

  it('子项目可以重新排序和删除，内容不会串入公司说明', () => {
    const resume = sample()
    const previous = structuredClone(resume.sections)
    const section = resume.sections.find((candidate): candidate is ExperienceSection => candidate.type === 'experience')!
    const company = section.data.items[0]
    const description = company.description
    company.projects = company.projects!.slice().reverse()
    const reordered = parseMarkdownToSections(serializeSections(resume.sections), previous)
    expect((reordered.find((candidate) => candidate.type === 'experience') as ExperienceSection).data.items[0].projects!.map((item) => item.id)).toEqual(['child-b', 'child-a'])
    company.projects = [company.projects[0]]
    const deleted = parseMarkdownToSections(serializeSections(resume.sections), previous)
    const next = (deleted.find((candidate) => candidate.type === 'experience') as ExperienceSection).data.items[0]
    expect(next.description).toBe(description)
    expect(next.projects).toHaveLength(1)
    expect(next.projects![0].id).toBe('child-b')
  })

  it('公司内同名子项目保持独立 id，分节改名也保留层级', () => {
    const resume = sample()
    const section = resume.sections.find((candidate): candidate is ExperienceSection => candidate.type === 'experience')!
    section.data.items[0].projects![1].title = '文档检索'
    const markdown = serializeSections(resume.sections).replace('## 工作经历', '## 实习经历')
    const parsed = parseMarkdownToSections(markdown, resume.sections)
    const renamed = parsed.find((candidate): candidate is ExperienceSection => candidate.type === 'experience')!
    expect(renamed.id).toBe(section.id)
    expect(renamed.data.items[0].projects!.map((item) => item.id)).toEqual(['child-a', 'child-b'])
  })

  it('照片只接受受限体积的本地位图', () => {
    expect(isResumePhoto(PHOTO)).toBe(true)
    for (const invalid of ['https://example.com/photo.png', 'blob:temporary', 'data:image/svg+xml;base64,AAAA', `data:image/jpeg;base64,${'A'.repeat(60_000)}`, undefined]) {
      expect(isResumePhoto(invalid)).toBe(false)
    }
  })

  it('技术精简模板的内部标识和显示名保持一致', () => {
    expect(getTemplate('technicalCompact').id).toBe('technicalCompact')
    expect(getTemplate('technicalCompact').label).toBe('技术精简')
  })
})
