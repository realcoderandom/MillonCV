import { describe, expect, it } from 'vitest'
import { THEME_COLORS } from '@/resume/themeColors'
import { THEME_PRESETS } from '@/resume/themePresets'
import { accentPalette, contrastRatio } from '../colors'

describe('简历配色的实际文字背景组合', () => {
  it('普通文字使用的全部配色在白纸、浅底、色带和深底均保留对比度余量', () => {
    const colors = [...THEME_COLORS.map((preset) => preset.color), ...THEME_PRESETS.map((preset) => preset.theme.primaryColor), '#ffffff', '#000000', '#ffff00', '#00ff00', '#38bdf8', '#1abc9c', '#a78bfa']
    for (const color of colors) {
      const palette = accentPalette(color)
      expect(contrastRatio(palette.text, '#ffffff'), `${color} 白纸文字`).toBeGreaterThanOrEqual(5)
      expect(contrastRatio(palette.text, palette.soft), `${color} 浅底文字`).toBeGreaterThanOrEqual(5)
      expect(contrastRatio(palette.onBand, palette.band), `${color} 色带文字`).toBeGreaterThanOrEqual(5)
      for (const background of ['#1c2027', '#172438']) {
        expect(contrastRatio(palette.onDark, background), `${color} 深底文字`).toBeGreaterThanOrEqual(5)
      }
    }
  })

  it('保留原始色相，已满足对比度的深色不被重写，浅色装饰独立保留', () => {
    expect(accentPalette('#1a365d').text).toBe('#1a365d')
    expect(accentPalette('#5f7d6b').base).toBe('#5f7d6b')
    expect(contrastRatio(accentPalette('#5f7d6b').soft, '#ffffff')).toBeLessThan(1.2)
    expect(accentPalette('#ABC').base).toBe('#aabbcc')
  })
})
