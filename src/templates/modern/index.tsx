// 现代模板 —— 通栏身份区 + 浅色技能侧栏，保留用户跨栏与排序配置。
import { SidebarBody } from '../rendering'
import type { TemplateBodyProps, TemplatePlugin } from '../types'
import './modern.css'

const sidebar: NonNullable<TemplatePlugin['sidebar']> = {
  defaultSectionTypes: ['skills'],
  defaultWidth: 30,
}

function Body({ sections, layout }: TemplateBodyProps) {
  return <SidebarBody sections={sections} layout={layout} sidebarTypes={sidebar.defaultSectionTypes} />
}

export const modern = {
  id: 'modern' as const,
  label: '现代',
  bestFor: '互联网 · 产品与技术',
  description: '通栏页首与浅色侧栏，快速定位经历与技能',
  Body,
  sidebar,
  defaultTheme: { primaryColor: '#1abc9c' },
} satisfies TemplatePlugin
