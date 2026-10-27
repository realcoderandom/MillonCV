// 模板主题的唯一入口：预览、缩略图、设置与存储使用相同的解析和切换规则。
import { DEFAULT_THEME, type Resume, type ResumeInput, type TemplateId, type ThemeConfig } from '@/resume/model'
import { getTemplate, normalizeTemplateId, resolveTemplateAlias } from './registry'
import { normalizePhotoWidth } from '@/resume/photo'

const NUMBER_FIELDS = ['fontSize', 'margin', 'lineHeight', 'h1Size', 'h2Size', 'h3Size', 'sectionGap', 'photoWidth'] as const
const STRING_FIELDS = ['primaryColor', 'fontFamily'] as const

function normalizePatch(value: unknown): Partial<ThemeConfig> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  const patch: Partial<ThemeConfig> = {}
  for (const key of NUMBER_FIELDS) {
    if (key === 'photoWidth') {
      const width = normalizePhotoWidth(record[key])
      if (width !== undefined) patch.photoWidth = width
      continue
    }
    const number = record[key]
    if (typeof number !== 'number' || !Number.isFinite(number)) continue
    if (number > 0 || (key === 'margin' && number === 0)) patch[key] = number
  }
  for (const key of STRING_FIELDS) {
    const text = record[key]
    if (typeof text === 'string' && text.trim()) patch[key] = text
  }
  return patch
}

export function normalizeTemplateThemeOverrides(value: unknown): Resume['templateThemeOverrides'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const normalized = new Map<string, Partial<ThemeConfig>>()
  for (const [id, patch] of Object.entries(value)) {
    const key = resolveTemplateAlias(id)
    const previous = normalized.get(key) ?? {}
    const fields = normalizePatch(patch)
    // 新键同名字段优先，旧键补齐缺项；不依赖 JSON 中键的顺序。
    normalized.set(key, id === key ? { ...previous, ...fields } : { ...fields, ...previous })
  }
  const entries = [...normalized]
    .filter(([, patch]) => Object.keys(patch).length > 0)
  return entries.length ? Object.fromEntries(entries) : undefined
}

export function resolveResumeTheme(resume: Pick<ResumeInput, 'template' | 'theme' | 'templateThemeOverrides'>, template = getTemplate(resume.template)): ThemeConfig {
  if (template.themeScope !== 'template') return resume.theme
  return {
    ...DEFAULT_THEME,
    ...template.defaultTheme,
    ...normalizeTemplateThemeOverrides(resume.templateThemeOverrides)?.[template.id],
  }
}

// 跨作用域不写共享主题，保证旧模板 → 独立主题模板 → 旧模板后排版原样恢复。
// 两个旧模板之间继续沿用既有的推荐主色逻辑。
export function selectResumeTemplate(resume: ResumeInput, id: TemplateId | 'asu'): Resume {
  const templateId = normalizeTemplateId(id)
  const previous = getTemplate(resume.template)
  const next = getTemplate(templateId)
  if (previous.themeScope === 'template' || next.themeScope === 'template') {
    return { ...resume, template: templateId }
  }
  const preset = new Set([DEFAULT_THEME.primaryColor, previous.defaultTheme?.primaryColor].filter(Boolean))
  const primaryColor = preset.has(resume.theme.primaryColor)
    ? next.defaultTheme?.primaryColor ?? resume.theme.primaryColor
    : resume.theme.primaryColor
  return { ...resume, template: templateId, theme: { ...resume.theme, primaryColor } }
}

export function patchResumeTheme(resume: ResumeInput, patch: Partial<ThemeConfig>): Resume {
  const template = getTemplate(resume.template)
  if (template.themeScope !== 'template') {
    const theme = { ...resume.theme, ...patch }
    if ('photoWidth' in patch) {
      const width = normalizePhotoWidth(patch.photoWidth)
      if (width === undefined) delete theme.photoWidth
      else theme.photoWidth = width
    }
    return { ...resume, template: template.id, theme }
  }
  // undefined 表示删除该项用户覆盖，恢复当前模板的默认参数。
  const currentOverrides = normalizeTemplateThemeOverrides(resume.templateThemeOverrides)
  const overrides = normalizeTemplateThemeOverrides({
    ...currentOverrides,
    [template.id]: { ...currentOverrides?.[template.id], ...patch },
  })
  return withOverrides(resume, overrides)
}

export function resetResumeTheme(resume: ResumeInput): Resume {
  const template = getTemplate(resume.template)
  if (template.themeScope !== 'template') {
    return {
      ...resume,
      template: template.id,
      theme: { ...DEFAULT_THEME, primaryColor: template.defaultTheme?.primaryColor ?? DEFAULT_THEME.primaryColor },
    }
  }
  const overrides = { ...normalizeTemplateThemeOverrides(resume.templateThemeOverrides) }
  delete overrides[template.id]
  return withOverrides(resume, normalizeTemplateThemeOverrides(overrides))
}

export function isResumeThemeDefault(resume: ResumeInput): boolean {
  const template = getTemplate(resume.template)
  // 显式覆盖即使等于当前默认值，也应允许重置，重新继承今后的模板默认参数。
  if (template.themeScope === 'template' && normalizeTemplateThemeOverrides(resume.templateThemeOverrides)?.[template.id]) return false
  const current = resolveResumeTheme(resume)
  const defaults = resolveResumeTheme(resetResumeTheme(resume))
  return NUMBER_FIELDS.every((field) => current[field] === defaults[field])
    && current.primaryColor.toLowerCase() === defaults.primaryColor.toLowerCase()
    && (current.fontFamily ?? DEFAULT_THEME.fontFamily) === defaults.fontFamily
}

function withOverrides(resume: ResumeInput, overrides: Resume['templateThemeOverrides']): Resume {
  const { templateThemeOverrides: _previous, ...rest } = resume
  const normalized = { ...rest, template: normalizeTemplateId(resume.template) }
  return overrides ? { ...normalized, templateThemeOverrides: overrides } : normalized
}
