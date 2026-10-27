// 平面大气模板 —— 单栏 · 扁平满宽色块标题
import type { TemplatePlugin } from '../types'
import { SingleColumnBody } from '../rendering'
import './flat.css'

export const flat = {
  id: 'flat' as const,
  label: '平面大气',
  bestFor: '市场 · 运营与销售',
  description: '满宽标题，层级醒目直接',
  Body: SingleColumnBody,
  defaultTheme: { primaryColor: '#2b6cb0' },
} satisfies TemplatePlugin
