// 经典模板 —— 单列 · 衬线 · 居中标题 · 下划线分节
import type { TemplatePlugin } from '../types'
import { SingleColumnBody } from '../rendering'
import './classic.css'

export const classic = {
  id: 'classic' as const,
  label: '经典',
  bestFor: '通用求职 · 传统行业',
  description: '稳健单栏，阅读顺序清晰',
  Body: SingleColumnBody,
} satisfies TemplatePlugin
