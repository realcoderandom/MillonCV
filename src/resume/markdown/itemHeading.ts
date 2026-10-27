import { marked } from 'marked'
import type { Subproject } from '../model'

// 行内代码保留字段中的字面字符，富文本也会保留其边界；普通条目继续使用原有显示格式。
function quoteField(value: string): string {
  if (!/[—|`\\*_[\]<>#&~]/.test(value) && value.trim() === value) return value
  const size = Math.max(0, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length)) + 1
  const fence = '`'.repeat(size)
  const padding = /^`|`$/.test(value) || (/^ .* $/.test(value) && /[^ ]/.test(value)) ? ' ' : ''
  return `${fence}${padding}${value}${padding}${fence}`
}

export function serializeItemHeading(item: Pick<Subproject, 'title' | 'subtitle' | 'rightText'>): string {
  const right = item.rightText?.trim()
  return `${quoteField(item.title)} — ${quoteField(item.subtitle)}${right ? ` || ${right}` : ''}`
}

function outsideIndex(text: string, separator: string): number {
  let offset = 0
  for (const token of marked.Lexer.lexInline(text)) {
    if (token.type === 'text') {
      const index = token.raw.indexOf(separator)
      if (index >= 0) return offset + index
    }
    offset += token.raw.length
  }
  return -1
}

function unquoteField(value: string): string {
  const trimmed = value.trim()
  const tokens = marked.Lexer.lexInline(trimmed)
  if (tokens.length !== 1 || tokens[0].type !== 'codespan') return trimmed
  const fence = trimmed.match(/^`+/)![0]
  let text = trimmed.slice(fence.length, -fence.length).replace(/\n/g, ' ')
  if (text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text)) text = text.slice(1, -1)
  return text
}

export function parseItemHeading(text: string): Pick<Subproject, 'title' | 'subtitle' | 'rightText'> {
  const rightIndex = outsideIndex(text, '||')
  const left = rightIndex >= 0 ? text.slice(0, rightIndex).trim() : text
  const rightText = rightIndex >= 0 ? text.slice(rightIndex + 2).trim() : ''
  const emDash = outsideIndex(left, '—')
  const dash = emDash >= 0 ? emDash : outsideIndex(left, ' - ')
  const separatorLength = emDash >= 0 ? 1 : 3
  return {
    title: unquoteField(dash >= 0 ? left.slice(0, dash) : left),
    subtitle: unquoteField(dash >= 0 ? left.slice(dash + separatorLength) : ''),
    rightText: rightText || undefined,
  }
}
