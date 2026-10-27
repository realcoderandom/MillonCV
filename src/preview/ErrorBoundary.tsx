// 预览错误边界：捕获 ResumePreview 子树渲染异常，降级为原始 Markdown 文本展示
// 避免任意 section 数据异常或 marked 升级破坏渲染导致整屏白屏且数据不可见
import { Component, type ReactNode } from 'react'
import type { Section } from '@/resume/model'
import { serializeSections } from '@/resume/markdown/serialize'

interface Props {
  sections: Section[]
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('预览渲染失败：', error, info)
  }

  // sections 变化时清除错误态，重新尝试渲染（用户修正内容后自动恢复）
  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.sections !== this.props.sections) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="p-5 text-[13px] text-[var(--fg-dim)] bg-[var(--panel-2)] overflow-auto">
        <p className="text-red-500 mb-2">⚠️ 预览渲染失败：{this.state.error.message}</p>
        <p className="mb-3 text-[var(--muted)] text-[12px]">
          数据已保存，以下为原始内容（可复制备份或反馈问题）：
        </p>
        <pre className="whitespace-pre-wrap font-mono text-[12px] bg-[var(--bar-bg)] p-3 rounded border border-[var(--border)] max-h-[60vh] overflow-auto">
          {serializeSections(this.props.sections)}
        </pre>
      </div>
    )
  }
}
