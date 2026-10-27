import type { SectionType } from '../model'

export type HeadingMetadata =
  | { kind: 'section'; id: string; type: SectionType; title?: string }
  | { kind: 'item' | 'subproject'; id: string }

const SECTION_TYPES = new Set(['basics', 'experience', 'education', 'projects', 'skills', 'custom'])

// 模块标题和姓名是纯文本，不能在富文本往返时被解释为 Markdown / HTML。
export function escapeHeadingText(value: string): string {
  return value.replace(/[\\`*_[\]<>#&~]/g, '\\$&')
}

// 注释只保存结构标识；正文仍由正常 Markdown 承载，普通 Markdown 阅读器不会显示它。
export function serializeHeadingMetadata(metadata: HeadingMetadata): string {
  const json = JSON.stringify(metadata).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
  return `<!-- resume:${json} -->`
}

export function parseHeadingMetadata(value: string): HeadingMetadata | null {
  const match = value.trim().match(/^(?:<!--\s*)?resume:(\{[^\n]*\})(?:\s*-->)?$/)
  if (!match) return null
  try {
    const metadata: unknown = JSON.parse(match[1])
    if (!metadata || typeof metadata !== 'object') return null
    const record = metadata as Record<string, unknown>
    if (typeof record.id !== 'string' || !record.id || record.id.length > 200) return null
    if (record.kind === 'item' || record.kind === 'subproject') return { kind: record.kind, id: record.id }
    if (record.kind !== 'section' || typeof record.type !== 'string' || !SECTION_TYPES.has(record.type)) return null
    return {
      kind: 'section', id: record.id, type: record.type as SectionType,
      ...(typeof record.title === 'string' ? { title: record.title } : {}),
    }
  } catch {
    return null
  }
}

export function metadataMatchesLevel(metadata: HeadingMetadata, level: number): boolean {
  return metadata.kind === 'section'
    ? level === (metadata.type === 'basics' ? 1 : 2)
    : level === (metadata.kind === 'item' ? 3 : 4)
}
