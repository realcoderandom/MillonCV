import { describe, expect, it } from 'vitest'
import { highlightSource, type SourceSyntax } from '../highlightSource'

function syntaxAt(text: string, value: string): SourceSyntax {
  const offset = text.indexOf(value)
  expect(offset).toBeGreaterThanOrEqual(0)
  let cursor = 0
  for (const token of highlightSource(text)) {
    cursor += token.text.length
    if (cursor > offset) return token.syntax
  }
  throw new Error('missing source text')
}

describe('Markdown 源码语法高亮', () => {
  it('标题分级着色，语法标记保持独立且不改变原始文本', () => {
    const text = '# 张三\n\n## 工作经历\n\n### 公司 — 工程师 || 2026\n\n正文'
    expect(syntaxAt(text, '张三')).toBe('heading-1')
    expect(syntaxAt(text, '工作经历')).toBe('heading-2')
    expect(syntaxAt(text, '公司')).toBe('heading-3')
    expect(syntaxAt(text, '## ')).toBe('punctuation')
    expect(syntaxAt(text, '正文')).toBe('plain')
    expect(highlightSource(text).map((token) => token.text).join('')).toBe(text)
  })

  it('多层、有序及任务列表只强调标记，列表中的加粗和链接独立识别', () => {
    const text = '- **负责项目**\n  - [查看成果](https://example.com)\n1. 有序条目\n  2) 次级条目\n- [x] 已完成'
    for (const marker of ['- ', '  - ', '1.', '  2)', '- [x]']) expect(syntaxAt(text, marker)).toBe('list')
    expect(syntaxAt(text, '负责项目')).toBe('strong')
    expect(syntaxAt(text, '查看成果')).toBe('link')
    expect(syntaxAt(text, 'https://example.com')).toBe('destination')
    expect(syntaxAt(text, '有序条目')).toBe('plain')
  })

  it('嵌套加粗、斜体、删除线、转义与行内代码按各自语义识别', () => {
    const text = '**加粗 *斜体*** 和 ~~删除~~，\\*普通星号\\*，`**代码**`'
    expect(syntaxAt(text, '加粗')).toBe('strong')
    expect(syntaxAt(text, '斜体')).toBe('emphasis')
    expect(syntaxAt(text, '删除')).toBe('deleted')
    expect(syntaxAt(text, '普通星号')).toBe('plain')
    expect(syntaxAt(text, '代码')).toBe('code')
  })

  it('跨行的加粗和行内代码保持连续，标题内部仍能识别链接', () => {
    const text = '正文 **首行\n次行**，以及 `第一行\n第二行`\n\n## [项目成果](https://example.com)'
    expect(syntaxAt(text, '次行')).toBe('strong')
    expect(syntaxAt(text, '第二行')).toBe('code')
    expect(syntaxAt(text, '项目成果')).toBe('link')
    expect(highlightSource(text).map((token) => token.text).join('')).toBe(text)
  })

  it('引用、图片、自动链接和引用式链接保留源码写法', () => {
    const text = '> 引用 **重点**\n\n![照片](data:image/png;base64,abc)\n\nhttps://example.com\n\n[文章][ref]\n\n[ref]: https://example.com/article\n\n## 后续标题'
    expect(syntaxAt(text, '>')).toBe('punctuation')
    expect(syntaxAt(text, '引用')).toBe('quote')
    expect(syntaxAt(text, '重点')).toBe('strong')
    expect(syntaxAt(text, '照片')).toBe('link')
    expect(syntaxAt(text, 'https://example.com\n')).toBe('destination')
    expect(syntaxAt(text, '文章')).toBe('link')
    expect(syntaxAt(text, '后续标题')).toBe('heading-2')
    expect(highlightSource(text).map((token) => token.text).join('')).toBe(text)
  })

  it('代码块中的标题、列表及加粗不会被当作 Markdown 正文高亮', () => {
    const text = '```md\n# 示例标题\n- **示例加粗**\n```\n\n## 真实标题\n\n- 条目\n  ```md\n  # 嵌套示例\n  ```\n\n**真实加粗**'
    for (const value of ['示例标题', '示例加粗', '嵌套示例']) expect(syntaxAt(text, value)).toBe('code')
    expect(syntaxAt(text, '真实标题')).toBe('heading-2')
    expect(syntaxAt(text, '真实加粗')).toBe('strong')
  })

  it('保留 Setext 标题及 HTML 注释，注释内部不触发其他语法', () => {
    const text = '工作经历\n===\n\n<!-- **普通注释**\n## 注释内标题\n-->\n\n正文'
    expect(syntaxAt(text, '工作经历')).toBe('heading-1')
    expect(syntaxAt(text, '===')).toBe('punctuation')
    expect(syntaxAt(text, '普通注释')).toBe('comment')
    expect(syntaxAt(text, '注释内标题')).toBe('comment')
  })

  it('未完成语法、HTML、空白、中文、表情和尾部空行不会被补写、转义或丢弃', () => {
    const fragments = ['', ' ', '\t', '\n', '\r\n', '#', '## ', '- ', '**未完成', '[链接](', '```', '<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '&lt;正文&gt;', '中文🙂', '\\**星号**', '\n\n\n']
    for (const left of fragments) {
      for (const right of fragments) {
        const text = `${left}\n${right}`
        expect(highlightSource(text).map((token) => token.text).join('')).toBe(text)
      }
    }
  })
})
