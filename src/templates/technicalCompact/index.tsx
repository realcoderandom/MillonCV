// 技术精简：高密度技术简历，复用结构化照片、子项目与 Markdown 正文。
import type { ReactElement } from 'react'
import { Basics, Md, MdInline, previewItemProps, previewSectionProps, Subprojects } from '../rendering'
import type { ItemSection, Section } from '@/resume/model'
import type { TemplateBodyProps, TemplatePlugin } from '../types'
import './technicalCompact.css'

function Items({ section }: { section: ItemSection }) {
  const projects = section.type === 'projects'
  return (
    <section className="technical-compact-section" {...previewSectionProps(section.id, section.title)} data-section-type={section.type}>
      <h2 data-resume-field="heading">{section.title}</h2>
      {section.data.items.map((item) => (
        <div className="technical-compact-item" key={item.id} role="group" {...previewItemProps(item)}>
          <div className={projects ? 'technical-compact-project-head item-head' : 'technical-compact-company item-head'}>
            <h3 data-resume-field="title">
              {item.title}
              {item.subtitle && <span className="item-subtitle" data-resume-field="subtitle"> · {item.subtitle}</span>}
            </h3>
            <MdInline md={item.rightText} />
          </div>
          <div className="technical-compact-description"><Md md={item.description} field="description" /></div>
          <Subprojects projects={item.projects} />
        </div>
      ))}
    </section>
  )
}

function SectionContent({ section }: { section: Section }): ReactElement {
  switch (section.type) {
    case 'basics':
      return <Basics data={section.data} sectionId={section.id} title={section.title} />
    case 'experience':
    case 'education':
    case 'projects':
      return <Items section={section} />
    case 'skills':
    case 'custom':
      return (
        <section className="technical-compact-section" {...previewSectionProps(section.id, section.title)} data-section-type={section.type}>
          <h2 data-resume-field="heading">{section.type === 'custom' ? section.data.title : section.title}</h2>
          <Md md={section.data.content} field="content" />
        </section>
      )
  }
}

function Body({ sections }: TemplateBodyProps) {
  return <>{sections.map((section) => <SectionContent key={section.id} section={section} />)}</>
}

export const technicalCompact = {
  id: 'technicalCompact' as const,
  label: '技术精简',
  bestFor: '技术求职 · 实习与项目经验',
  description: '蓝色分节线、灰色公司条与高密度单栏',
  Body,
  themeScope: 'template',
  // 保留紧凑正文与 10mm 横向边距，收敛章节字号并增加行间留白，拉开层级。
  defaultTheme: {
    primaryColor: '#2458b8',
    fontSize: 14,
    margin: 37.8,
    lineHeight: 1.52,
    fontFamily: 'sans',
    h1Size: 32,
    h2Size: 17,
    h3Size: 15.33,
    sectionGap: 10,
  },
} satisfies TemplatePlugin
