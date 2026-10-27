// 简历数据模型 —— 结构化数据为单一数据源（single source of truth）
// 模板渲染、Markdown 序列化/解析、PDF 导出均基于此模型

// 仅通过类型依赖取得注册表派生的 id；数据模型不加载模板组件或样式。
import type { TemplateId } from '@/templates/registry'
export type { TemplateId }

export interface ThemeConfig {
  primaryColor: string // 主色，注入 --accent
  fontSize: number // 正文字号 px，注入 --fs
  margin: number // 纸张边距 px；沿用历史数值，不按 mm 重新解释
  lineHeight: number // 正文行高
  fontFamily?: string // 正文字体族 id，映射 FONT_OPTIONS，默认 'sans'
  // 各级标题独立字号 px（可选）；未设置时回退各模板默认 em 比例
  h1Size?: number // H1（姓名）
  h2Size?: number // H2（分节标题）
  h3Size?: number // H3（条目标题）
  // H2 分节间距 px（可选）：注入 --section-gap，控制各分节标题 margin-top。
  // 未设置时回退各模板原值（18~28px，设计师按模板调优），故不设全局默认
  sectionGap?: number
  photoWidth?: number // 照片显示宽度 px，高度按证件照比例自动计算
}

// 简历正文字体族选项：id 用于存储，stack 为 CSS font-family 值
export interface FontOption {
  id: string
  label: string
  stack: string
}

export const FONT_OPTIONS: FontOption[] = [
  // web 字体（思源/霞鹜文楷/阿里普惠/Inter 等）由预览字体加载器按需引入；
  // 系统字体（苹方/雅黑/Times/宋体）作为回退链兜底，离线或 CDN 不可用时仍可正常渲染
  {
    id: 'sans',
    label: '思源黑体',
    stack: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
  },
  {
    id: 'serif',
    label: '思源宋体',
    stack: '"Noto Serif SC", "Songti SC", "SimSun", "Times New Roman", Georgia, serif',
  },
  {
    id: 'wenkai',
    label: '霞鹜文楷',
    stack: '"LXGW WenKai", "Noto Serif SC", "Songti SC", serif',
  },
  {
    id: 'puhuiti',
    label: '阿里普惠体',
    stack: '"AlibabaPuHuiTi", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  {
    id: 'inter',
    label: 'Inter',
    stack: 'Inter, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  {
    id: 'source-sans',
    label: 'Source Sans',
    stack: '"Source Sans 3", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  {
    id: 'lora',
    label: 'Lora',
    stack: 'Lora, Georgia, "Noto Serif SC", "Songti SC", serif',
  },
  {
    id: 'eb-garamond',
    label: 'EB Garamond',
    stack: '"EB Garamond", "Times New Roman", "Noto Serif SC", "Songti SC", serif',
  },
  { id: 'mono', label: '等宽', stack: '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace' },
  {
    id: 'technical-print',
    label: '技术印刷体',
    stack: '"Times New Roman", "SimHei", "黑体", "Microsoft YaHei", "PingFang SC", sans-serif',
  },
]

export function fontStack(id?: string): string {
  return FONT_OPTIONS.find((f) => f.id === id)?.stack ?? FONT_OPTIONS[0].stack
}

export interface Contact {
  phone: string
  email: string
  location: string
  website: string
  github: string
}

export interface BasicsData {
  name: string
  title: string // 职位/一句话标签
  workExperience?: string // 工作经验短文本，如「5 年工作经验」；留空不展示
  contact: Contact
  summary: string // Markdown
  photo?: string // 已压缩的本地图片 data URL，随 Markdown 导入导出
}

export interface Subproject {
  id: string
  title: string // 公司/学校/项目名
  subtitle: string // 角色/学位
  rightText?: string // 条目头右对齐文本（行内 Markdown，可放时间/GPA/地点等），可空
  description: string // Markdown
}

export interface DatedItem extends Subproject {
  projects?: Subproject[] // 公司/条目下的一级子项目；旧文档缺省不含此字段
}

export interface ListSectionData {
  items: DatedItem[]
}

export interface SkillGroup {
  id: string
  category: string
  items: string[]
}

// 技能：采用 Markdown 文本（与项目经验描述一致），支持列表/加粗等
export interface SkillsData {
  content: string
}

export interface CustomData {
  title: string
  content: string // Markdown，游离内容兜底
}

export type SectionType =
  | 'basics'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'custom'

interface BaseSection {
  id: string
  type: SectionType
  title: string // 分节显示标题
}

export interface BasicsSection extends BaseSection {
  type: 'basics'
  data: BasicsData
}
export interface ExperienceSection extends BaseSection {
  type: 'experience'
  data: ListSectionData
}
export interface EducationSection extends BaseSection {
  type: 'education'
  data: ListSectionData
}
export interface SkillsSection extends BaseSection {
  type: 'skills'
  data: SkillsData
}
export interface ProjectsSection extends BaseSection {
  type: 'projects'
  data: ListSectionData
}
export interface CustomSection extends BaseSection {
  type: 'custom'
  data: CustomData
}

export type Section =
  | BasicsSection
  | ExperienceSection
  | EducationSection
  | SkillsSection
  | ProjectsSection
  | CustomSection

export type SectionRegion = 'main' | 'sidebar'

// 布局独立于正文保存；未配置的分节沿用当前模板的默认位置和原始顺序。
export interface ResumeLayout {
  order?: string[] // 分节 id 的显示顺序，不改变 Markdown 正文顺序
  regions?: Record<string, SectionRegion> // 按分节 id 指定主栏 / 侧栏
  sidebarWidth?: number // 侧栏占纸张宽度的百分数
}

export interface Resume {
  id: string
  name: string // 简历名称（如「张三-前端」）
  template: TemplateId
  theme: ThemeConfig
  // 独立主题模板只保存用户覆盖值；不改写旧模板共用的 theme。
  templateThemeOverrides?: Record<string, Partial<ThemeConfig>>
  sections: Section[]
  layout?: ResumeLayout
  updatedAt: number
}

// 导入和历史数据在读取边界可携带尚未归一化的模板标识。
export type ResumeInput = Omit<Resume, 'template'> & { template: string }

// 可被各 Section 类型复用的条目类型映射
export type ItemSection = ExperienceSection | EducationSection | ProjectsSection

export const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#1a365d',
  fontSize: 14,
  margin: 40,
  lineHeight: 1.6,
  fontFamily: 'sans',
}

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  basics: '基本信息',
  experience: '工作经历',
  education: '教育背景',
  skills: '技能',
  projects: '项目经验',
  custom: '自定义',
}
