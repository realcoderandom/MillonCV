// 行内 Markdown → 纯文本：链接/图片取显示文本，autolink 取地址，剥离粗体/斜体/代码等标记
// 用于 contact 等结构化纯文本字段：富文本模式 linkify 会把裸邮箱/URL 转成 [text](url)，
// 回写后污染字段；此函数在 parse 与预览端统一清洗，保证字段始终为纯文本
/* eslint-disable @typescript-eslint/no-explicit-any */
import { marked } from 'marked'

// 递归遍历 inline tokens，拼接为纯文本
function tokensToPlain(tokens: any[]): string {
  return tokens
    .map((t) => {
      switch (t.type) {
        case 'escape':
          // marked 的 escape.text 已 HTML 编码；纯文本字段应取反斜杠后的原字符。
          return typeof t.raw === 'string' ? t.raw.slice(1) : t.text || ''
        case 'link':
        case 'image':
          // 链接/图片优先取显示文本，缺失时回退 href
          return t.text || t.href || ''
        case 'strong':
        case 'em':
        case 'del':
          // 粗体/斜体/删除线递归取内部文本
          return t.tokens ? tokensToPlain(t.tokens) : t.text || ''
        default:
          return typeof t.text === 'string' ? t.text : ''
      }
    })
    .join('')
}

// 将单行/行内 Markdown 文本转为纯文本
export function inlineToPlain(md: string): string {
  if (!md) return ''
  // 字段值只走行内词法，避免 || 等块扩展或行首 # 把纯文本误识别成文档结构。
  return tokensToPlain(marked.Lexer.lexInline(md)).trim()
}
