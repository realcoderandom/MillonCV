/* eslint-disable @typescript-eslint/no-explicit-any */
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { Token } from 'marked'

// 配置一次：GFM、breaks:true。
// breaks:true 让字段内单换行（多行描述/简介/技能等）渲染为 <br>，否则 \n 被浏览器当空格，
// 富文本/表单/源码模式下换行均会丢失。breaks 仅作用于 inline 层，marked.lexer 的 block
// token 划分与 .text 字段不受影响（已验证 false/true 一致），故 parse/serialize 互逆不漂移
marked.setOptions({ gfm: true, breaks: true })

// 行内右对齐语法 ||：一行中 || 分隔，左侧左对齐、右侧右对齐（flex space-between）
// block 扩展按行匹配——连续 || 行逐行捕获；start 让 paragraph 词法遇含 || 行时停下，
// 使混合行（普通段落后接 || 行）也能被 rowSplit 接管。
// 列表项行（-、*、+、数字. 开头）不直接匹配（避免把 "- " 吞入 left），
// 交 list tokenizer 词法后，list item 内部 block 词法再次触发 rowSplit，
// 故 `- text || right` 渲染为 <li> 内嵌套左右分栏（同样生效）
marked.use({
  extensions: [
    {
      name: 'rowSplit',
      level: 'block',
      start(src: string) {
        const m = src.match(/[^\n]*\|\|/)
        return m ? m.index : undefined
      },
      tokenizer(src: string) {
        const m = src.match(/^([^\n]*?)\s*\|\|\s*([^\n]*)\n?/)
        if (!m) return
        // 列表项行（-、*、+、数字. 开头）不直接匹配：避免把 "- " 当字面量吞入 left。
        // 交 list tokenizer 词法，list item 内部 block 词法会再次触发 rowSplit，
        // 故 `- text || right` 渲染为 <li> 内嵌套左右分栏（同样生效）
        if (/^\s*([-*+]|\d+\.)\s/.test(m[1])) return
        // heading 行（# 开头）不匹配：### title — subtitle || rightText 是条目头语法，
        // 由 parseItemHead 按 || 分割为 rightText，rowSplit 不得抢占 heading
        if (/^\s{0,3}#{1,6}\s/.test(m[1])) return
        // 标题元信息可能包含 || 字面量，注释必须留给标准 HTML tokenizer 处理。
        if (/^\s*<!--/.test(m[1])) return
        const leftTokens: Token[] = []
        const rightTokens: Token[] = []
        ;(this as any).lexer.inlineTokens(m[1], leftTokens)
        ;(this as any).lexer.inlineTokens(m[2], rightTokens)
        return { type: 'rowSplit', raw: m[0], leftTokens, rightTokens }
      },
      renderer(token: any) {
        const left = (this as any).parser.parseInline(token.leftTokens)
        const right = (this as any).parser.parseInline(token.rightTokens)
        return `<div class="row-split"><span class="rs-left">${left}</span><span class="rs-right">${right}</span></div>`
      },
    },
  ],
})

// Markdown → HTML，经 DOMPurify 净化以防 XSS（用户内容渲染到预览/PDF）
export function renderMarkdown(md: string): string {
  if (!md) return ''
  const html = marked.parse(md, { async: false }) as string
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}

// 行内 Markdown → HTML（用于条目头 rightText 等行内字段，产出无 <p> 包裹，
// 避免破坏 .item-head 的 flex 行内布局）；同样经 DOMPurify 净化
export function renderInlineMarkdown(md: string): string {
  if (!md || !md.trim()) return ''
  const html = marked.parseInline(md, { async: false }) as string
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}
