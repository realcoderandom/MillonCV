import type { ThemeConfig } from '@/resume/model'

// 智能一页只处理“略超一页”的内容，避免为了强行塞入一页而牺牲可读性。
export const ONE_PAGE_TARGET_RATIO = (297 - 7) / 297
export const ONE_PAGE_MAX_RATIO = 1.3
export const ONE_PAGE_MIN_SCALE = 0.85

export type OnePageResult = 'off' | 'fits' | 'compressed' | 'overflow'

export interface PreviewLayoutStatus {
  resumeId: string
  pageCount: number
  rawPageCount: number
  result: OnePageResult
  compressionPercent: number
  original: Pick<ThemeConfig, 'fontSize' | 'lineHeight' | 'margin'>
  rendered: Pick<ThemeConfig, 'fontSize' | 'lineHeight' | 'margin'>
  pending?: boolean
  error?: string
}

export interface OnePageDecision {
  compression: number
  result: OnePageResult
}

export function decideOnePageCompression(
  rawRatio: number,
  enabled: boolean,
  previousCompression = 1,
): OnePageDecision {
  if (!enabled) return { compression: 1, result: 'off' }

  if (rawRatio > 1 && rawRatio <= ONE_PAGE_MAX_RATIO) {
    return {
      compression: Math.max(ONE_PAGE_MIN_SCALE, ONE_PAGE_TARGET_RATIO / rawRatio),
      result: 'compressed',
    }
  }

  // 保留原有滞回策略，避免内容刚好位于一页边界时字号反复跳变。
  if (
    previousCompression < 1
    && rawRatio > ONE_PAGE_TARGET_RATIO
    && rawRatio <= 1
  ) {
    return { compression: previousCompression, result: 'compressed' }
  }

  if (rawRatio > ONE_PAGE_MAX_RATIO) return { compression: 1, result: 'overflow' }
  return { compression: 1, result: 'fits' }
}

export function pageCountFromRatio(ratio: number) {
  // 浮点和子像素布局会在整数页边界产生极小误差，留 0.1% 容差避免误报多一页。
  return Math.max(1, Math.ceil(ratio - 0.001))
}

export function compressedTheme(theme: ThemeConfig, compression: number): ThemeConfig {
  if (compression >= 1) return theme
  return {
    ...theme,
    fontSize: Math.max(8, Math.round(theme.fontSize * compression)),
    lineHeight: +Math.min(
      theme.lineHeight,
      Math.max(1.35, 1 + (theme.lineHeight - 1) * compression),
    ).toFixed(2),
    margin: Math.max(12, Math.round(theme.margin * compression)),
    h1Size: theme.h1Size ? Math.max(10, Math.round(theme.h1Size * compression)) : undefined,
    h2Size: theme.h2Size ? Math.max(10, Math.round(theme.h2Size * compression)) : undefined,
    h3Size: theme.h3Size ? Math.max(10, Math.round(theme.h3Size * compression)) : undefined,
  }
}
