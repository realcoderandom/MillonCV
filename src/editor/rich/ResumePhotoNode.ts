import { Node, mergeAttributes } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { isResumePhoto, RESUME_PHOTO_ALT } from '@/resume/photo'

interface MarkdownState {
  write: (text: string) => void
  closeBlock: (node: ProseMirrorNode) => void
}

// 使用原生 Markdown 图片语法；富文本中作为可选择、可删除的独立节点保留。
export const ResumePhotoNode = Node.create({
  name: 'resumePhoto',
  group: 'block',
  atom: true,
  draggable: false,
  addAttributes() { return { src: { default: null } } },
  parseHTML() {
    return [{ tag: `img[alt="${RESUME_PHOTO_ALT}"]`, getAttrs: (element) => isResumePhoto(element.getAttribute('src')) ? {} : false }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, { alt: RESUME_PHOTO_ALT, class: 'resume-editor-photo' })]
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownState, node: ProseMirrorNode) {
          if (!isResumePhoto(node.attrs.src)) return
          state.write(`![${RESUME_PHOTO_ALT}](${node.attrs.src})`)
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})
