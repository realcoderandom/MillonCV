import { describe, expect, expectTypeOf, it } from 'vitest'
import { getTemplate, LEGACY_TEMPLATES, normalizeTemplateId, TEMPLATE_LABELS, TEMPLATES, type TemplateId } from '../registry'

describe('精简模板目录与历史兼容', () => {
  it('选择器仅提供七款模板，并保留四款必选版式', () => {
    expect(TEMPLATES.map((template) => template.label)).toEqual([
      '经典', '技术精简', '学术', '重点色', '简约', '商务', '现代',
    ])
    expect(TEMPLATES.map((template) => template.id)).toContain('technicalCompact')
    expect(TEMPLATE_LABELS.technicalCompact).toBe('技术精简')
  })

  it('旧模板标识仅作为读取别名，不进入模板清单与标签映射', () => {
    expect(getTemplate('asu')).toBe(getTemplate('technicalCompact'))
    expect(TEMPLATES.map((template) => template.id)).not.toContain('asu')
    expect(TEMPLATE_LABELS).not.toHaveProperty('asu')
  })

  it('退出选择器的五款模板仍能找到原渲染器和标签', () => {
    expect(LEGACY_TEMPLATES.map((template) => template.id)).toEqual(['creative', 'tech', 'flat', 'twoColumn', 'dark'])
    const activeIds = new Set<string>(TEMPLATES.map((template) => template.id))
    for (const template of LEGACY_TEMPLATES) {
      expect(activeIds.has(template.id)).toBe(false)
      expect(getTemplate(template.id)).toBe(template)
      expect(TEMPLATE_LABELS[template.id]).toBe(template.label)
    }
    expect(getTemplate('unknown-template')).toBe(TEMPLATES[0])
  })

  it('模板 id 保持具体类型，注册表无重复且未知输入归一化到经典', () => {
    expectTypeOf<TemplateId>().not.toEqualTypeOf<string>()
    expectTypeOf<'classic'>().toExtend<TemplateId>()
    const ids = [...TEMPLATES, ...LEGACY_TEMPLATES].map((template) => template.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(normalizeTemplateId('unknown-template')).toBe('classic')
    expect(normalizeTemplateId('asu')).toBe('technicalCompact')
  })
})
