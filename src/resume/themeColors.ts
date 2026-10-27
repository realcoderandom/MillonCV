export const THEME_COLORS = [
  { id: 'navy', name: '深蓝', color: '#1a365d', group: 'common', description: '稳重清晰', recommended: true },
  { id: 'graphite', name: '墨灰', color: '#3f4b55', group: 'common', description: '简洁克制' },
  { id: 'mist', name: '雾蓝', color: '#52789c', group: 'common', description: '柔和清爽' },
  { id: 'sage', name: '灰绿', color: '#5f7d6b', group: 'common', description: '自然温和' },
  { id: 'teal', name: '深青', color: '#155e75', group: 'common', description: '沉静利落' },
  { id: 'sand', name: '暖棕', color: '#91704c', group: 'common', description: '温暖内敛' },
  { id: 'berry', name: '莓红', color: '#943f5b', group: 'more', description: '适度鲜明' },
  { id: 'pine', name: '松绿', color: '#2d5a3d', group: 'more', description: '深沉自然' },
] as const

export function matchingThemeColor(color: string) {
  return THEME_COLORS.find((preset) => preset.color === color.toLowerCase())
}
