import StarterKit from '@tiptap/starter-kit'
import type { Node as TiptapNode } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { escapeHeadingText, metadataMatchesLevel, parseHeadingMetadata, serializeHeadingMetadata } from '@/resume/markdown/metadata'

interface MarkdownState {
  write: (text: string) => void
  renderInline: (node: ProseMirrorNode) => void
  closeBlock: (node: ProseMirrorNode) => void
}

// 将标记附着在标题属性上，富文本中不增加可误删的隐藏块，也不会显示内部标识。
export const ResumeStarterKit = StarterKit.extend({
  addExtensions() {
    return (this.parent?.() ?? []).map((extension) => {
      if (extension.name !== 'heading') return extension
      return (extension as TiptapNode).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            resumeMetadata: {
              default: null,
              parseHTML: (element: HTMLElement) => element.getAttribute('data-resume-metadata'),
              renderHTML: (attributes: Record<string, unknown>) => attributes.resumeMetadata
                ? { 'data-resume-metadata': String(attributes.resumeMetadata) }
                : {},
            },
          }
        },
        addStorage() {
          return {
            markdown: {
              serialize(state: MarkdownState, node: ProseMirrorNode) {
                const metadata = parseHeadingMetadata(String(node.attrs.resumeMetadata ?? ''))
                const valid = metadata && metadataMatchesLevel(metadata, Number(node.attrs.level))
                if (valid) {
                  state.write(`${serializeHeadingMetadata(metadata)}\n\n`)
                }
                state.write(`${'#'.repeat(Number(node.attrs.level))} `)
                // 姓名 / 模块标题直接按纯文本序列化，避开通用 text serializer 的 HTML 编码。
                if (valid && metadata.kind === 'section') state.write(escapeHeadingText(node.textContent))
                else state.renderInline(node)
                state.closeBlock(node)
              },
              parse: {
                updateDOM(element: HTMLElement) {
                  const walker = document.createTreeWalker(element, NodeFilter.SHOW_COMMENT)
                  while (walker.nextNode()) {
                    const comment = walker.currentNode
                    const metadata = parseHeadingMetadata(comment.nodeValue ?? '')
                    if (!metadata) continue
                    let next = comment.nextSibling
                    while (next?.nodeType === window.Node.TEXT_NODE && !next.textContent?.trim()) next = next.nextSibling
                    if (!(next instanceof HTMLElement) || !/^H[1-4]$/.test(next.tagName)) continue
                    if (metadataMatchesLevel(metadata, Number(next.tagName.slice(1)))) {
                      next.setAttribute('data-resume-metadata', serializeHeadingMetadata(metadata))
                    }
                  }
                },
              },
            },
          }
        },
      })
    })
  },
})
