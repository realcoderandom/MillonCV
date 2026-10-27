// 简历文件 IO：导入 / 导出 Markdown —— 跨设备迁移与备份
// 导出复用 serializeResume，携带结构标记用于完整备份；源码界面隐藏这些内部标识。
// 导入用 parseMarkdownToSections 反向解析，与导出互逆（往返见 __tests__/roundtrip.test.ts）
import type { Resume } from '../model'
import { DEFAULT_THEME } from '../model'
import { uid } from '@/shared/lib/id'
import { serializeResume } from './serialize'
import { parseMarkdownToSections } from './parse'

// 导出 Markdown：序列化整份简历为 .md 文件
export function downloadResumeMd(resume: Resume): void {
  const md = serializeResume(resume)
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${resume.name || 'resume'}.md`
  a.click()
  URL.revokeObjectURL(url)
}

// Markdown 文本 → Resume：默认模板 classic、默认主题；name 取首个 basics 的姓名，缺失用 fallbackName
export function parseResumeMarkdown(text: string, fallbackName = '导入简历'): Resume {
  const sections = parseMarkdownToSections(text)
  const basics = sections.find((s) => s.type === 'basics')
  const name = basics && basics.type === 'basics' ? basics.data.name : ''
  return {
    id: uid(),
    name: name || fallbackName,
    template: 'classic',
    theme: { ...DEFAULT_THEME },
    sections,
    updatedAt: Date.now(),
  }
}
