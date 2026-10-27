// 结构化 → Markdown 序列化器（与 parse.ts 尽量互逆）
import type {
  BasicsData,
  Contact,
  ListSectionData,
  Resume,
  Section,
  SkillsData,
} from '../model'
import { isResumePhoto, RESUME_PHOTO_ALT } from '../photo'
import { SUBPROJECT_PREFIX } from './syntax'
import { escapeHeadingText, serializeHeadingMetadata } from './metadata'
import { serializeItemHeading } from './itemHeading'

function quoteBlock(text: string): string {
  if (!text.trim()) return ''
  return text
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n')
}

// basics 各字段的键前缀：与 parse.ts 的 BASICS_FIELDS 保持一致（互逆）
// 每字段独立成行带语义前缀，让 parse 按键精确归属，彻底消除 title/contact 耦合、
// 位置依赖、启发式分类及「| 出现在值里」导致的同步漂移
const BASICS_PREFIXES: { prefix: string; field: 'title' | 'workExperience' | keyof Contact }[] = [
  { prefix: '职位', field: 'title' },
  { prefix: '工作经验', field: 'workExperience' },
  { prefix: '所在地', field: 'location' },
  { prefix: '电话', field: 'phone' },
  { prefix: '邮箱', field: 'email' },
  { prefix: '网站', field: 'website' },
  { prefix: 'GitHub', field: 'github' },
]

function serializeBasics(data: BasicsData): string {
  const c = data.contact
  const lines = [`# ${escapeHeadingText(data.name)}`]
  // 各字段独立成 paragraph（空行分隔）：tiptap-markdown breaks:false 会把无空行分隔的
  // 相邻纯文本行合并为单行软换行（getMarkdown 输出空格连接），导致往返漂移；
  // 空行分隔强制 paragraph 边界，保证 rich ⇄ source 往返无损。title 不再与 contact 挤一行
  const fields = BASICS_PREFIXES.map(({ prefix, field }) => {
    const v = field === 'title' || field === 'workExperience' ? data[field] : c[field]
    return v && v.trim() ? `${prefix}：${v.trim()}` : ''
  }).filter(Boolean)
  for (const f of fields) lines.push('', f)
  if (isResumePhoto(data.photo)) lines.push('', `![${RESUME_PHOTO_ALT}](${data.photo})`)
  if (data.summary.trim()) {
    lines.push('')
    lines.push(quoteBlock(data.summary))
  }
  return lines.join('\n')
}

function serializeListSection(title: string, data: ListSectionData): string {
  const lines = [`## ${escapeHeadingText(title)}`]
  for (const item of data.items) {
    // 条目头右对齐：通用 rightText 字段经 || 分隔，左侧标题左对齐、右侧右对齐
    // 时间/GPA/地点等均可放入 rightText，不再为时间专设 start/end 字段
    lines.push('', serializeHeadingMetadata({ kind: 'item', id: item.id }), '', `### ${serializeItemHeading(item)}`)
    // 正文 description 原样输出；projects 与 experience/education 一致（单字段）
    // 空行分隔由各 item 间自然形成，避免「列表后紧跟引用/段落」被 marked 惰性续行并入上一项
    if (item.description.trim()) {
      lines.push(item.description)
    }
    for (const project of item.projects ?? []) {
      lines.push('', serializeHeadingMetadata({ kind: 'subproject', id: project.id }), '', `#### ${SUBPROJECT_PREFIX}${serializeItemHeading(project)}`)
      if (project.description.trim()) lines.push(project.description)
    }
  }
  return lines.join('\n')
}

function serializeSkills(title: string, data: SkillsData): string {
  const lines = [`## ${escapeHeadingText(title)}`]
  if (data.content.trim()) lines.push(data.content)
  return lines.join('\n')
}

function serializeSectionBody(section: Section): string {
  switch (section.type) {
    case 'basics':
      return serializeBasics(section.data)
    case 'experience':
    case 'education':
    case 'projects':
      return serializeListSection(section.title, section.data)
    case 'skills':
      return serializeSkills(section.title, section.data)
    case 'custom':
      return `## ${escapeHeadingText(section.data.title)}\n${section.data.content}`
  }
}

function serializeSection(section: Section): string {
  const metadata = serializeHeadingMetadata({
    kind: 'section', id: section.id, type: section.type,
    ...(section.type === 'basics' ? { title: section.title } : {}),
  })
  return `${metadata}\n\n${serializeSectionBody(section)}`
}

export function serializeResume(resume: Resume): string {
  return resume.sections.map(serializeSection).join('\n\n')
}

// 仅序列化 sections（含结构标记）；源码界面通过 sourceDocument 分离内部标识后展示。
export function serializeSections(sections: Section[]): string {
  return sections.map(serializeSection).join('\n\n')
}
