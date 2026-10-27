import type { ThemeConfig } from './model'

type PresetTheme = Required<Omit<ThemeConfig, 'photoWidth'>>

export interface ThemePreset {
  id: string
  name: string
  description: string
  group: 'light' | 'classic'
  theme: PresetTheme
}

// 每组完整覆盖配色、字体与排版，避免切换后遗留上一组的标题字号或间距；照片尺寸独立保留。
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'mist-blue',
    name: '雾蓝清爽',
    description: '雾蓝 · 黑体 · 清晰舒展',
    group: 'light',
    theme: { primaryColor: '#52789c', fontSize: 14, margin: 44, lineHeight: 1.65, fontFamily: 'sans', h1Size: 30, h2Size: 16, h3Size: 14, sectionGap: 24 },
  },
  {
    id: 'sage',
    name: '鼠尾草绿',
    description: '灰绿 · 黑体 · 柔和耐读',
    group: 'light',
    theme: { primaryColor: '#5f7d6b', fontSize: 14, margin: 40, lineHeight: 1.6, fontFamily: 'sans', h1Size: 30, h2Size: 16, h3Size: 14, sectionGap: 22 },
  },
  {
    id: 'warm-sand',
    name: '暖棕柔和',
    description: '暖棕 · 宋体 · 温和留白',
    group: 'light',
    theme: { primaryColor: '#91704c', fontSize: 14, margin: 44, lineHeight: 1.65, fontFamily: 'serif', h1Size: 30, h2Size: 16, h3Size: 14, sectionGap: 24 },
  },
  {
    id: 'business',
    name: '商务稳重',
    description: '深蓝 · 黑体 · 均衡易读',
    group: 'classic',
    theme: { primaryColor: '#1a365d', fontSize: 14, margin: 40, lineHeight: 1.6, fontFamily: 'sans', h1Size: 30, h2Size: 16, h3Size: 14, sectionGap: 22 },
  },
  {
    id: 'editorial',
    name: '极简留白',
    description: '石墨灰 · 黑体 · 舒展留白',
    group: 'classic',
    theme: { primaryColor: '#3f4b55', fontSize: 14, margin: 48, lineHeight: 1.7, fontFamily: 'sans', h1Size: 30, h2Size: 16, h3Size: 14, sectionGap: 26 },
  },
  {
    id: 'technical',
    name: '技术现代',
    description: '深青 · 无衬线 · 紧凑清晰',
    group: 'classic',
    theme: { primaryColor: '#155e75', fontSize: 13, margin: 32, lineHeight: 1.5, fontFamily: 'source-sans', h1Size: 28, h2Size: 15, h3Size: 13, sectionGap: 16 },
  },
  {
    id: 'academic',
    name: '学术正式',
    description: '墨灰 · 宋体 · 正式耐读',
    group: 'classic',
    theme: { primaryColor: '#3f4b55', fontSize: 14, margin: 44, lineHeight: 1.65, fontFamily: 'serif', h1Size: 30, h2Size: 16, h3Size: 14, sectionGap: 22 },
  },
  {
    id: 'creative',
    name: '创意醒目',
    description: '莓红 · 普惠体 · 鲜明标题',
    group: 'classic',
    theme: { primaryColor: '#943f5b', fontSize: 14, margin: 36, lineHeight: 1.6, fontFamily: 'puhuiti', h1Size: 32, h2Size: 17, h3Size: 14, sectionGap: 20 },
  },
]

export function matchingThemePreset(theme: ThemeConfig): ThemePreset | undefined {
  return THEME_PRESETS.find((preset) => (Object.keys(preset.theme) as (keyof PresetTheme)[]).every((field) =>
    field === 'primaryColor'
      ? theme.primaryColor.toLowerCase() === preset.theme.primaryColor.toLowerCase()
      : theme[field] === preset.theme[field],
  ))
}
