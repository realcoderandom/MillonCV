import { describe, expect, it } from 'vitest'
import { FONT_OPTIONS } from '../model'
import { THEME_PRESETS, matchingThemePreset } from '../themePresets'
import { patchResumeTheme, resetResumeTheme, resolveResumeTheme } from '@/templates/theme'
import { createSampleResume } from '../sample'
import { THEME_COLORS } from '../themeColors'
import { TEMPLATES, LEGACY_TEMPLATES } from '@/templates/registry'
import type { TemplateId } from '../model'

describe('文档风格预设', () => {
  it('提供六个常用色与两个更多色，逐个换色不修改排版、正文、布局及其他模板主题', () => {
    expect(THEME_COLORS.filter((color) => color.group === 'common')).toHaveLength(6)
    expect(THEME_COLORS.filter((color) => color.group === 'more')).toHaveLength(2)
    expect(new Set(THEME_COLORS.map((color) => color.color)).size).toBe(8)
    for (const template of [...TEMPLATES, ...LEGACY_TEMPLATES]) {
      const original = createSampleResume()
      original.template = template.id
      original.theme = { ...original.theme, fontSize: 17, lineHeight: 1.8, margin: 32, h1Size: 36, photoWidth: 104 }
      original.templateThemeOverrides = { technicalCompact: { fontSize: 16, margin: 28, photoWidth: 104 }, future: { fontSize: 18 } }
      original.layout = { sidebarWidth: 38, order: original.sections.map((section) => section.id) }
      const typography = { ...resolveResumeTheme(original), primaryColor: undefined }
      for (const color of THEME_COLORS) {
        const next = patchResumeTheme(original, { primaryColor: color.color })
        expect({ ...resolveResumeTheme(next), primaryColor: undefined }).toEqual(typography)
        expect(next.sections).toBe(original.sections)
        expect(next.layout).toBe(original.layout)
        expect(next.templateThemeOverrides?.future).toEqual(original.templateThemeOverrides.future)
        expect(original.theme.fontSize).toBe(17)
      }
    }
  })

  it('每个预设都有唯一 id，且引用有效字体', () => {
    const ids = THEME_PRESETS.map((preset) => preset.id)
    const fontIds = new Set(FONT_OPTIONS.map((font) => font.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const preset of THEME_PRESETS) {
      expect(fontIds.has(preset.theme.fontFamily ?? 'sans')).toBe(true)
      expect(preset.theme.fontSize).toBeGreaterThanOrEqual(11)
      expect(preset.theme.margin).toBeGreaterThanOrEqual(20)
    }
  })

  it('任意两个预设连续切换都完整覆盖排版，并独立保留照片尺寸', () => {
    for (const template of ['classic', 'technicalCompact'] as TemplateId[]) {
      const original = createSampleResume()
      original.template = template
      original.theme.photoWidth = 104
      original.templateThemeOverrides = { technicalCompact: { photoWidth: 104 }, future: { fontSize: 16 } }
      original.layout = { order: original.sections.map((section) => section.id), sidebarWidth: 36 }
      for (const first of THEME_PRESETS) {
        for (const second of THEME_PRESETS) {
          const next = patchResumeTheme(patchResumeTheme(original, first.theme), second.theme)
          expect(resolveResumeTheme(next)).toEqual({ ...second.theme, photoWidth: 104 })
          expect(next.sections).toBe(original.sections)
          expect(next.layout).toBe(original.layout)
          expect(next.templateThemeOverrides?.future).toEqual({ fontSize: 16 })
          if (template === 'technicalCompact') expect(next.theme).toBe(original.theme)
        }
      }
    }
  })

  it('选中状态比较完整风格，微调后显示自定义，照片大小不影响预设匹配', () => {
    for (const preset of THEME_PRESETS) {
      expect(matchingThemePreset({ ...preset.theme, primaryColor: preset.theme.primaryColor.toUpperCase(), photoWidth: 104 })).toBe(preset)
      expect(matchingThemePreset({ ...preset.theme, h1Size: preset.theme.h1Size + 1 })).toBeUndefined()
      expect(matchingThemePreset({ ...preset.theme, primaryColor: '#ff9900' })).toBeUndefined()
    }
  })

  it('应用任意风格后恢复当前模板默认，不删除正文、布局及其他模板设置', () => {
    for (const template of ['classic', 'modern', 'technicalCompact'] as TemplateId[]) {
      const original = { ...createSampleResume(), template, templateThemeOverrides: { future: { fontSize: 16 } } }
      for (const preset of THEME_PRESETS) {
        const restored = resetResumeTheme(patchResumeTheme(original, preset.theme))
        expect(resolveResumeTheme(restored)).toEqual(resolveResumeTheme(resetResumeTheme(original)))
        expect(restored.sections).toBe(original.sections)
        expect(restored.template).toBe(template)
        expect(restored.templateThemeOverrides?.future).toEqual({ fontSize: 16 })
      }
    }
  })
})
