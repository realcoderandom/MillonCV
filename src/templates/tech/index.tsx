// 科技模板 —— 深色侧栏 + 强调色条（双栏，结构同 modern）
// 基本信息默认通栏，技能入侧栏，用户布局可覆盖分节位置。
import { SidebarBody } from '../rendering'
import type { TemplateBodyProps, TemplatePlugin } from '../types'
import './tech.css'

const sidebar: NonNullable<TemplatePlugin['sidebar']> = {
  defaultSectionTypes: ['skills'],
  defaultWidth: 30,
}

function Body({ sections, layout }: TemplateBodyProps) {
  return <SidebarBody sections={sections} layout={layout} sidebarTypes={sidebar.defaultSectionTypes} />
}

export const tech = {
  id: 'tech' as const,
  label: '科技',
  bestFor: '开发者 · 技术作品展示',
  description: '深色侧栏，强化技术标签',
  Body,
  sidebar,
  defaultTheme: { primaryColor: '#38bdf8' },
} satisfies TemplatePlugin
