// Markdown → 结构化 sections 解析器（与 serialize.ts 尽量互逆）
// 策略：marked.lexer 得 tokens，按标题层级启发式映射回结构化；
//       无法映射的游离内容归入 custom section，确保不丢失。
/* eslint-disable @typescript-eslint/no-explicit-any */
import { marked } from 'marked'
import type {
  Contact,
  DatedItem,
  ListSectionData,
  Section,
  SectionType,
  SkillsData,
  Subproject,
} from '../model'
// SkillGroup 已移除：技能改为 Markdown content 字段
import { uid } from '@/shared/lib/id'
import { inlineToPlain } from './plain'
import { isResumePhoto, RESUME_PHOTO_ALT } from '../photo'
import { metadataMatchesLevel, parseHeadingMetadata, type HeadingMetadata } from './metadata'
import { parseItemHeading } from './itemHeading'

export interface ParseDiagnostic {
  kind: 'custom-fallback' | 'section-type-changed'
  title: string
  fromType?: SectionType
  toType: SectionType
}

export interface ParseResult {
  sections: Section[]
  diagnostics: ParseDiagnostic[]
}

// 源码编辑器将结构标识保存在正文之外；解析结束后回传最终 id，避免新标题下次改名时丢失类型。
export interface ParsedHeading {
  offset: number
  metadata: HeadingMetadata
}

// blockquote token → Markdown 引用文本（每行补 `>` 前缀，保持多行引用规范）
// extractBlockquote 仅去 `>` 取纯文本，这里按行重新补前缀，使序列化往返稳定；
// 非 basics 模块的 `>` 经任务3弱化为「仅行间距」样式，但数据层保留 blockquote 语义
function blockquoteToMd(token: any): string {
  return extractBlockquote(token)
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n')
}

export function inferSectionType(title: string): SectionType {
  const t = title.toLowerCase()
  if (/教育|学历|education/.test(t)) return 'education'
  if (/项目|project/.test(t)) return 'projects'
  if (/技能|skill|技术栈|技术/.test(t)) return 'skills'
  if (/工作|经历|experience|职业/.test(t)) return 'experience'
  return 'custom'
}

function classifyContact(s: string): keyof Contact {
  if (/@/.test(s)) return 'email'
  if (/github/i.test(s)) return 'github'
  if (/^https?:\/\//.test(s)) return 'website'
  if (/^[\d\s\-+()]+$/.test(s)) return 'phone'
  return 'location'
}

// basics 各字段的键前缀：与 serialize.ts 的 BASICS_PREFIXES 保持一致（互逆）
// parse 时按键前缀精确归字段，不再依赖 classifyContact 启发式与 parts[0] 位置
const BASICS_FIELDS: { prefix: string; field: 'title' | 'workExperience' | keyof Contact }[] = [
  { prefix: '职位', field: 'title' },
  { prefix: '工作经验', field: 'workExperience' },
  { prefix: '所在地', field: 'location' },
  { prefix: '电话', field: 'phone' },
  { prefix: '邮箱', field: 'email' },
  { prefix: '网站', field: 'website' },
  { prefix: 'GitHub', field: 'github' },
]

// 按「键：值」前缀匹配 basics 字段（含 title）；大小写不敏感（GitHub）；无前缀返回 null
function matchBasicsField(seg: string): { field: 'title' | 'workExperience' | keyof Contact; value: string } | null {
  const m = seg.match(/^([^：:]+)[：:]\s*(.*)$/)
  if (!m) return null
  const name = m[1].trim().toLowerCase()
  const found = BASICS_FIELDS.find(({ prefix }) => prefix.toLowerCase() === name)
  return found ? { field: found.field, value: m[2].trim() } : null
}

function listToMd(token: any): string {
  // list item 的 text 会移除子列表的缩进，重新拼接会把多级列表拍平成同一级。
  // marked 的 raw 保留原始 marker、缩进和嵌套结构，直接存回 Markdown 才能无损往返。
  return String(token.raw || '').trimEnd()
}

function extractBlockquote(token: any): string {
  // 去掉一层引用标记而不重建子 token，保留简介中的列表、空行、嵌套引用和链接。
  if (typeof token.raw === 'string') return token.raw.replace(/^ {0,3}>[ \t]?/gm, '').trimEnd()
  const parts: string[] = []
  for (const t of token.tokens || []) {
    if (t.type === 'paragraph') parts.push(t.text)
    else if (typeof t.text === 'string') parts.push(t.text)
  }
  return parts.join('\n')
}

function newSection(type: SectionType, title: string, prevId?: string): Section {
  const id = prevId ?? uid()
  switch (type) {
    case 'experience':
      return { id, type: 'experience', title, data: { items: [] } }
    case 'education':
      return { id, type: 'education', title, data: { items: [] } }
    case 'projects':
      return { id, type: 'projects', title, data: { items: [] } }
    case 'skills':
      return { id, type: 'skills', title, data: { content: '' } }
    default:
      return { id, type: 'custom', title, data: { title, content: '' } }
  }
}

// 改名识别只比较正文；标题、分节 id、条目 id 不参与，避免重排或编辑器回写影响匹配。
function sectionContentKey(section: Section): string {
  switch (section.type) {
    case 'experience':
    case 'education':
    case 'projects':
      return JSON.stringify([
        section.type,
        section.data.items.map((item) => [
          item.title, item.subtitle ?? '', item.rightText ?? '', item.description,
          ...(item.projects?.length ? [item.projects.map((project) => [
            project.title, project.subtitle ?? '', project.rightText ?? '', project.description,
          ])] : []),
        ]),
      ])
    case 'skills':
    case 'custom':
      return JSON.stringify([section.type, section.data.content])
    default:
      return JSON.stringify([section.type, section.data])
  }
}

export function parseMarkdownToSections(md: string, prev?: Section[], onHeading?: (heading: ParsedHeading) => void): Section[] {
  if (!md.trim()) return []
  // rowSplit 是 render.ts 注册的自定义 block token（|| 行内右对齐），parse 不识别会丢弃内容。
  // 这里转回 paragraph（text=raw.trim() 即 "left || right"），让下游按段落文本处理，
  // render 时再次触发 rowSplit——serialize/parse/render 往返一致
  const tokens = (marked.lexer(md) as any[]).map((tk) =>
    tk.type === 'rowSplit' ? { ...tk, type: 'paragraph', text: String(tk.raw || '').trim() } : tk,
  )
  const sections: Section[] = []
  let current: Section | null = null
  let currentItem: DatedItem | null = null
  let currentSubproject: Subproject | null = null
  let previousItem: DatedItem | undefined
  let customBuf: { title: string; content: string[]; id?: string; explicit?: boolean; section?: Section } | null = null
  let pendingMetadata: HeadingMetadata | null = null
  const headingBindings: { offset: number; metadata: () => HeadingMetadata | null }[] = []
  let tokenOffset = 0
  const explicitSectionIds = new Set<string>()
  // 预留显式 id，避免前面新增的同名章节先通过启发式匹配占用它。
  const reservedSectionIds = new Set(tokens.flatMap((token) => {
    const metadata = token.type === 'html' ? parseHeadingMetadata(token.raw) : null
    return metadata?.kind === 'section' ? [metadata.id] : []
  }))

  // —— id 复用：与 prev sections 按 (type, title) 精确匹配，命中复用旧 id，
  // 避免每次 flush 生成全新 id 导致预览列表全量 remount（丢 DOM 连续性/焦点/性能）。
  // basics 按 type 匹配（title 固定）；item 在所属 section 内按 title 匹配。
  // 完成全部精确匹配后再识别改名，避免新增/改名分节抢走后续精确命中的 id。
  const prevSections = prev ?? []
  const usedSectionIds = new Set<string>()
  const usedItemIds = new Set<string>()
  const usedSubprojectIds = new Set<string>()
  let currentPrevItems = new Map<string, DatedItem>()
  const findPrevSection = (type: SectionType, title: string): Section | undefined => {
    const m = prevSections.find(
      (s) => s.type === type && s.title === title && !usedSectionIds.has(s.id) && !reservedSectionIds.has(s.id),
    )
    if (m) usedSectionIds.add(m.id)
    return m
  }
  const findPrevBasics = (): Section | undefined => {
    const m = prevSections.find((s) => s.type === 'basics' && !usedSectionIds.has(s.id) && !reservedSectionIds.has(s.id))
    if (m) usedSectionIds.add(m.id)
    return m
  }
  // 从匹配到的 prev list section 提取 items，按 title 建复用映射（排除已用 id，去重 title）
  const buildPrevItemsMap = (prevSec: Section | undefined): Map<string, DatedItem> => {
    const map = new Map<string, DatedItem>()
    if (!prevSec) return map
    const isList =
      prevSec.type === 'experience' ||
      prevSec.type === 'education' ||
      prevSec.type === 'projects'
    if (!isList) return map
    for (const it of (prevSec.data as ListSectionData).items) {
      if (usedItemIds.has(it.id) || map.has(it.title)) continue
      map.set(it.title, it)
    }
    return map
  }

  const flushCustom = () => {
    if (customBuf && (customBuf.explicit || customBuf.content.some((l) => l.trim()))) {
      const content = customBuf.content.join('\n\n').trim()
      const prevSec = customBuf.id ? undefined : findPrevSection('custom', customBuf.title)
      const section: Section = {
        id: customBuf.id ?? prevSec?.id ?? uid(),
        type: 'custom',
        title: customBuf.title,
        data: { title: customBuf.title, content },
      }
      customBuf.section = section
      sections.push(section)
    }
    customBuf = null
  }

  const claimId = (id: string, used: Set<string>): string => {
    const next = used.has(id) ? uid() : id
    used.add(next)
    return next
  }

  const prevSecItem = (id: string): DatedItem | undefined => {
    for (const section of prevSections) {
      if ('items' in section.data) {
        const item = section.data.items.find((candidate) => candidate.id === id)
        if (item) return item
      }
    }
  }
  const flushCurrent = () => {
    if (current) {
      const isListType =
        current.type === 'experience' ||
        current.type === 'education' ||
        current.type === 'projects'
      const emptyList =
        isListType && (current.data as ListSectionData).items.length === 0
      // 列表型分节下无 H3 的游离内容会被归入同名 customBuf（title 复用分节名），
      // 需避免与分节本身渲染出两个相同标题
      const sameNameBuf = customBuf != null && customBuf.title === current.title
      if (emptyList && sameNameBuf) {
        // 空壳分节：跳过，由 customBuf 承载标题与内容（不丢失且不重复）
      } else {
        sections.push(current)
        // 非空分节已 push，同名兜底改「其他」避免与分节标题重复
        if (sameNameBuf && customBuf) customBuf.title = '其他'
      }
    }
    current = null
    currentItem = null
    currentSubproject = null
    previousItem = undefined
  }

  for (const tk of tokens) {
    const headingOffset = tokenOffset
    tokenOffset += String(tk.raw ?? '').length
    if (tk.type === 'html') {
      const metadata = parseHeadingMetadata(tk.raw)
      if (metadata) {
        pendingMetadata = metadata
        continue
      }
    }
    if (tk.type === 'heading') {
      const metadata = pendingMetadata && metadataMatchesLevel(pendingMetadata, tk.depth) ? pendingMetadata : null
      pendingMetadata = null
      if (tk.depth === 1) {
        flushCurrent()
        flushCustom()
        const sectionMetadata = metadata?.kind === 'section' ? metadata : null
        const prevBasics = sectionMetadata ? undefined : findPrevBasics()
        const id = sectionMetadata ? claimId(sectionMetadata.id, usedSectionIds) : prevBasics?.id ?? uid()
        if (sectionMetadata) explicitSectionIds.add(id)
        const basics: Section = {
          id,
          type: 'basics',
          title: sectionMetadata?.title ?? '基本信息',
          data: {
            name: sectionMetadata ? inlineToPlain(tk.text) : tk.text,
            title: '',
            contact: { phone: '', email: '', location: '', website: '', github: '' },
            summary: '',
          },
        }
        sections.push(basics)
        headingBindings.push({ offset: headingOffset, metadata: () => ({ kind: 'section', id: basics.id, type: 'basics', title: basics.title }) })
        current = null
      } else if (tk.depth === 2) {
        flushCurrent()
        flushCustom()
        const sectionMetadata = metadata?.kind === 'section' ? metadata : null
        const title = sectionMetadata ? inlineToPlain(tk.text) : tk.text
        const type = sectionMetadata?.type ?? inferSectionType(title)
        const prevSec = sectionMetadata
          ? prevSections.find((section) => section.id === sectionMetadata.id && section.type === type)
          : findPrevSection(type, title)
        const id = sectionMetadata ? claimId(sectionMetadata.id, usedSectionIds) : prevSec?.id ?? uid()
        if (sectionMetadata) explicitSectionIds.add(id)
        if (type === 'custom') {
          // 显式 H2 即使为空也保留；游离内容的空兜底仍可忽略。
          customBuf = { title, content: [], id, explicit: true }
          current = null
        } else {
          currentPrevItems = buildPrevItemsMap(prevSec)
          current = newSection(type, title, id)
          currentItem = null
          currentSubproject = null
        }
        // 保存对象引用，后续启发式复用 id 时也能读到最终值。
        const section = current
        const buffer = customBuf
        headingBindings.push({ offset: headingOffset, metadata: () => {
          const resolved = section ?? buffer?.section
          if (!resolved || !sections.some((candidate) => candidate.id === resolved.id)) return null
          return { kind: 'section', id: resolved.id, type: resolved.type }
        } })
      } else {
        // depth >= 3
        if (
          current &&
          (current.type === 'experience' ||
            current.type === 'education' ||
            current.type === 'projects')
        ) {
          const childHeading = tk.depth === 4 ? tk.text.match(/^子项目[：:]\s*(.*)$/) : null
          if (childHeading && currentItem) {
            const head = parseItemHeading(childHeading[1])
            const previous = previousItem?.projects?.find((project) => project.title === head.title && !usedSubprojectIds.has(project.id))
            const id = metadata?.kind === 'subproject'
              ? claimId(metadata.id, usedSubprojectIds)
              : previous ? claimId(previous.id, usedSubprojectIds) : uid()
            currentSubproject = { id, description: '', ...head }
            const project = currentSubproject
            headingBindings.push({ offset: headingOffset, metadata: () => ({ kind: 'subproject', id: project.id }) })
            currentItem.projects ??= []
            currentItem.projects.push(currentSubproject)
            continue
          }
          const m = parseItemHeading(tk.text)
          // 复用 prev 同 title item 的 id（section 内去重），稳定预览 key
          const candidate = currentPrevItems.get(m.title)
          const prevItem = metadata?.kind === 'item'
            ? prevSecItem(metadata.id)
            : candidate && !usedItemIds.has(candidate.id) ? candidate : undefined
          const itemId = metadata?.kind === 'item'
            ? claimId(metadata.id, usedItemIds)
            : prevItem ? claimId(prevItem.id, usedItemIds) : uid()
          currentItem = { id: itemId, description: '', ...m }
          const item = currentItem
          headingBindings.push({ offset: headingOffset, metadata: () => ({ kind: 'item', id: item.id }) })
          previousItem = prevItem
          currentSubproject = null
          ;(current.data as ListSectionData).items.push(currentItem)
        } else if (customBuf) {
          customBuf.content.push(`### ${tk.text}`)
        }
      }
      continue
    }

    if (tk.type === 'space' || tk.type === 'hr') continue
    pendingMetadata = null

    const last = sections[sections.length - 1]
    const inBasics = last && last.type === 'basics' && !current && !customBuf

    if (inBasics) {
      if (tk.type === 'paragraph') {
        const b = last.data
        const image = tk.tokens?.length === 1 ? tk.tokens[0] : null
        if (image?.type === 'image' && image.text === RESUME_PHOTO_ALT && isResumePhoto(image.href)) {
          b.photo = image.href
          continue
        }
        // 富文本 linkify 会把裸邮箱/URL 转成 [text](url)，回写时清洗为纯文本，
        // 防止 contact 字段混入 Markdown 链接语法
        // marked 会把无空行分隔的多行字段合并为单个 paragraph（text 含 \n），故按行拆分逐行匹配
        const lines = inlineToPlain(tk.text)
          .split('\n')
          .map((s: string) => s.trim())
          .filter(Boolean)
        for (const line of lines) {
          // 新格式：「键：值」前缀命中 → 按键精确归字段（含 title）
          const f = matchBasicsField(line)
          if (f) {
            if (f.field === 'workExperience') {
              if (f.value) b.workExperience = f.value
              else delete b.workExperience
            } else if (f.field === 'title') b.title = f.value
            else b.contact[f.field] = f.value
            continue
          }
          // 旧格式混合行（无前缀、含 |）：title + classifyContact 启发式回退，兼容历史 source 文本
          if (line.includes('|')) {
            const parts = line
              .split('|')
              .map((s: string) => s.trim())
              .filter(Boolean)
            if (parts.length > 1) {
              if (!b.title) b.title = parts[0]
              for (let i = 1; i < parts.length; i++) {
                b.contact[classifyContact(parts[i])] = parts[i]
              }
              continue
            }
          }
          // 纯 title 行（无前缀、无 |）：仅当 title 未设时填入，避免覆盖已解析的 title
          if (!b.title) b.title = line
        }
        continue
      }
      if (tk.type === 'blockquote') {
        last.data.summary = extractBlockquote(tk)
        continue
      }
    }

    if (current) {
      if (current.type === 'skills') {
        // 技能：任意块内容原样累加为 Markdown 字符串
        const mdText = tk.type === 'list' ? listToMd(tk)
          : tk.type === 'paragraph' ? tk.text
          : tk.type === 'blockquote' ? blockquoteToMd(tk)
          : ''
        if (mdText) {
          ;(current.data as SkillsData).content = (current.data as SkillsData).content
            ? (current.data as SkillsData).content + '\n\n' + mdText
            : mdText
        }
        continue
      }
      if (
        current.type === 'experience' ||
        current.type === 'education' ||
        current.type === 'projects'
      ) {
        // 正文块（列表/段落/引用）原样累加为 description 的 Markdown 文本
        // 引用 `>` 在非 basics 模块经任务3弱化为行间距样式，数据层保留 blockquote 语义、往返无损；
        // 不再有 summary 独立字段，避免多个 blockquote 互相覆盖丢内容
        if (tk.type === 'list' || tk.type === 'paragraph' || tk.type === 'blockquote') {
          const mdText =
            tk.type === 'list' ? listToMd(tk)
            : tk.type === 'blockquote' ? blockquoteToMd(tk)
            : tk.text
          if (currentItem) {
            const target = currentSubproject ?? currentItem
            target.description = target.description
              ? target.description + '\n\n' + mdText
              : mdText
          } else {
            if (!customBuf) customBuf = { title: current.title, content: [] }
            customBuf.content.push(mdText)
          }
          continue
        }
      }
    }

    if (customBuf) {
      if (tk.type === 'list') customBuf.content.push(listToMd(tk))
      else if (tk.type === 'paragraph') customBuf.content.push(tk.text)
      else if (tk.type === 'blockquote') customBuf.content.push(blockquoteToMd(tk))
      continue
    }

    // 完全游离内容
    if (!customBuf) customBuf = { title: '其他', content: [] }
    if (tk.type === 'list') customBuf.content.push(listToMd(tk))
    else if (tk.type === 'paragraph') customBuf.content.push(tk.text)
    else if (tk.type === 'blockquote') customBuf.content.push('> ' + extractBlockquote(tk))
  }

  flushCurrent()
  flushCustom()

  // —— 改名 id 复用：先以唯一且相同的正文识别改名（支持重排），再用稳定分节作边界，
  // 只在区间数量、类型序列一致且同类型不重复时按位置复用（允许同时修改标题和正文）。
  // 数量变化或多个同类型分节均改写时无法可靠区分新增/改名，保留新 id，避免错绑布局。
  const previousIndexes = new Map(prevSections.map((section, index) => [section.id, index]))
  const matches = new Map<number, number>()
  const matchedPrevious = new Set<number>()
  sections.forEach((section, index) => {
    const previousIndex = previousIndexes.get(section.id)
    if (previousIndex === undefined) return
    matches.set(index, previousIndex)
    matchedPrevious.add(previousIndex)
  })
  const reuseSection = (nextIndex: number, previousIndex: number) => {
    const section = sections[nextIndex]
    const previousSection = prevSections[previousIndex]
    section.id = previousSection.id
    const previousItems = buildPrevItemsMap(previousSection)
    if (
      section.type === 'experience' ||
      section.type === 'education' ||
      section.type === 'projects'
    ) {
      for (const item of section.data.items) {
        const previousItem = previousItems.get(item.title)
        if (!previousItem || usedItemIds.has(previousItem.id)) continue
        item.id = previousItem.id
        usedItemIds.add(previousItem.id)
        for (const project of item.projects ?? []) {
          const previous = previousItem.projects?.find((candidate) => candidate.title === project.title && !usedSubprojectIds.has(candidate.id))
          if (!previous) continue
          project.id = previous.id
          usedSubprojectIds.add(previous.id)
        }
      }
    }
    matches.set(nextIndex, previousIndex)
    matchedPrevious.add(previousIndex)
  }
  const unmatchedByContent = (list: Section[], matched: Set<number>) => {
    const byContent = new Map<string, number[]>()
    list.forEach((section, index) => {
      if (matched.has(index) || section.type === 'basics' || (list === sections && explicitSectionIds.has(section.id))) return
      const key = sectionContentKey(section)
      const indexes = byContent.get(key) ?? []
      indexes.push(index)
      byContent.set(key, indexes)
    })
    return byContent
  }
  const previousByContent = unmatchedByContent(prevSections, matchedPrevious)
  const nextByContent = unmatchedByContent(sections, new Set(matches.keys()))
  for (const [key, nextIndexes] of nextByContent) {
    const previousCandidates = previousByContent.get(key)
    if (nextIndexes.length === 1 && previousCandidates?.length === 1) {
      reuseSection(nextIndexes[0], previousCandidates[0])
    }
  }
  const anchors = [
    [-1, -1],
    ...[...matches.entries()].sort(([a], [b]) => a - b),
    [sections.length, prevSections.length],
  ]
  for (let i = 1; i < anchors.length; i++) {
    const [nextStart, previousStart] = anchors[i - 1]
    const [nextEnd, previousEnd] = anchors[i]
    if (previousEnd <= previousStart || nextEnd - nextStart !== previousEnd - previousStart) continue
    const nextGap = sections.slice(nextStart + 1, nextEnd)
    const previousGap = prevSections.slice(previousStart + 1, previousEnd)
    const types = new Set(nextGap.map((section) => section.type))
    if (types.size !== nextGap.length) continue
    if (nextGap.some((section, offset) => (
      section.type === 'basics' ||
      explicitSectionIds.has(section.id) ||
      section.type !== previousGap[offset].type ||
      matchedPrevious.has(previousStart + offset + 1)
    ))) continue
    nextGap.forEach((_, offset) => reuseSection(nextStart + offset + 1, previousStart + offset + 1))
  }

  // 引用稳定化：与 prev 同 id section 内容相等则复用其引用，使未变 section 引用不变，
  // 配合 React.memo 实现局部渲染（改一个 section 不触发其他 section 重渲染）
  if (prevSections.length) {
    const prevById = new Map(prevSections.map((s) => [s.id, s]))
    for (let i = 0; i < sections.length; i++) {
      const p = prevById.get(sections[i].id)
      // JSON.stringify 深比较：parse 往返后字段顺序稳定，比较可靠；失效仅退化为重渲染，不影响正确性
      if (p && JSON.stringify(p) === JSON.stringify(sections[i])) sections[i] = p
    }
  }
  if (onHeading) {
    for (const binding of headingBindings) {
      const metadata = binding.metadata()
      if (metadata) onHeading({ offset: binding.offset, metadata })
    }
  }
  return sections
}

/**
 * 在保持原解析结果不变的前提下，标记用户需要知情的结构变化。
 * 既有 custom 分节继续编辑不重复提示；首次兜底或同位置分节变型才提示。
 */
export function parseMarkdownWithDiagnostics(md: string, prev: Section[], onHeading?: (heading: ParsedHeading) => void): ParseResult {
  const sections = parseMarkdownToSections(md, prev, onHeading)
  const previous = prev.filter((section) => section.type !== 'basics')
  const next = sections.filter((section) => section.type !== 'basics')
  const sameLength = previous.length === next.length
  const diagnostics: ParseDiagnostic[] = []

  next.forEach((section, index) => {
    // 同类型改名沿用 id，不应把既有 custom 分节再次提示为首次兜底。
    if (previous.some((item) => item.id === section.id && item.type === section.type)) return
    const sameTitle = previous.find((item) => item.title === section.title)
    if (sameTitle?.type === section.type) return

    if (sameTitle && sameTitle.type !== section.type) {
      diagnostics.push({
        kind: 'section-type-changed',
        title: section.title,
        fromType: sameTitle.type,
        toType: section.type,
      })
      return
    }

    const positional = sameLength ? previous[index] : undefined
    if (positional && positional.type !== section.type) {
      diagnostics.push({
        kind: 'section-type-changed',
        title: section.title,
        fromType: positional.type,
        toType: section.type,
      })
      return
    }

    if (section.type === 'custom') {
      diagnostics.push({
        kind: 'custom-fallback',
        title: section.title,
        toType: 'custom',
      })
    }
  })

  return { sections, diagnostics }
}
