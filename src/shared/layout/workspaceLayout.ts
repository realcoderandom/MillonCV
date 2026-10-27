// 模块目录宽度是工作区偏好，不属于简历纸张的分栏配置。
export const DEFAULT_MODULE_NAVIGATION_WIDTH = 176
export const MIN_MODULE_NAVIGATION_WIDTH = 160
export const MAX_MODULE_NAVIGATION_WIDTH = 320
export const MIN_MODULE_FORM_WIDTH = 280
export const MODULE_NAVIGATION_ICON_WIDTH = 56
export const MODULE_NAVIGATION_ICON_ONLY_WIDTH = 96
export const MIN_EXPANDED_MODULE_EDITOR_WIDTH = MODULE_NAVIGATION_ICON_ONLY_WIDTH + MIN_MODULE_FORM_WIDTH

export type ModuleNavigationMode = 'expanded' | 'rail' | 'overlay' | 'drawer' | 'hidden'

export function resolveModuleNavigationMode(editorWidth: number, isMobile: boolean, collapsed: boolean, open: boolean): ModuleNavigationMode {
  if (isMobile) return open ? 'drawer' : 'hidden'
  if (editorWidth <= MIN_EXPANDED_MODULE_EDITOR_WIDTH) return open ? 'overlay' : 'rail'
  return collapsed ? 'rail' : 'expanded'
}

// 自动宽度可小于手动偏好的下限，连续缩到图标栏，避免断点处突然跳宽。
export function responsiveModuleNavigationWidth(preferredWidth: number, editorWidth: number, collapsed = false): number {
  if (collapsed) return MODULE_NAVIGATION_ICON_WIDTH
  return Math.min(clampModuleNavigationWidth(preferredWidth), Math.max(MODULE_NAVIGATION_ICON_WIDTH, editorWidth - MIN_MODULE_FORM_WIDTH))
}

export function maximumModuleNavigationWidth(editorWidth: number): number {
  return Math.max(MIN_MODULE_NAVIGATION_WIDTH, Math.min(MAX_MODULE_NAVIGATION_WIDTH, editorWidth - MIN_MODULE_FORM_WIDTH))
}

export function clampModuleNavigationWidth(width: number): number {
  return Number.isFinite(width)
    ? Math.min(MAX_MODULE_NAVIGATION_WIDTH, Math.max(MIN_MODULE_NAVIGATION_WIDTH, Math.round(width)))
    : DEFAULT_MODULE_NAVIGATION_WIDTH
}
