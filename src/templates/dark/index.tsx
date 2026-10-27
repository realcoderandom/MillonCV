// 极简深色模板 —— 深色背景 · 极简留白
import type { Section } from '@/resume/model'
import type { TemplatePlugin } from '../types'
import { SingleColumnBody } from '../rendering'
import './dark.css'

// 复用单栏布局，外层 accent-soften 启用主色软化（深底避免高饱和刺眼）
export const dark = {
  id: 'dark' as const,
  label: '极简深色',
  bestFor: '创意展示 · 非传统投递',
  description: '深色画布，适合屏幕浏览',
  Body: ({ sections }: { sections: Section[] }) => (
    <SingleColumnBody sections={sections} className="accent-soften" />
  ),
  defaultTheme: { primaryColor: '#a78bfa' },
} satisfies TemplatePlugin
