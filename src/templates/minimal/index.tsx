// 简约模板 —— 单列 · 无衬线 · 细分隔
import type { TemplatePlugin } from '../types'
import { SingleColumnBody } from '../rendering'
import './minimal.css'

export const minimal = {
  id: 'minimal' as const,
  label: '简约',
  bestFor: '应届生 · 内容精简',
  description: '克制留白，突出内容本身',
  Body: SingleColumnBody,
} satisfies TemplatePlugin
