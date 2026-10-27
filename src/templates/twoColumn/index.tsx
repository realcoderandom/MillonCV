// 两栏紧凑模板 —— 通栏身份区，教育与技能留在浅色侧栏。
import { SidebarBody } from '../rendering'
import type { TemplateBodyProps, TemplatePlugin } from '../types'
import './twoColumn.css'

const sidebar: NonNullable<TemplatePlugin['sidebar']> = {
  defaultSectionTypes: ['skills', 'education'],
  defaultWidth: 32,
}

function Body({ sections, layout }: TemplateBodyProps) {
  return <SidebarBody sections={sections} layout={layout} sidebarTypes={sidebar.defaultSectionTypes} sideClassName="tc-side" mainClassName="tc-main" />
}

export const twoColumn = {
  id: 'twoColumn' as const,
  label: '两栏紧凑',
  bestFor: '经历丰富 · 控制篇幅',
  description: '高信息密度，适合压缩到一页',
  Body,
  sidebar,
  defaultTheme: { primaryColor: '#38bdf8' },
} satisfies TemplatePlugin
