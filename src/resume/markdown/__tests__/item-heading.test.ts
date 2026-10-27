import { describe, expect, it } from 'vitest'
import type { Section } from '../../model'
import { serializeSections } from '../serialize'
import { parseMarkdownToSections } from '../parse'
import { createSourceDocument, parseSourceDocument, updateSourceDocument } from '../sourceDocument'

function sections(title: string, subtitle: string): Section[] {
  return [{ id: 'experience', type: 'experience', title: '工作经历', data: { items: [{
    id: 'company', title, subtitle, rightText: '[2024](https://example.com) - 至今', description: '- 公司说明',
    projects: [{ id: 'project', title, subtitle, description: '- 子项目说明' }],
  }] } }]
}

describe('条目头字段边界', () => {
  it.each([
    ['平台 — 国内业务', '技术负责人'],
    ['平台 || 国内业务', '开发 — 运维 || 顾问'],
    ['Acme - China', 'Engineer'],
    ['`代码` 与 ``围栏``', '`角色`'],
    ['**加粗** <团队> &copy;', '[角色](https://example.com)'],
    [' 前后空格 ', ' 角色 '],
    ['', ''],
  ])('公司和子项目独立导入及反复往返保留字段：%s / %s', (title, subtitle) => {
    const previous = sections(title, subtitle)
    const markdown = serializeSections(previous)
    let parsed = parseMarkdownToSections(markdown)
    expect(parsed).toEqual(previous)
    for (let index = 0; index < 3; index += 1) {
      parsed = parseMarkdownToSections(serializeSections(parsed), parsed)
      expect(parsed).toEqual(previous)
    }
  })

  it('源码隐藏标识后仍保留引用规则，并允许继续编辑标题与角色', () => {
    const previous = sections('平台 — 国内业务', '开发 || 运维')
    const document = createSourceDocument(previous)
    expect(document.text).not.toContain('<!-- resume:')
    let parsed = { document, sections: previous }
    for (const [before, after] of [['国内业务', '海外业务'], ['开发 || 运维', '架构 — 顾问'], ['国内业务', '海外业务'], ['开发 || 运维', '架构 — 顾问']]) {
      const start = parsed.document.text.indexOf(before)
      const changed = updateSourceDocument(parsed.document, parsed.document.text.replace(before, after), [], { start, end: start + before.length })
      parsed = parseSourceDocument(changed, parsed.sections)
    }
    expect(parsed.sections).toEqual(sections('平台 — 海外业务', '架构 — 顾问'))
  })

  it('旧备份与无标记 Markdown 继续沿用原有条目头规则', () => {
    const markdown = '## 工作经历\n\n### Acme — 工程师 || 2024 - 至今\n\n- 工作说明\n\n#### 子项目：平台 — 核心开发\n\n- 子项目说明'
    expect(parseMarkdownToSections(markdown)[0]).toMatchObject({ data: { items: [{
      title: 'Acme', subtitle: '工程师', rightText: '2024 - 至今',
      projects: [{ title: '平台', subtitle: '核心开发' }],
    }] } })
  })
})
