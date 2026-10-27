// 学术模板 —— 无照身份居中 · 章节左对齐 · 细分隔线
import type { TemplatePlugin } from '../types'
import { SingleColumnBody } from '../rendering'
import './academic.css'

export const academic = {
  id: 'academic' as const,
  label: '学术',
  bestFor: '科研 · 高校与深造',
  description: '细线单栏，适合正式长内容',
  Body: SingleColumnBody,
  defaultTheme: { primaryColor: '#4a4a4a' },
} satisfies TemplatePlugin
