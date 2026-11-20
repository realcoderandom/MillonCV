import type { Contact } from '@/resume/model'

/** 规范化链接地址：无协议头且非站内锚点/路径时自动补全 https://。 */
export function normalizeLinkHref(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^(?:https?:|mailto:|tel:|\/|#)/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/** 快捷将时间范围的结束端设为“至今”。 */
export function applyPresentDate(current: string | undefined): string {
  const trimmed = (current ?? '').trim()
  if (!trimmed) return '至今'
  if (/至今$/.test(trimmed)) return trimmed
  const range = trimmed.match(/^(.+?)\s*(?:—|–|-|~|至)\s*[^—–~-]*$/)
  if (range) return `${range[1].trim()} — 至今`
  return `${trimmed} — 至今`
}

/** 联系方式温和校验：仅在非空且明显异常时给出非阻塞提示。 */
export function validateContactField(key: keyof Contact, raw: string): string | undefined {
  const value = raw.trim()
  if (!value) return undefined
  if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return '邮箱格式似乎不完整，请检查是否缺少 @ 或域名'
  }
  if (key === 'website' && (/\s/.test(value) || !value.includes('.'))) {
    return '网址格式似乎不完整，例如 example.com'
  }
  if (key === 'github' && /\s/.test(value)) {
    return 'GitHub 地址通常不包含空格，例如 github.com/username'
  }
  return undefined
}
