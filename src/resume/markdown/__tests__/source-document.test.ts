import { describe, expect, it } from 'vitest'
import type { Section } from '../../model'
import { createItem, createSection } from '../../sections'
import { createSampleResume } from '../../sample'
import { serializeHeadingMetadata } from '../metadata'
import { parseMarkdownToSections } from '../parse'
import { serializeSections } from '../serialize'
import { createSourceDocument, parseSourceDocument, updateSourceDocument, type SourceDocument } from '../sourceDocument'

function work(): Section {
  return {
    id: 'work', type: 'experience', title: '成长足迹', data: { items: [
      { id: 'company-a', title: 'Acme', subtitle: '工程师', description: '- 第一份工作', projects: [
        { id: 'project-a', title: '平台', subtitle: '负责人', description: '- 项目说明' },
      ] },
      { id: 'company-b', title: 'Acme', subtitle: '顾问', description: '- 第二份工作' },
    ] },
  }
}

function replace(document: SourceDocument, before: string, after: string, history: SourceDocument[] = []) {
  const start = document.text.indexOf(before)
  expect(start).toBeGreaterThanOrEqual(0)
  return updateSourceDocument(document, document.text.slice(0, start) + after + document.text.slice(start + before.length), history, { start, end: start + before.length })
}

describe('Markdown 编辑区隐藏结构标识', () => {
  it('示例简历显示普通 Markdown，协议行和它们额外占用的空行都被移除', () => {
    const previous = createSampleResume().sections
    const document = createSourceDocument(previous)
    expect(document.text).not.toContain('<!-- resume:')
    expect(document.text.startsWith('# ')).toBe(true)
    expect(document.text).not.toMatch(/\n{3,}/)
    const result = parseSourceDocument(document, previous)
    expect(result.sections).toEqual(previous)
    expect(result.diagnostics).toEqual([])
    expect(result.document.text).toBe(document.text)
  })

  it('自定义标题、同名条目和子项目完整保留类型与 id', () => {
    const previous = [work()]
    const document = createSourceDocument(previous)
    const next = replace(replace(document, '## 成长足迹', '## 任职记录'), 'Acme — 顾问', 'Beta — 专家')
    const result = parseSourceDocument(next, previous)
    expect(result.sections[0]).toMatchObject({ id: 'work', type: 'experience', title: '任职记录', data: { items: [
      { id: 'company-a', projects: [{ id: 'project-a' }] }, { id: 'company-b', title: 'Beta', subtitle: '专家' },
    ] } })
    expect(result.diagnostics).toEqual([])
    expect(parseMarkdownToSections(serializeSections(result.sections))).toEqual(result.sections)
  })

  it('保留六种空模块、空标题与未填写条目', () => {
    const previous = (['basics', 'experience', 'education', 'projects', 'skills', 'custom'] as const).map((type) => {
      const section = createSection(type)
      section.title = ''
      if ('items' in section.data) section.data.items = [createItem()]
      if (section.type === 'custom') section.data.title = ''
      return section
    })
    expect(parseSourceDocument(createSourceDocument(previous), previous).sections).toEqual(previous)
  })

  it('姓名和模块标题中的 Markdown 转义与基本信息自定义模块名仍可无损还原', () => {
    const section = createSection('basics')
    if (section.type !== 'basics') throw new Error('wrong type')
    section.title = '我的名片'
    section.data.name = '**张三** <name> &copy;'
    const document = createSourceDocument([section])
    expect(parseSourceDocument(document, [section]).sections).toEqual([section])
  })

  it('反复防抖提交后，继续改模块、条目和子项目标题仍沿用身份', () => {
    let sections = [work()]
    let document = createSourceDocument(sections)
    for (const [before, after] of [['成长足迹', '任职记录'], ['Acme — 工程师', 'Beta — 工程师'], ['子项目：平台', '子项目：系统'], ['第一份工作', '新的工作说明']]) {
      const result = parseSourceDocument(replace(document, before, after), sections)
      document = result.document
      sections = result.sections
    }
    expect(sections[0]).toMatchObject({ id: 'work', type: 'experience', data: { items: [
      { id: 'company-a', title: 'Beta', projects: [{ id: 'project-a', title: '系统' }] }, { id: 'company-b' },
    ] } })
    expect(document.text).not.toContain('<!-- resume:')
  })

  it('在原模块之前复制整段纯 Markdown，副本独立且原件的 id 不被抢走', () => {
    const previous = [work()]
    const document = createSourceDocument(previous)
    const next = updateSourceDocument(document, `${document.text}\n\n${document.text}`, [], { start: 0, end: 0 })
    const result = parseSourceDocument(next, previous)
    expect(result.sections).toHaveLength(2)
    expect(result.sections[1]).toEqual(previous[0])
    expect(result.sections[0]).toMatchObject({ type: 'experience', title: '成长足迹' })
    const ids = result.sections.flatMap((section) => [section.id, ...('items' in section.data ? section.data.items.flatMap((item) => [item.id, ...(item.projects ?? []).map((project) => project.id)]) : [])])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('剪切后再次粘贴模块可以找回原有类型、id 与子层级', () => {
    const previous: Section[] = [work(), { id: 'skills', type: 'skills', title: '工具箱', data: { content: '- TypeScript' } }]
    const original = createSourceDocument(previous)
    const start = original.text.indexOf('## 工具箱')
    const cut = original.text.slice(0, start)
    const remaining = updateSourceDocument(original, original.text.slice(start), [], { start: 0, end: start })
    const committed = parseSourceDocument(remaining, previous)
    const moved = updateSourceDocument(committed.document, `${remaining.text}\n\n${cut}`, [original, committed.document], { start: remaining.text.length, end: remaining.text.length })
    expect(parseSourceDocument(moved, committed.sections).sections).toEqual([previous[1], previous[0]])
  })

  it('原生撤销删除后，从历史草稿恢复隐藏标识', () => {
    const previous = [work()]
    const original = createSourceDocument(previous)
    const empty = updateSourceDocument(original, '', [], { start: 0, end: original.text.length })
    const committed = parseSourceDocument(empty, previous)
    expect(committed.sections).toEqual([])
    const restored = updateSourceDocument(committed.document, original.text, [original])
    expect(parseSourceDocument(restored, []).sections).toEqual(previous)
  })

  it('新手写模块首次解析后，改名也不再依赖标题关键词', () => {
    const empty = createSourceDocument([])
    const added = updateSourceDocument(empty, '## 工作经历\n\n### 新公司 — 工程师\n\n- 新内容')
    const first = parseSourceDocument(added, [])
    const renamed = replace(first.document, '工作经历', '任职记录')
    const result = parseSourceDocument(renamed, first.sections)
    expect(result.sections[0]).toMatchObject({ id: first.sections[0].id, type: 'experience', title: '任职记录' })
    expect(result.diagnostics).toEqual([])
  })

  it('粘贴旧版带注释的源码时，标识转为内部数据且不残留在可见正文', () => {
    const previous = [work()]
    const pasted = updateSourceDocument(createSourceDocument([]), serializeSections(previous))
    expect(pasted.text).not.toContain('<!-- resume:')
    expect(parseSourceDocument(pasted, []).sections).toEqual(previous)
  })

  it('仅隐藏有效协议，代码块中的示例、普通注释和损坏标记保持原文', () => {
    const metadata = serializeHeadingMetadata({ kind: 'section', id: 'example', type: 'experience' })
    const text = `## 说明\n\n<!-- 普通注释 -->\n\n<!-- resume:{broken} -->\n\n\`\`\`md\n${metadata}\n\n## 标题示例\n\`\`\`\n`
    const document = updateSourceDocument(createSourceDocument([]), text)
    expect(document.text).toBe(text)
    expect(document.bindings).toEqual([])
  })

  it('增加真正的新模块仍产生诊断，已有模块身份保持稳定', () => {
    const previous = [work()]
    const original = createSourceDocument(previous)
    const next = updateSourceDocument(original, `${original.text}\n\n## 证书\n\n- AWS`)
    const result = parseSourceDocument(next, previous)
    expect(result.sections[0]).toEqual(previous[0])
    expect(result.diagnostics).toEqual([{ kind: 'custom-fallback', title: '证书', toType: 'custom' }])
  })
})
