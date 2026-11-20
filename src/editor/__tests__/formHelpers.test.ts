import { describe, expect, it } from 'vitest'
import { applyPresentDate, normalizeLinkHref, validateContactField } from '../fields/formHelpers'

describe('表单辅助工具', () => {
  it('链接规范化自动补全协议并保留特殊协议与相对路径', () => {
    expect(normalizeLinkHref('')).toBe('')
    expect(normalizeLinkHref('   ')).toBe('')
    expect(normalizeLinkHref('github.com/milloncv')).toBe('https://github.com/milloncv')
    expect(normalizeLinkHref('http://example.com')).toBe('http://example.com')
    expect(normalizeLinkHref('https://example.com/a')).toBe('https://example.com/a')
    expect(normalizeLinkHref('mailto:hi@example.com')).toBe('mailto:hi@example.com')
    expect(normalizeLinkHref('tel:13800000000')).toBe('tel:13800000000')
    expect(normalizeLinkHref('#top')).toBe('#top')
  })

  it('快捷填入“至今”适配空值、起始日期与已有起止区间', () => {
    expect(applyPresentDate(undefined)).toBe('至今')
    expect(applyPresentDate('')).toBe('至今')
    expect(applyPresentDate('2023.06')).toBe('2023.06 — 至今')
    expect(applyPresentDate('2023.06 - 2024.08')).toBe('2023.06 — 至今')
    expect(applyPresentDate('2023.06 — 2024.08')).toBe('2023.06 — 至今')
    expect(applyPresentDate('2023.06 — 至今')).toBe('2023.06 — 至今')
  })

  it('联系方式温和校验仅对明显异常的非空输入给出提示', () => {
    expect(validateContactField('email', '')).toBeUndefined()
    expect(validateContactField('email', 'alice@example.com')).toBeUndefined()
    expect(validateContactField('email', 'alice-at-example')).toBeTruthy()
    expect(validateContactField('website', 'example.com')).toBeUndefined()
    expect(validateContactField('website', 'not a url')).toBeTruthy()
    expect(validateContactField('github', 'github.com/alice')).toBeUndefined()
    expect(validateContactField('github', 'github.com/alice bob')).toBeTruthy()
  })
})
