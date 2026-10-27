import type { ComponentType } from 'react'
import type { ResumeLayout, Section, SectionType, ThemeConfig } from '@/resume/model'

export interface TemplateBodyProps {
  sections: Section[]
  layout?: ResumeLayout
}

// 插件契约独立于注册表；新增模板保留自己的 id 字面量，再在注册表登记。
export interface TemplatePlugin<Id extends string = string> {
  id: Id
  label: string
  bestFor: string
  description: string
  Body: ComponentType<TemplateBodyProps>
  sidebar?: {
    defaultSectionTypes: readonly SectionType[]
    defaultWidth: number
  }
  themeScope?: 'document' | 'template'
  defaultTheme?: Partial<ThemeConfig>
}
