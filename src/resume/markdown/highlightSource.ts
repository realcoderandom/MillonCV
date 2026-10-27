import { Lexer, type Token } from 'marked'

const STYLES = ['plain', 'punctuation', 'heading-1', 'heading-2', 'heading-3', 'list', 'strong', 'emphasis', 'link', 'destination', 'code', 'quote', 'comment', 'deleted'] as const
export type SourceSyntax = typeof STYLES[number]
export interface SourceHighlight {
  text: string
  syntax: SourceSyntax
}

// 高亮只标注原字符的颜色，不渲染 HTML，也不参与简历解析、保存或隐藏标识的绑定。
export function highlightSource(text: string): SourceHighlight[] {
  const colors = new Uint8Array(text.length)
  const paint = (start: number, end: number, syntax: SourceSyntax) => colors.fill(STYLES.indexOf(syntax), start, end)
  // 使用独立 Lexer，避免预览侧的 || 扩展改变源码词法。
  const lexer = new Lexer({ gfm: true })
  const blocks = lexer.lex(text)

  const inline = (source: string, start: number, tokens: Token[] = lexer.inlineTokens(source)) => {
    let cursor = 0
    for (const token of tokens) {
      const local = source.indexOf(token.raw, cursor)
      if (local < 0) continue
      cursor = local + token.raw.length
      const offset = start + local
      const end = offset + token.raw.length
      if (token.type === 'strong' || token.type === 'em' || token.type === 'del') {
        const size = token.type === 'em' ? 1 : 2
        paint(offset, end, token.type === 'strong' ? 'strong' : token.type === 'em' ? 'emphasis' : 'deleted')
        paint(offset, offset + size, 'punctuation')
        paint(end - size, end, 'punctuation')
        inline(token.raw.slice(size, -size), offset + size, token.tokens)
      } else if (token.type === 'codespan') {
        const size = token.raw.match(/^`+/)?.[0].length ?? 1
        paint(offset, end, 'code')
        paint(offset, offset + size, 'punctuation')
        paint(end - size, end, 'punctuation')
      } else if (token.type === 'link' || token.type === 'image') {
        paint(offset, end, 'destination')
        const size = token.raw.startsWith('![') ? 2 : token.raw.startsWith('[') ? 1 : 0
        if (size && token.raw.slice(size, size + token.text.length) === token.text) {
          paint(offset, offset + size, 'punctuation')
          paint(offset + size, offset + size + token.text.length, 'link')
          const close = offset + size + token.text.length
          paint(close, close + 1, 'punctuation')
          if (text[close + 1] === '(' || text[close + 1] === '[') {
            paint(close + 1, close + 2, 'punctuation')
            paint(end - 1, end, 'punctuation')
          }
          if (token.type === 'link') inline(token.text, offset + size, token.tokens)
        } else if (token.raw.startsWith('<') && token.raw.endsWith('>')) {
          paint(offset, offset + 1, 'punctuation')
          paint(end - 1, end, 'punctuation')
        }
      } else if (token.type === 'escape') paint(offset, offset + 1, 'punctuation')
      else if (token.type === 'html' && token.raw.startsWith('<!--')) paint(offset, end, 'comment')
    }
  }

  let cursor = 0
  for (const block of blocks) {
    // 引用定义不会出现在 block token 数组中，按 raw 定位可保留这些间隙。
    const start = text.indexOf(block.raw, cursor)
    if (start < 0) continue
    cursor = start + block.raw.length
    if (block.type === 'code') paint(start, cursor, 'code')
    else if (block.type === 'html' && block.raw.trimStart().startsWith('<!--')) paint(start, cursor, 'comment')
    else if (block.type === 'hr') paint(start, cursor, 'punctuation')
    else if (block.type === 'heading') {
      paint(start, cursor, block.depth === 1 ? 'heading-1' : block.depth === 2 ? 'heading-2' : 'heading-3')
    }
    if (block.type === 'paragraph' || block.type === 'heading') {
      const content = block.raw.indexOf(block.text)
      if (content >= 0) inline(block.text, start + content, block.tokens)
    }
  }

  let offset = 0
  let fence: { marker: string; length: number } | undefined
  for (const line of text.split('\n')) {
    const start = offset
    offset += line.length + 1
    if (['code', 'comment', 'punctuation'].includes(STYLES[colors[start]])) continue
    let bodyStart = 0
    const quote = line.match(/^(?:[ \t]*>[ \t]?)+/)
    if (quote) {
      paint(start, start + line.length, 'quote')
      paint(start, start + quote[0].length, 'punctuation')
      bodyStart = quote[0].length
    }
    const list = line.slice(bodyStart).match(/^[ \t]*([-+*]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/)
    if (list) {
      paint(start + bodyStart, start + bodyStart + list[0].length, 'list')
      bodyStart += list[0].length
    }
    const body = line.slice(bodyStart)
    const delimiter = body.match(/^[ \t]*(`{3,}|~{3,})(.*)$/)
    if (fence || delimiter) {
      paint(start, start + line.length, 'code')
      if (delimiter) {
        paint(start + bodyStart, start + bodyStart + delimiter[0].length, 'punctuation')
        if (!fence) fence = { marker: delimiter[1][0], length: delimiter[1].length }
        else if (delimiter[1][0] === fence.marker && delimiter[1].length >= fence.length && !delimiter[2].trim()) fence = undefined
      }
      continue
    }
    const heading = body.match(/^[ \t]{0,3}(#{1,6})(?:[ \t]+|$)/)
    if (heading) {
      paint(start + bodyStart, start + line.length, heading[1].length === 1 ? 'heading-1' : heading[1].length === 2 ? 'heading-2' : 'heading-3')
      paint(start + bodyStart, start + bodyStart + heading[0].length, 'punctuation')
      bodyStart += heading[0].length
    } else if (/^[ \t]{0,3}(?:=+|-+)[ \t]*$/.test(body)) {
      paint(start + bodyStart, start + line.length, 'punctuation')
      continue
    }
    inline(line.slice(bodyStart), start + bodyStart)
  }

  const result: SourceHighlight[] = []
  for (let start = 0; start < text.length;) {
    let end = start + 1
    while (end < text.length && colors[end] === colors[start]) end += 1
    result.push({ text: text.slice(start, end), syntax: STYLES[colors[start]] })
    start = end
  }
  return result
}
