// 重点色模板 —— 单栏 · 标题色块强调条
import type { TemplatePlugin } from '../types'
import { SingleColumnBody } from '../rendering'
import './focus.css'

export const focus = {
  id: 'focus' as const,
  label: '重点色',
  bestFor: '社招 · 突出关键业绩',
  description: '色块分节，浏览路径明确',
  Body: SingleColumnBody,
  defaultTheme: { primaryColor: '#2563eb' },
} satisfies TemplatePlugin
