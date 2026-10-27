// 模板共享渲染原子组件 —— 各模板 Body 组合使用，避免重复（DRY）
import { memo, type CSSProperties, type ReactElement } from 'react'
import { MapPin, Phone, Mail, Globe, Github, History } from 'lucide-react'
import type {
  BasicsData,
  Contact,
  CustomSection as CustomSectionModel,
  ItemSection,
  ResumeLayout,
  Section,
  SectionType,
  SkillsSection as SkillsSectionModel,
  Subproject,
  ThemeConfig,
} from '@/resume/model'
import { fontStack } from '@/resume/model'
import { renderMarkdown, renderInlineMarkdown } from '@/resume/markdown/render'
import { inlineToPlain } from '@/resume/markdown/plain'
import { isResumePhoto, normalizePhotoWidth } from '@/resume/photo'
import type { ResumeField } from '@/resume/focus'
import { splitSections } from '@/resume/layout'
import { accentPalette } from './colors'

export function previewSectionProps(id: string, title: string) {
  return { 'data-resume-section': id, tabIndex: 0, 'aria-label': title, 'aria-describedby': 'resume-preview-edit-help', 'aria-keyshortcuts': 'Enter' }
}

export function previewItemProps(item: Subproject, subproject = false) {
  return {
    [subproject ? 'data-resume-project' : 'data-resume-item']: item.id,
    tabIndex: 0, 'aria-label': item.title || '新条目', 'aria-describedby': 'resume-preview-edit-help', 'aria-keyshortcuts': 'Enter',
  }
}

// Markdown 文本渲染（已净化）；md 可为 undefined（可选字段兜底）
export function Md({ md, field }: { md?: string; field?: ResumeField }) {
  if (!md || !md.trim()) return null
  return <div data-resume-field={field} dangerouslySetInnerHTML={{ __html: renderMarkdown(md) }} />
}

// 行内 Markdown 渲染（条目头 rightText 等行内字段）；产出 <span class="item-right">，
// 不破坏 .item-head 的 flex 行内布局（block 级 <p> 会撑满换行）
export function MdInline({ md }: { md?: string }) {
  if (!md || !md.trim()) return null
  return <span className="item-right" data-resume-field="rightText" dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(md) }} />
}

// 联系方式字段 → 图标映射（顺序即展示顺序）；图标用 em 单位随 contact-line 字号缩放
const CONTACT_ICONS: { key: keyof Contact; Icon: typeof MapPin }[] = [
  { key: 'location', Icon: MapPin },
  { key: 'phone', Icon: Phone },
  { key: 'email', Icon: Mail },
  { key: 'website', Icon: Globe },
  { key: 'github', Icon: Github },
]

// 联系方式值 → 跳转 href；返回 null 表示纯文本展示（location/phone）
// value 经 inlineToPlain 清洗为纯文本后再据此生成 href，避免链接语法污染
function contactHref(key: keyof Contact, value: string): string | null {
  const v = value.trim()
  if (!v) return null
  if (key === 'email') return `mailto:${v}`
  if (key === 'website' || key === 'github') {
    // 已带协议直接用，否则补 https://（github.com/xxx 等裸域名可正常跳转）
    return /^https?:\/\//i.test(v) ? v : `https://${v}`
  }
  return null
}

export function ContactLine({ contact }: { contact: Contact }) {
  const parts = CONTACT_ICONS.filter(({ key }) => contact[key]?.trim())
  if (!parts.length) return null
  const groups = [
    parts.filter(({ key }) => key !== 'website' && key !== 'github'),
    parts.filter(({ key }) => key === 'website' || key === 'github'),
  ].filter((group) => group.length > 0)
  return (
    <div className="contact-line contact-details">
      {groups.map((group) => <div className="contact-group" key={group[0].key}>
        {group.map(({ key, Icon }) => {
          // 保留完整显示文本与跳转地址，窄栏内自然换行，不截断联系信息。
          const label = inlineToPlain(contact[key])
          const href = contactHref(key, label)
          return (
            <span key={key} className="contact-item" data-resume-field={key}>
              <Icon className="contact-icon" size="0.95em" strokeWidth={1.8} aria-hidden="true" />
              {href ? (
                <a className="contact-link" href={href} target="_blank" rel="noreferrer">{label}</a>
              ) : label}
            </span>
          )
        })}
      </div>)}
    </div>
  )
}

// 职位与年限作为一组参与换行，避免窄栏中姓名挤着职位、年限孤立一行。
export function IdentityLine({ data, roleIcon: RoleIcon }: { data: BasicsData; roleIcon?: typeof MapPin }) {
  const name = data.name.trim()
  const title = data.title.trim()
  const workExperience = inlineToPlain(data.workExperience ?? '')
  if (!name && !title && !workExperience) return null
  return (
    <div className="resume-identity">
      {name && <h1 data-resume-field="name">{name}</h1>}
      {(title || workExperience) && <div className="resume-identity-details">
        {title && <div className="contact-line role-line" data-resume-field="title">
          {RoleIcon && <RoleIcon size="1em" className="contact-icon" aria-hidden="true" />}
          <span>{title}</span>
        </div>}
        {workExperience && <span className="contact-line resume-identity-experience" data-resume-field="workExperience">
          <History size="0.95em" className="contact-icon" strokeWidth={1.8} aria-hidden="true" />
          <span>{workExperience}</span>
        </span>}
      </div>}
    </div>
  )
}

export function Summary({ summary }: { summary: string }) {
  if (!summary || !summary.trim()) return null
  return (
    <blockquote className="resume-summary" data-resume-field="summary">
      <Md md={summary} />
    </blockquote>
  )
}

// 照片独占一列，摘要跨两列；大照片不会侵入正文，无照时不留空列。
// memo：parse 引用稳定化后，未变 section 引用不变，跳过重渲染（含 renderMarkdown）
export const Basics = memo(function Basics({ data, sectionId, title }: { data: BasicsData; sectionId: string; title: string }) {
  return (
    <header {...previewSectionProps(sectionId, title)} className={`resume-basics${isResumePhoto(data.photo) ? ' has-photo' : ''}`}>
      <div className="resume-basics-main">
        <IdentityLine data={data} />
        <ContactLine contact={data.contact} />
      </div>
      <ResumePhoto photo={data.photo} />
      <Summary summary={data.summary} />
    </header>
  )
})

export function ResumePhoto({ photo }: { photo?: string }) {
  return isResumePhoto(photo) ? <img className="resume-portrait" data-resume-field="photo" src={photo} alt="证件照" width={84} height={108} /> : null
}

export function Subprojects({ projects }: { projects?: Subproject[] }) {
  if (!projects?.length) return null
  return <>{projects.map((project) => (
    <article className="resume-subproject" key={project.id} {...previewItemProps(project, true)}>
      <div className="subproject-head item-head">
        <h4 data-resume-field="title">{project.title}{project.subtitle && <span className="item-subtitle" data-resume-field="subtitle"> — {project.subtitle}</span>}</h4>
        <MdInline md={project.rightText} />
      </div>
      <Md md={project.description} field="description" />
    </article>
  ))}</>
}

// 列表型分节（工作/教育/项目）
// memo：section 引用稳定时跳过重渲染（parse 引用稳定化保证未变 section 引用不变）
export const ItemsSection = memo(function ItemsSection({ section }: { section: ItemSection }) {
  const { data } = section
  return (
    <section {...previewSectionProps(section.id, section.title)} data-section-type={section.type}>
      <h2 data-resume-field="heading">{section.title}</h2>
      {data.items.map((it) => (
        <div className="item" key={it.id} role="group" {...previewItemProps(it)}>
          <div className="item-head">
            <h3 data-resume-field="title">
              {it.title}
              {it.subtitle && <span className="item-subtitle" data-resume-field="subtitle"> — {it.subtitle}</span>}
            </h3>
            <MdInline md={it.rightText} />
          </div>
          <Md md={it.description} field="description" />
          <Subprojects projects={it.projects} />
        </div>
      ))}
    </section>
  )
})

// 技能分节：Markdown 渲染（与项目经验描述一致）
export const SkillsSection = memo(function SkillsSection({ section }: { section: SkillsSectionModel }) {
  const { data } = section
  return (
    <section {...previewSectionProps(section.id, section.title)} data-section-type={section.type}>
      <h2 data-resume-field="heading">{section.title}</h2>
      <Md md={data.content} field="content" />
    </section>
  )
})

// 自定义分节
export const CustomSection = memo(function CustomSection({ section }: { section: CustomSectionModel }) {
  const { data } = section
  return (
    <section {...previewSectionProps(section.id, section.title)} data-section-type={section.type}>
      <h2 data-resume-field="heading">{data.title}</h2>
      <Md md={data.content} field="content" />
    </section>
  )
})

// 分节分发
export const SectionView = memo(function SectionView({ section }: { section: Section }): ReactElement {
  switch (section.type) {
    case 'basics':
      return <Basics data={section.data} sectionId={section.id} title={section.title} />
    case 'skills':
      return <SkillsSection section={section} />
    case 'custom':
      return <CustomSection section={section} />
    case 'experience':
    case 'education':
    case 'projects':
      return <ItemsSection section={section} />
  }
})

// 单栏布局默认 Body：sections 顺序渲染，可选外层 wrapper（如 dark 的 accent-soften）
// 供纯单栏模板直接复用，避免逐字重复 17 行 Body（DRY）
export function SingleColumnBody({ sections, className }: { sections: Section[]; className?: string }) {
  const inner = (
    <>
      {sections.map((s) => (
        <SectionView key={s.id} section={s} />
      ))}
    </>
  )
  return className ? <div className={className}>{inner}</div> : inner
}

// 默认主栏开头的基本信息提到通栏页首；显式跨栏与排序继续按原布局显示。
export function SidebarBody({ sections, layout, sidebarTypes, sideClassName = 'md-side', mainClassName = 'md-main' }: {
  sections: Section[]
  layout?: ResumeLayout
  sidebarTypes: readonly SectionType[]
  sideClassName?: string
  mainClassName?: string
}) {
  const { main, sidebar } = splitSections(sections, layout, sidebarTypes)
  const firstBody = main.findIndex((section) => section.type !== 'basics')
  const headerCount = firstBody < 0 ? main.length : firstBody
  const header = main.slice(0, headerCount)
  const body = main.slice(headerCount)
  return <>
    {header.length > 0 && <div className="resume-column-header">
      {header.map((section) => <SectionView key={section.id} section={section} />)}
    </div>}
    {(sidebar.length > 0 || body.length > 0) && <div className="resume-columns" data-resume-columns={sidebar.length > 0 && body.length > 0 ? 'two' : 'one'}>
      {sidebar.length > 0 && <div className={`${sideClassName} resume-column-side`}>
        {sidebar.map((section) => <SectionView key={section.id} section={section} />)}
      </div>}
      {body.length > 0 && <div className={`${mainClassName} resume-column-main`}>
        {body.map((section) => <SectionView key={section.id} section={section} />)}
      </div>}
    </div>}
  </>
}

// CSS 自定义属性需以 string key 注入，CSSProperties 不含这些键，扩展模板字面量类型以消除双重断言
type CSSVarProps = CSSProperties & Record<`--${string}`, string>

// 主题 CSS 变量样式对象
export function themeStyle(theme: ThemeConfig): CSSProperties {
  const palette = accentPalette(theme.primaryColor)
  const vars: CSSVarProps = {
    '--accent': theme.primaryColor,
    '--accent-text': palette.text,
    '--accent-soft': palette.soft,
    '--accent-line': palette.line,
    '--accent-band': palette.band,
    '--accent-on-band': palette.onBand,
    '--accent-on-dark': palette.onDark,
    '--accent-rgb': palette.rgb,
    '--fs': `${theme.fontSize}px`,
    '--pad': String(theme.margin),
    '--lh': String(theme.lineHeight),
    '--font': fontStack(theme.fontFamily),
  }
  // 标题字号仅在用户显式设置时注入，否则 CSS 回退到各模板默认 em 比例
  if (theme.h1Size) vars['--fs-h1'] = `${theme.h1Size}px`
  if (theme.h2Size) vars['--fs-h2'] = `${theme.h2Size}px`
  if (theme.h3Size) vars['--fs-h3'] = `${theme.h3Size}px`
  // 分节间距仅在显式设置时注入，否则各模板回退原 margin-top
  if (theme.sectionGap) vars['--section-gap'] = `${theme.sectionGap}px`
  const photoWidth = normalizePhotoWidth(theme.photoWidth)
  if (photoWidth !== undefined) vars['--photo-width'] = `${photoWidth}px`
  return vars
}
