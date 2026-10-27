// 创意模板 —— 单列 · 主色块标题
import type { TemplatePlugin } from '../types'
import { SingleColumnBody } from '../rendering'
import './creative.css'

export const creative = {
  id: 'creative' as const,
  label: '创意',
  bestFor: '设计 · 品牌与内容',
  description: '鲜明标题，强化个人风格',
  Body: SingleColumnBody,
  defaultTheme: { primaryColor: '#e91e63' },
} satisfies TemplatePlugin
