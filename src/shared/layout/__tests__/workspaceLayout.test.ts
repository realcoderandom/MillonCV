import { describe, expect, it } from 'vitest'
import { maximumModuleNavigationWidth, responsiveModuleNavigationWidth, resolveModuleNavigationMode } from '../workspaceLayout'

describe('模块目录的响应式布局', () => {
  it('桌面中等宽度保留完整目录，不再在 660px 时隐藏', () => {
    for (const width of [800, 660, 560, 480, 440, 400, 377]) expect(resolveModuleNavigationMode(width, false, false, false)).toBe('expanded')
  })

  it('很窄的桌面编辑区保留图标栏，展开时覆盖表单而不挤压它', () => {
    expect(resolveModuleNavigationMode(376, false, false, false)).toBe('rail')
    expect(resolveModuleNavigationMode(300, false, false, false)).toBe('rail')
    expect(resolveModuleNavigationMode(300, false, false, true)).toBe('overlay')
    expect(resolveModuleNavigationMode(800, false, true, false)).toBe('rail')
  })

  it('手机使用抽屉，桌面缩窄不会误判为手机', () => {
    expect(resolveModuleNavigationMode(600, true, false, false)).toBe('hidden')
    expect(resolveModuleNavigationMode(600, true, false, true)).toBe('drawer')
    expect(resolveModuleNavigationMode(600, false, false, false)).toBe('expanded')
  })

  it('展开时为表单保留 280px，宽屏恢复原有的目录宽度上限', () => {
    expect(maximumModuleNavigationWidth(440)).toBe(160)
    expect(maximumModuleNavigationWidth(500)).toBe(220)
    expect(maximumModuleNavigationWidth(600)).toBe(320)
    expect(maximumModuleNavigationWidth(900)).toBe(320)
  })

  it('宽度从用户偏好连续压缩到 56px，不在图标切换断点处跳变', () => {
    const editorWidths = [600, 500, 440, 420, 400, 380, 376, 360, 340, 336, 300]
    expect(editorWidths.map((width) => responsiveModuleNavigationWidth(240, width))).toEqual([240, 220, 160, 140, 120, 100, 96, 80, 60, 56, 56])
    for (let width = 330; width < 610; width += 1) {
      expect(Math.abs(responsiveModuleNavigationWidth(240, width + 1) - responsiveModuleNavigationWidth(240, width))).toBeLessThanOrEqual(1)
    }
  })

  it('变宽后恢复偏好，用户手动收起时保持图标栏', () => {
    expect(responsiveModuleNavigationWidth(240, 400)).toBe(120)
    expect(responsiveModuleNavigationWidth(240, 800)).toBe(240)
    expect(responsiveModuleNavigationWidth(240, 800, true)).toBe(56)
  })
})
