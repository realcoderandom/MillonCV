import type { ReactNode } from 'react'
import { Check, ChevronDown, Code2, Eye, FileText, LayoutList } from 'lucide-react'
import type { EditMode } from './Toolbar'
import { Popover } from '@/shared/ui/Popover'

const MODES = [
  { value: 'modules', label: '模块编辑', description: '按字段填写与整理经历', icon: LayoutList },
  { value: 'rich', label: '文档编辑', description: '像文档一样连续编辑', icon: FileText },
  { value: 'source', label: 'Markdown', description: '直接编辑简历源码', icon: Code2 },
] as const

interface Props {
  mode: EditMode
  onModeChange: (mode: EditMode) => void
  onPreview: () => void
  children?: ReactNode
}

export function EditorToolbar({ mode, onModeChange, onPreview, children }: Props) {
  const current = MODES.find((candidate) => candidate.value === mode) ?? MODES[0]
  const Icon = current.icon
  return <div className="pane-head editor-workspace-head">
    <Popover contentRole="menu" ariaLabel="选择编辑模式" trigger={
      <button type="button" className="editor-mode-trigger" aria-label={`编辑模式：${current.label}`}>
        <Icon size={15} /><span>{current.label}</span><ChevronDown size={12} />
      </button>
    }>
      <div className="editor-mode-menu">{MODES.map(({ value, label, description, icon: ModeIcon }) =>
        <button key={value} type="button" role="menuitemradio" aria-checked={mode === value} onClick={() => onModeChange(value)}>
          <ModeIcon size={16} /><span><strong>{label}</strong><small>{description}</small></span>{mode === value && <Check size={14} />}
        </button>,
      )}</div>
    </Popover>
    {children}
    <span className="toolbar-spacer" />
    <button type="button" className="editor-preview-button" onClick={onPreview} title="定位到预览中的当前内容" aria-label="定位预览">
      <Eye size={15} /><span className="editor-preview-desktop-label">定位预览</span><span className="editor-preview-mobile-label">预览</span>
    </button>
  </div>
}
