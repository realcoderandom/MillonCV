import { describe, expect, it } from 'vitest'
import type { Section } from '../../model'
import { parseMarkdownToSections, parseMarkdownWithDiagnostics } from '../parse'
import { serializeSections } from '../serialize'

function skills(id: string, title: string, content: string): Section {
  return { id, type: 'skills', title, data: { content } }
}

function parseNext(previous: Section[], next: Section[]): Section[] {
  // 继续覆盖旧版 / 手写无标记 Markdown 的启发式识别；有标记的文档以显式 id 为准。
  return parseMarkdownToSections(serializeSections(next).replace(/^<!-- resume:.* -->\n*/gm, ''), previous)
}

describe('Markdown 编辑保持分节 id', () => {
  it('单个分节同时改名和修改正文时沿用 id', () => {
    const previous = [skills('skills-1', '专业技能', '- React')]
    const next = parseNext(previous, [skills('new', '技术能力', '- React\n- TypeScript')])

    expect(next[0]).toMatchObject({ id: 'skills-1', title: '技术能力' })
  })

  it('新增同类型分节不会抢走后续精确匹配的 id', () => {
    const previous = [
      skills('frontend', '前端技能', '- React'),
      skills('backend', '后端技能', '- Node.js'),
    ]
    const next = parseNext(previous, [
      skills('new', '通用技能', '- Git'),
      ...previous,
    ])

    expect(next.slice(1)).toEqual(previous)
    expect(previous.map((section) => section.id)).not.toContain(next[0].id)
    expect(new Set(next.map((section) => section.id)).size).toBe(3)
  })

  it('多个同类型分节改名、重排时通过唯一正文找回各自 id', () => {
    const previous = [
      skills('frontend', '前端技能', '- React'),
      skills('backend', '后端技能', '- Node.js'),
    ]
    const next = parseNext(previous, [
      skills('new-1', '服务端技能', '- Node.js'),
      skills('new-2', '客户端技能', '- React'),
    ])

    expect(next.map((section) => section.id)).toEqual(['backend', 'frontend'])
  })

  it('改名和新增同类型分节并存时只复用正文唯一命中的 id', () => {
    const previous = [
      skills('frontend', '前端技能', '- React'),
      skills('backend', '后端技能', '- Node.js'),
    ]
    const next = parseNext(previous, [
      skills('new-1', '工具技能', '- Git'),
      skills('new-2', '客户端技能', '- React'),
      previous[1],
    ])

    expect(next[1].id).toBe('frontend')
    expect(next[2].id).toBe('backend')
    expect(['frontend', 'backend']).not.toContain(next[0].id)
  })

  it('插入和改名同时改写正文无法区分时不按位置猜测', () => {
    const previous = [skills('skills-1', '专业技能', '- React')]
    const next = parseNext(previous, [
      skills('new-1', '通用技能', '- Git'),
      skills('new-2', '前端技能', '- TypeScript'),
    ])

    expect(next.map((section) => section.id)).not.toContain('skills-1')
    expect(next[0].id).not.toBe(next[1].id)
  })

  it('多个同类型分节同时改写且无匹配正文时不猜测对应关系', () => {
    const previous = [
      skills('frontend', '前端技能', '- React'),
      skills('backend', '后端技能', '- Node.js'),
    ]
    const next = parseNext(previous, [
      skills('new-1', '应用技能', '- TypeScript'),
      skills('new-2', '系统技能', '- PostgreSQL'),
    ])

    expect(next.every((section) => !['frontend', 'backend'].includes(section.id))).toBe(true)
  })

  it('删除分节保留精确命中的其他分节及其引用', () => {
    const previous = [
      skills('frontend', '前端技能', '- React'),
      skills('backend', '后端技能', '- Node.js'),
    ]
    const next = parseNext(previous, [previous[1]])

    expect(next).toEqual([previous[1]])
    expect(next[0]).toBe(previous[1])
  })

  it('列表型分节改名后继续保持条目 id', () => {
    const previous: Section[] = [{
      id: 'work',
      type: 'experience',
      title: '工作经历',
      data: { items: [{ id: 'company', title: 'Acme', subtitle: '工程师', description: '- React' }] },
    }]
    const next = parseMarkdownToSections(
      serializeSections(previous).replace('## 工作经历', '## 职业经历').replace('- React', '- TypeScript'),
      previous,
    )

    expect(next[0].id).toBe('work')
    expect(next[0].type === 'experience' && next[0].data.items[0].id).toBe('company')
  })

  it('重复标题的分节和条目均不会产生重复 id', () => {
    const previous: Section[] = [{
      id: 'work-1',
      type: 'experience',
      title: '工作经历',
      data: { items: [{ id: 'company', title: 'Acme', subtitle: '工程师', description: '- React' }] },
    }, {
      id: 'work-2',
      type: 'experience',
      title: '工作经历',
      data: { items: [] },
    }]
    const next = parseMarkdownToSections([
      '## 工作经历',
      '### Acme — 工程师',
      '- React',
      '### Acme — 顾问',
      '- TypeScript',
      '## 工作经历',
    ].join('\n\n'), previous)
    const itemIds = next.flatMap((section) => section.type === 'experience' ? section.data.items.map((item) => item.id) : [])

    expect(next.map((section) => section.id)).toEqual(['work-1', 'work-2'])
    expect(itemIds[0]).toBe('company')
    expect(new Set(itemIds).size).toBe(2)
  })

  it('自定义分节改名不重复提示首次兜底', () => {
    const previous: Section[] = [{
      id: 'certificates', type: 'custom', title: '证书', data: { title: '证书', content: '- AWS' },
    }]
    const result = parseMarkdownWithDiagnostics('## 认证\n\n- AWS\n- PMP', previous)

    expect(result.sections[0].id).toBe('certificates')
    expect(result.diagnostics).toEqual([])
  })

  it('标题推断导致类型变化时保留诊断且不复用旧 id', () => {
    const previous: Section[] = [{
      id: 'work',
      type: 'experience',
      title: '工作经历',
      data: { items: [{ id: 'company', title: 'Acme', subtitle: '工程师', description: '- React' }] },
    }]
    const result = parseMarkdownWithDiagnostics(
      serializeSections(previous).replace(/^<!-- resume:.* -->\n*/gm, '').replace('## 工作经历', '## 任职记录'),
      previous,
    )

    expect(result.sections[0].id).not.toBe('work')
    expect(result.diagnostics).toEqual([{
      kind: 'section-type-changed', title: '任职记录', fromType: 'experience', toType: 'custom',
    }])
  })
})
