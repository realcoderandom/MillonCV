// 通用带箭头 select：appearance-none + chevron 背景，配色走 CSS 变量
import type { CSSProperties, SelectHTMLAttributes } from 'react'
import { selectBareCls } from './classes'

interface Option {
  value: string
  label: string
  /** 可选：该项的内联样式（如字体下拉用各自字体族渲染预览） */
  style?: CSSProperties
}

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: Option[]
  onChange?: (value: string) => void
  /** 右侧内边距（留出箭头空间），默认 20px */
  padRight?: string
}

export function Select({ options, onChange, padRight = '20px', className = '', ...rest }: Props) {
  return (
    <select
      className={`${selectBareCls} ${className}`}
      style={{ paddingRight: padRight }}
      onChange={(e) => onChange?.(e.target.value)}
      {...rest}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={o.style}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
