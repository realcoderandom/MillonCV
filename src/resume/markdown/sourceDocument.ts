import { marked } from 'marked'
import type { Section } from '../model'
import { uid } from '@/shared/lib/id'
import { metadataMatchesLevel, parseHeadingMetadata, serializeHeadingMetadata, type HeadingMetadata } from './metadata'
import { parseMarkdownWithDiagnostics, type ParsedHeading } from './parse'
import { serializeSections } from './serialize'

export interface SourceDocument {
  text: string
  bindings: ParsedHeading[]
}

export interface SourceSelection {
  start: number
  end: number
}

interface SourceHeading {
  offset: number
  rawOffset: number
  end: number
  depth: number
}

// 只处理顶层标题前的有效协议注释，代码块、普通注释和正文保持原样。
function readSource(markdown: string) {
  const normalized = markdown.replace(/\r\n?/g, '\n')
  const tokens = marked.lexer(normalized)
  const hidden = new Set<number>()
  const attached = new Map<number, HeadingMetadata>()
  tokens.forEach((token, index) => {
    if (token.type !== 'html') return
    const metadata = parseHeadingMetadata(token.raw)
    if (!metadata) return
    let next = index + 1
    while (tokens[next]?.type === 'space') next += 1
    const heading = tokens[next]
    if (heading?.type !== 'heading' || !metadataMatchesLevel(metadata, heading.depth)) return
    hidden.add(index)
    attached.set(next, metadata)
  })

  let text = ''
  let rawOffset = 0
  const headings: SourceHeading[] = []
  const bindings: ParsedHeading[] = []
  tokens.forEach((token, index) => {
    if (!hidden.has(index)) {
      if (token.type === 'heading') {
        headings.push({ offset: text.length, rawOffset, end: text.length + token.raw.replace(/\n+$/, '').length, depth: token.depth })
        const metadata = attached.get(index)
        if (metadata) bindings.push({ offset: text.length, metadata })
      }
      text += token.raw
    }
    rawOffset += token.raw.length
  })
  return { text, headings, bindings }
}

// 草稿不可变；复用历史文档的词法结果，复制/撤销匹配时不重复解析整份历史。
const scans = new WeakMap<SourceDocument, ReturnType<typeof readSource>>()
function scanDocument(document: SourceDocument) {
  let scan = scans.get(document)
  if (!scan) {
    scan = readSource(document.text)
    scans.set(document, scan)
  }
  return scan
}

export function createSourceDocument(sections: Section[]): SourceDocument {
  const { text, bindings } = readSource(serializeSections(sections))
  return { text, bindings }
}

function changedRange(before: string, after: string, selection?: SourceSelection) {
  // 原生 beforeinput 的选区能区分「在标题前粘贴」与「改写标题」，避免相同前缀抢走原条目的 id。
  if (selection) {
    const inserted = after.length - before.length + selection.end - selection.start
    if (inserted >= 0 && before.slice(0, selection.start) === after.slice(0, selection.start)
      && before.slice(selection.end) === after.slice(selection.start + inserted)) {
      return { ...selection, inserted }
    }
  }
  let start = 0
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1
  let end = before.length
  let nextEnd = after.length
  while (end > start && nextEnd > start && before[end - 1] === after[nextEnd - 1]) {
    end -= 1
    nextEnd -= 1
  }
  return { start, end, inserted: nextEnd - start }
}

function headingBlock(text: string, headings: SourceHeading[], heading: SourceHeading) {
  const next = headings.find((candidate) => candidate.offset > heading.offset && candidate.depth <= heading.depth)
  return text.slice(heading.offset, next?.offset).trimEnd()
}

export function updateSourceDocument(
  previous: SourceDocument,
  value: string,
  history: readonly SourceDocument[] = [],
  selection?: SourceSelection,
): SourceDocument {
  const normalized = value.replace(/\r\n?/g, '\n')
  const restored = [...history, previous].reverse().find((document) => document.text === normalized)
  if (restored) return restored
  const next = readSource(normalized)
  const before = scanDocument(previous)
  const change = changedRange(previous.text, normalized, selection)
  const delta = normalized.length - previous.text.length
  const bindings = new Map(next.bindings.map((binding) => [binding.offset, binding.metadata]))

  for (const binding of previous.bindings) {
    const heading = before.headings.find((candidate) => candidate.offset === binding.offset)
    if (!heading) continue
    let position: number
    if (heading.end <= change.start) position = heading.offset
    else if (heading.offset >= change.end) position = heading.offset + delta
    else if (change.start >= heading.offset && change.end <= heading.end) position = heading.offset
    else continue
    const target = next.headings.find((candidate) => candidate.rawOffset <= position
      && position <= candidate.rawOffset + candidate.end - candidate.offset)
    if (target && !bindings.has(target.offset) && metadataMatchesLevel(binding.metadata, target.depth)) {
      bindings.set(target.offset, binding.metadata)
    }
  }

  if (next.headings.every((heading) => bindings.has(heading.offset))) {
    return { text: next.text, bindings: [...bindings].map(([offset, metadata]) => ({ offset, metadata })) }
  }

  // 整段移动、复制和原生撤销：以完整标题块找回隐藏标识，已有原件的副本获得新 id。
  const candidates = new Map<string, Map<string, HeadingMetadata>>()
  for (const document of [previous, ...history]) {
    const scan = scanDocument(document)
    for (const binding of document.bindings) {
      const heading = scan.headings.find((candidate) => candidate.offset === binding.offset)
      if (!heading) continue
      const key = headingBlock(document.text, scan.headings, heading)
      const matches = candidates.get(key) ?? new Map<string, HeadingMetadata>()
      matches.set(binding.metadata.id, binding.metadata)
      candidates.set(key, matches)
    }
  }
  const used = new Set([...bindings.values()].map((metadata) => metadata.id))
  for (const heading of next.headings) {
    if (bindings.has(heading.offset)) continue
    const matches = [...(candidates.get(headingBlock(next.text, next.headings, heading))?.values() ?? [])]
      .filter((metadata) => metadataMatchesLevel(metadata, heading.depth))
    const available = matches.filter((metadata) => !used.has(metadata.id))
    const match = available.length === 1 ? available[0] : matches.length === 1 ? matches[0] : undefined
    if (!match) continue
    const metadata = used.has(match.id) ? { ...match, id: uid() } : match
    bindings.set(heading.offset, metadata)
    used.add(metadata.id)
  }
  return { text: next.text, bindings: [...bindings].map(([offset, metadata]) => ({ offset, metadata })) }
}

export function parseSourceDocument(document: SourceDocument, previous: Section[]) {
  const scan = scanDocument(document)
  const bindings = new Map(document.bindings.map((binding) => [binding.offset, binding.metadata]))
  const offsets = new Map<number, number>()
  let markdown = ''
  let cursor = 0
  for (const heading of scan.headings) {
    markdown += document.text.slice(cursor, heading.offset)
    const metadata = bindings.get(heading.offset)
    if (metadata && metadataMatchesLevel(metadata, heading.depth)) markdown += `${serializeHeadingMetadata(metadata)}\n\n`
    offsets.set(markdown.length, heading.offset)
    cursor = heading.offset
  }
  markdown += document.text.slice(cursor)
  const resolved: ParsedHeading[] = []
  const result = parseMarkdownWithDiagnostics(markdown, previous, ({ offset, metadata }) => {
    const sourceOffset = offsets.get(offset)
    const heading = scan.headings.find((candidate) => candidate.offset === sourceOffset)
    if (heading && metadataMatchesLevel(metadata, heading.depth)) resolved.push({ offset: heading.offset, metadata })
  })
  return { ...result, document: { text: document.text, bindings: resolved } }
}
