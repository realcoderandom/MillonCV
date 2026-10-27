// serialize ⇄ parse 往返测试：核心不变量——结构化 sections 经 Markdown 序列化再解析后应语义无损
// 传入 prev sections 让 parse 复用 id，使 toEqual 可严格比较（含 id）
import { describe, it, expect } from 'vitest'
import { serializeSections } from '../serialize'
import { parseMarkdownToSections, parseMarkdownWithDiagnostics } from '../parse'
import { createSampleResume } from '../../sample'
import type { Section } from '../../model'

// 往返辅助：serialize 后 parse，传 prev 复用 id（模拟源码模式防抖回写路径）
function roundtrip(sections: Section[]): Section[] {
  return parseMarkdownToSections(serializeSections(sections), sections)
}

describe('serialize ⇄ parse 往返', () => {
  it('示例简历整体往返无损', () => {
    const sections = createSampleResume().sections
    expect(roundtrip(sections)).toEqual(sections)
  })

  it('basics 各字段往返（含 | 与多行 summary 边界值）', () => {
    const sections: Section[] = [
      {
        id: 'b1',
        type: 'basics',
        title: '基本信息',
        data: {
          name: '李四',
          title: '高级工程师',
          contact: {
            phone: '021-1234-5678',
            email: 'lisi@test.com',
            // 值含 |：验证「所在地：」前缀精确匹配，不被旧格式 | split 启发式干扰
            location: '上海 | 浦东',
            website: 'https://lisi.dev',
            github: 'github.com/lisi',
          },
          summary: '多行\n简介\n第三行',
        },
      },
    ]
    expect(roundtrip(sections)).toEqual(sections)
  })

  it('列表条目 rightText 往返（有/无 rightText 混合）', () => {
    const sections: Section[] = [
      {
        id: 'e1',
        type: 'experience',
        title: '工作经历',
        data: {
          items: [
            {
              id: 'i1',
              title: 'Acme',
              subtitle: '工程师',
              rightText: '2020 - 2023', // 含 " - "，验证不污染 title/subtitle 拆分
              description: '- 负责前端\n- 带团队',
            },
            {
              id: 'i2',
              title: 'Foo',
              subtitle: '实习',
              description: '无 rightText 条目',
            },
          ],
        },
      },
    ]
    expect(roundtrip(sections)).toEqual(sections)
  })

  it('项目描述中的多级列表保持缩进与层级', () => {
    const sections: Section[] = [
      {
        id: 'p1',
        type: 'projects',
        title: '项目经历',
        data: {
          items: [
            {
              id: 'i1',
              title: '机票交易',
              subtitle: '核心系统',
              description: [
                '- 一致性设计',
                '  - 航司改期状态一致性',
                '- 性能与稳定性治理',
                '  - 订单列表性能优化',
                '    - 游标分页',
                '  - 交易阻塞埋点',
              ].join('\n'),
            },
          ],
        },
      },
    ]

    expect(roundtrip(sections)).toEqual(sections)
  })

  it('skills 与 custom 兜底往返', () => {
    const sections: Section[] = [
      { id: 's1', type: 'skills', title: '技能', data: { content: '- **JS**\n- React' } },
      { id: 'c1', type: 'custom', title: '其他', data: { title: '其他', content: '游离内容段落' } },
    ]
    expect(roundtrip(sections)).toEqual(sections)
  })

  it('空字段不丢失', () => {
    const sections: Section[] = [
      {
        id: 'b1',
        type: 'basics',
        title: '基本信息',
        data: {
          name: '空',
          title: '',
          contact: { phone: '', email: '', location: '', website: '', github: '' },
          summary: '',
        },
      },
    ]
    expect(roundtrip(sections)).toEqual(sections)
  })
})

describe('Markdown 结构变化诊断', () => {
  it('新增未知标题时提示自定义兜底', () => {
    const previous = createSampleResume().sections
    const markdown = `${serializeSections(previous)}\n\n## 证书\n\n- AWS`
    const result = parseMarkdownWithDiagnostics(markdown, previous)

    expect(result.diagnostics).toEqual([
      { kind: 'custom-fallback', title: '证书', toType: 'custom' },
    ])
  })

  it('无标记的分节标题导致类型变化时给出明确诊断', () => {
    const previous = createSampleResume().sections
    const markdown = serializeSections(previous).replace(/^<!-- resume:.* -->\n*/gm, '').replace('## 工作经历', '## 任职记录')
    const result = parseMarkdownWithDiagnostics(markdown, previous)

    expect(result.diagnostics).toContainEqual({
      kind: 'section-type-changed',
      title: '任职记录',
      fromType: 'experience',
      toType: 'custom',
    })
  })

  it('继续编辑既有自定义分节不重复提示', () => {
    const previous: Section[] = [
      { id: 'c1', type: 'custom', title: '证书', data: { title: '证书', content: '- AWS' } },
    ]
    const result = parseMarkdownWithDiagnostics('## 证书\n\n- AWS\n- PMP', previous)

    expect(result.diagnostics).toEqual([])
  })
})

describe('基本信息中的可选工作经验', () => {
  it.each(['5 年工作经验', '应届生', '3 年全职 | 2 年实习'])('%s 在重复编辑与独立导入后保持原值', (workExperience) => {
    const sections = createSampleResume().sections
    const basics = sections.find((section) => section.type === 'basics')!
    basics.data.workExperience = workExperience
    const markdown = serializeSections(sections)
    expect(markdown).toContain(`工作经验：${workExperience}`)
    let parsed = parseMarkdownToSections(markdown)
    for (let index = 0; index < 3; index += 1) {
      expect(parsed).toEqual(sections)
      parsed = roundtrip(parsed)
    }
  })

  it('删除工作经验语法后不从旧数据复活该字段，其他内容不变', () => {
    const sections = createSampleResume().sections
    const basics = sections.find((section) => section.type === 'basics')!
    basics.data.workExperience = '5 年工作经验'
    const markdown = serializeSections(sections).replace('工作经验：5 年工作经验\n\n', '')
    const parsed = parseMarkdownToSections(markdown, sections)
    delete basics.data.workExperience
    expect(parsed).toEqual(sections)
  })

  it('未填写和仅有空格时不输出工作经验行，旧文档无需补字段', () => {
    const sections = createSampleResume().sections
    const basics = sections.find((section) => section.type === 'basics')!
    for (const workExperience of [undefined, '', '   ']) {
      basics.data.workExperience = workExperience
      const markdown = serializeSections(sections)
      expect(markdown).not.toContain('工作经验：')
      expect(parseMarkdownToSections(markdown).find((section) => section.type === 'basics')!.data).not.toHaveProperty('workExperience')
    }
  })

  it('按前缀导入并清洗富文本标记，不混入职位或联系方式', () => {
    const [basics] = parseMarkdownToSections('# 陈晓\n\n工作经验: **5 年**工作经验\n\n职位：前端工程师\n\n所在地：上海')
    expect(basics.type).toBe('basics')
    if (basics.type !== 'basics') throw new Error('未解析出基本信息')
    expect(basics.data.workExperience).toBe('5 年工作经验')
    expect(basics.data.title).toBe('前端工程师')
    expect(basics.data.contact.location).toBe('上海')
  })

  it.each(['：', ':'])('保留工作经验%s前缀、仅清空值时不会误识别为职位', (colon) => {
    const [basics] = parseMarkdownToSections(`# 陈晓\n\n工作经验${colon}5 年工作经验\n\n工作经验${colon} `)
    expect(basics.type).toBe('basics')
    if (basics.type !== 'basics') throw new Error('未解析出基本信息')
    expect(basics.data).not.toHaveProperty('workExperience')
    expect(basics.data.title).toBe('')
  })
})
