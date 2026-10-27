import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME } from '@/resume/model'
import { getTemplate, LEGACY_TEMPLATES, TEMPLATES } from '../registry'
import { createSampleResume } from '@/resume/sample'
import { serializeResume } from '@/resume/markdown/serialize'
import { normalizePhotoWidth } from '@/resume/photo'
import {
  normalizeTemplateThemeOverrides,
  isResumeThemeDefault,
  patchResumeTheme,
  resetResumeTheme,
  resolveResumeTheme,
  selectResumeTemplate,
} from '../theme'

describe('兼容旧模板的统一主题协议', () => {
  it('旧主题覆盖键迁入技术精简，新键字段优先且结果不依赖键的顺序', () => {
    const legacy = { fontSize: 12, lineHeight: 1.4 }
    const current = { fontSize: 15, primaryColor: '#123456' }
    for (const overrides of [
      { asu: legacy, technicalCompact: current, future: { margin: 20 } },
      { technicalCompact: current, asu: legacy, future: { margin: 20 } },
    ]) {
      expect(normalizeTemplateThemeOverrides(overrides)).toEqual({
        technicalCompact: { fontSize: 15, lineHeight: 1.4, primaryColor: '#123456' },
        future: { margin: 20 },
      })
    }
  })

  it('直接读取旧标识仍能解析主题，修改和重置后使用当前覆盖键', () => {
    const resume = { ...createSampleResume(), template: 'asu', templateThemeOverrides: { asu: { fontSize: 12, lineHeight: 1.4 } } }
    expect(resolveResumeTheme(resume)).toMatchObject({ fontSize: 12, lineHeight: 1.4 })
    expect(isResumeThemeDefault(resume)).toBe(false)
    expect(patchResumeTheme(resume, { fontSize: 13 }).templateThemeOverrides).toEqual({ technicalCompact: { fontSize: 13, lineHeight: 1.4 } })
    expect(resetResumeTheme(resume).templateThemeOverrides).toBeUndefined()
    expect(selectResumeTemplate(resume, 'asu').template).toBe('technicalCompact')
  })

  it('照片尺寸过滤非法值，并约束导入及设置中的极端数值', () => {
    for (const value of [undefined, null, '112', NaN, Infinity, 0, -1]) {
      expect(normalizePhotoWidth(value)).toBeUndefined()
    }
    expect(normalizePhotoWidth(20)).toBe(56)
    expect(normalizePhotoWidth(999)).toBe(140)
    expect(normalizePhotoWidth(101.6)).toBe(102)
    expect(normalizeTemplateThemeOverrides({ technicalCompact: { photoWidth: 999 } })).toEqual({ technicalCompact: { photoWidth: 140 } })
  })

  it('照片尺寸遵循模板主题作用域，切回旧模板恢复原值且正文不变', () => {
    const resume = createSampleResume()
    resume.theme.photoWidth = 100
    const markdown = serializeResume(resume)
    const technical = patchResumeTheme(selectResumeTemplate(resume, 'technicalCompact'), { photoWidth: 200, fontSize: 13 })
    expect(resolveResumeTheme(technical).photoWidth).toBe(140)
    expect(technical.theme).toBe(resume.theme)
    expect(serializeResume(technical)).toBe(markdown)
    expect(resolveResumeTheme(selectResumeTemplate(technical, 'classic')).photoWidth).toBe(100)
    expect(resolveResumeTheme(JSON.parse(JSON.stringify(technical))).photoWidth).toBe(140)

    const restored = patchResumeTheme(technical, { photoWidth: undefined })
    expect(restored.templateThemeOverrides?.technicalCompact).toEqual({ fontSize: 13 })
    expect(resolveResumeTheme(restored).photoWidth).toBeUndefined()
    const legacy = patchResumeTheme(resume, { photoWidth: 20 })
    expect(legacy.theme.photoWidth).toBe(56)
    expect(patchResumeTheme(legacy, { photoWidth: undefined }).theme).toEqual({ ...DEFAULT_THEME })
  })

  it('所有旧模板直接使用文档已保存的主题，不重新套默认值', () => {
    const resume = createSampleResume()
    resume.theme = { ...DEFAULT_THEME, fontSize: 17, lineHeight: 1.8, h2Size: 23, primaryColor: '#a34b2f' }
    for (const template of [...TEMPLATES, ...LEGACY_TEMPLATES].filter((item) => item.id !== 'technicalCompact')) {
      expect(getTemplate(template.id).themeScope ?? 'document').toBe('document')
      expect(resolveResumeTheme({ ...resume, template: template.id })).toBe(resume.theme)
    }
  })

  it('旧模板互切仍跟随推荐主色，保留用户正文排版和自定义主色', () => {
    const resume = createSampleResume()
    resume.theme = { ...DEFAULT_THEME, fontSize: 17, lineHeight: 1.8, h2Size: 23 }
    const modern = selectResumeTemplate(resume, 'modern')
    expect(modern.theme).toEqual({ ...resume.theme, primaryColor: '#1abc9c' })
    const tech = selectResumeTemplate(modern, 'tech')
    expect(tech.theme).toEqual({ ...resume.theme, primaryColor: '#38bdf8' })
    expect(selectResumeTemplate(tech, 'classic').theme).toEqual(tech.theme)

    const custom = { ...resume, theme: { ...resume.theme, primaryColor: '#ff9900' } }
    for (const template of [...TEMPLATES, ...LEGACY_TEMPLATES].filter((item) => item.id !== 'technicalCompact')) {
      expect(selectResumeTemplate(custom, template.id).theme).toEqual(custom.theme)
    }
  })

  it('进入技术精简后完整预设生效，退出后精确恢复原主题、正文与侧栏配置', () => {
    const resume = createSampleResume()
    resume.template = 'tech'
    resume.theme = { ...DEFAULT_THEME, fontSize: 17, primaryColor: '#ff9900', h1Size: 36 }
    resume.layout = { sidebarWidth: 38, regions: { [resume.sections[0].id]: 'sidebar' } }
    const markdown = serializeResume(resume)
    const technicalCompact = selectResumeTemplate(resume, 'technicalCompact')
    expect(resolveResumeTheme(technicalCompact)).toEqual({ ...DEFAULT_THEME, ...getTemplate('technicalCompact').defaultTheme })
    expect(technicalCompact.theme).toBe(resume.theme)
    expect(technicalCompact.sections).toBe(resume.sections)
    expect(technicalCompact.layout).toBe(resume.layout)
    expect(serializeResume(technicalCompact)).toBe(markdown)
    expect(selectResumeTemplate(technicalCompact, 'tech')).toEqual(resume)
  })

  it('独立覆盖值保留显式设置，即使该值恰好等于模板默认值', () => {
    const resume = createSampleResume()
    const technicalCompact = selectResumeTemplate(resume, 'technicalCompact')
    const changed = patchResumeTheme(technicalCompact, { fontSize: 14, primaryColor: '#2458b8', lineHeight: 1.4 })
    expect(changed.templateThemeOverrides).toEqual({ technicalCompact: { fontSize: 14, primaryColor: '#2458b8', lineHeight: 1.4 } })
    expect(changed.theme).toBe(resume.theme)
    expect(resolveResumeTheme(selectResumeTemplate(selectResumeTemplate(changed, 'classic'), 'technicalCompact')).lineHeight).toBe(1.4)
    expect(resolveResumeTheme(JSON.parse(JSON.stringify(changed)))).toEqual(resolveResumeTheme(changed))
  })

  it('单项恢复默认只删除该项覆盖，整体重置保留其他模板记录', () => {
    const technicalCompact = selectResumeTemplate(createSampleResume(), 'technicalCompact')
    technicalCompact.templateThemeOverrides = { future: { fontSize: 16 } }
    const changed = patchResumeTheme(technicalCompact, { h2Size: 20, primaryColor: '#ff9900' })
    const inherited = patchResumeTheme(changed, { h2Size: undefined })
    expect(inherited.templateThemeOverrides?.technicalCompact).toEqual({ primaryColor: '#ff9900' })
    expect(resolveResumeTheme(inherited).h2Size).toBe(17)
    const reset = resetResumeTheme(inherited)
    expect(reset.templateThemeOverrides).toEqual({ future: { fontSize: 16 } })
    expect(resolveResumeTheme(reset)).toEqual(resolveResumeTheme(technicalCompact))
    expect(reset.theme).toBe(technicalCompact.theme)
  })

  it('恢复旧模板默认主题不会删除独立模板覆盖值', () => {
    const resume = createSampleResume()
    resume.template = 'modern'
    resume.theme = { ...DEFAULT_THEME, fontSize: 18, h1Size: 36 }
    resume.templateThemeOverrides = { technicalCompact: { fontSize: 12 } }
    const reset = resetResumeTheme(resume)
    expect(reset.theme).toEqual({ ...DEFAULT_THEME, primaryColor: '#1abc9c' })
    expect(reset.templateThemeOverrides).toBe(resume.templateThemeOverrides)
  })

  it('默认状态遵循当前模板，覆盖被清除后立即恢复默认状态', () => {
    for (const template of [...TEMPLATES, ...LEGACY_TEMPLATES]) {
      const original = { ...createSampleResume(), template: template.id }
      const defaults = resetResumeTheme(original)
      expect(isResumeThemeDefault(defaults)).toBe(true)
      const changed = patchResumeTheme(defaults, { lineHeight: resolveResumeTheme(defaults).lineHeight + .1 })
      expect(isResumeThemeDefault(changed)).toBe(false)
      expect(isResumeThemeDefault(resetResumeTheme(changed))).toBe(true)
    }
  })

  it('旧文档缺省字体与主色大小写不产生虚假的自定义状态', () => {
    const original = createSampleResume()
    original.theme = { ...DEFAULT_THEME, fontFamily: undefined, primaryColor: DEFAULT_THEME.primaryColor.toUpperCase() }
    expect(isResumeThemeDefault(original)).toBe(true)
  })

  it('与模板默认数值相同的显式覆盖仍可通过恢复默认清除', () => {
    const original = selectResumeTemplate(createSampleResume(), 'technicalCompact')
    const changed = patchResumeTheme(original, { h2Size: resolveResumeTheme(original).h2Size })
    expect(resolveResumeTheme(changed)).toEqual(resolveResumeTheme(original))
    expect(isResumeThemeDefault(changed)).toBe(false)
    expect(isResumeThemeDefault(resetResumeTheme(changed))).toBe(true)
  })

  it('读取旧数据时过滤无效覆盖，不让空值覆盖完整模板预设', () => {
    expect(normalizeTemplateThemeOverrides(null)).toBeUndefined()
    expect(normalizeTemplateThemeOverrides({ technicalCompact: [] })).toBeUndefined()
    const overrides = normalizeTemplateThemeOverrides({
      technicalCompact: { fontSize: -1, margin: 28, lineHeight: null, primaryColor: '', fontFamily: 123, h2Size: Infinity },
      empty: {},
    })
    expect(overrides).toEqual({ technicalCompact: { margin: 28 } })
    const resume = { ...createSampleResume(), template: 'technicalCompact', templateThemeOverrides: overrides }
    expect(resolveResumeTheme(resume)).toMatchObject({ fontSize: 14, lineHeight: 1.52, primaryColor: '#2458b8', margin: 28 })
  })
})
