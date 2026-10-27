import { describe, expect, it } from 'vitest'
import { createSection, createItem } from '../../sections'
import { createSampleResume } from '../../sample'
import { parseMarkdownToSections, parseMarkdownWithDiagnostics } from '../parse'
import { serializeSections } from '../serialize'
import { parseHeadingMetadata, serializeHeadingMetadata } from '../metadata'
import type { Section, SectionType } from '../../model'

describe('模块编辑的 Markdown 往返', () => {
  it('自定义所有模块标题后，类型、id、正文及层级独立导入仍保持一致', () => {
    const sections = createSampleResume().sections.map((section, index) => {
      const title = ['我的名片', '成长足迹', '工具箱', '代表作品', '学习之路', '项目经历'][index]
      return section.type === 'custom' ? { ...section, title, data: { ...section.data, title } } : { ...section, title }
    })
    expect(parseMarkdownToSections(serializeSections(sections))).toEqual(sections)
    expect(parseMarkdownWithDiagnostics(serializeSections(sections), sections).diagnostics).toEqual([])
  })

  it('六种空模块、空标题与尚未填写的条目都不会在切换中消失', () => {
    const types: SectionType[] = ['basics', 'experience', 'education', 'projects', 'skills', 'custom']
    const sections = types.map((type) => {
      const section = createSection(type)
      section.title = ''
      if ('items' in section.data) section.data.items = [createItem()]
      if (section.type === 'custom') section.data.title = ''
      return section
    })
    let next = sections
    for (let index = 0; index < 3; index += 1) {
      next = parseMarkdownToSections(serializeSections(next), next)
      expect(next).toEqual(sections)
    }
  })

  it('显式空自定义章节也从普通 Markdown 中保留', () => {
    expect(parseMarkdownToSections('## 证书\n\n## 技能')[0]).toMatchObject({ type: 'custom', title: '证书', data: { content: '' } })
  })

  it('在源码中改标题和正文后保持模块类型，删除正文后保留空模块', () => {
    const section = createSection('experience')
    if (section.type !== 'experience') throw new Error('wrong type')
    section.data.items = [{ ...createItem(), title: 'Acme', description: '- 旧内容' }]
    const markdown = serializeSections([section]).replace('## 工作经历', '## 我的故事').replace('- 旧内容', '- 新内容')
    const result = parseMarkdownWithDiagnostics(markdown, [section])
    expect(result.sections[0]).toMatchObject({ id: section.id, type: 'experience', title: '我的故事', data: { items: [{ description: '- 新内容' }] } })
    expect(result.diagnostics).toEqual([])
    const empty = markdown.slice(0, markdown.indexOf('<!-- resume:{"kind":"item"'))
    expect(parseMarkdownToSections(empty, result.sections)[0]).toMatchObject({ type: 'experience', title: '我的故事', data: { items: [] } })
  })

  it('同名模块和同名条目重排、改名、改正文后仍保留独立 id', () => {
    const first = createSection('experience')
    const second = createSection('experience')
    if (first.type !== 'experience' || second.type !== 'experience') throw new Error('wrong type')
    first.title = second.title = '同名模块'
    first.data.items = [{ ...createItem(), title: 'Acme' }, { ...createItem(), title: 'Acme' }]
    second.data.items = [{ ...createItem(), title: 'Acme' }]
    const previous = structuredClone([first, second])
    first.data.items.reverse()
    first.data.items[0].title = '改名公司'
    first.data.items[0].description = '- 更新说明'
    const next = [second, first]
    expect(parseMarkdownToSections(serializeSections(next), previous)).toEqual(next)
  })

  it('复制同一段源码不产生重复的模块、条目或子项目 id', () => {
    const section = createSection('experience')
    if (section.type !== 'experience') throw new Error('wrong type')
    section.data.items = [{ ...createItem(), title: 'Acme', projects: [{ ...createItem(), title: '项目甲' }] }]
    const markdown = serializeSections([section])
    const result = parseMarkdownToSections(`${markdown}\n\n${markdown}`, [section])
    const ids = result.flatMap((current) => [current.id, ...('items' in current.data ? current.data.items.flatMap((item) => [item.id, ...(item.projects ?? []).map((project) => project.id)]) : [])])
    expect(new Set(ids).size).toBe(ids.length)
    expect(result).toHaveLength(2)
  })

  it('前面插入无标记的同名模块不会抢走后面显式模块的 id', () => {
    const section = createSection('skills')
    const next = parseMarkdownToSections(`## 技能\n\n新增内容\n\n${serializeSections([section])}`, [section])
    expect(next[1].id).toBe(section.id)
    expect(next[0].id).not.toBe(section.id)
  })

  it('简介、技能和自定义内容中的多段文字、列表与嵌套引用完整保留', () => {
    const content = '第一段 **重点**。\n\n- 贡献一\n  - 细节\n- [贡献二](https://example.com)\n\n> 补充说明'
    const sections: Section[] = [createSection('basics'), createSection('skills'), createSection('custom')]
    for (const section of sections) {
      if (section.type === 'basics') section.data.summary = content
      if (section.type === 'skills' || section.type === 'custom') section.data.content = content
    }
    expect(parseMarkdownToSections(serializeSections(sections))).toEqual(sections)
  })

  it('标记严格验证类型并转义注释终止符', () => {
    const metadata = { kind: 'section' as const, type: 'basics' as const, id: 'a', title: '--><script>alert(1)</script>' }
    const serialized = serializeHeadingMetadata(metadata)
    expect(serialized.match(/-->/g)).toHaveLength(1)
    expect(parseHeadingMetadata(serialized)).toEqual(metadata)
    expect(parseHeadingMetadata('<!-- resume:{"kind":"section","id":"a","type":"unknown"} -->')).toBeNull()
    expect(parseHeadingMetadata('<!-- resume:{broken} -->')).toBeNull()
  })

  it('自定义标题和姓名中的 Markdown、HTML、实体与右对齐符号按原文保留', () => {
    const title = '**资料** [主页](https://example.com) <span>原文</span> &copy; \\ # || 2026'
    const sections = [createSection('basics'), createSection('experience'), createSection('custom')]
    for (const section of sections) {
      section.title = title
      if (section.type === 'basics') section.data.name = title
      if (section.type === 'custom') section.data.title = title
    }
    expect(parseMarkdownToSections(serializeSections(sections))).toEqual(sections)
  })
})
