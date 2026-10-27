// 共用控件类名入口；外观集中于 ui-controls.css，配色来自 ui-theme.css。

// 通用按钮基础（util-btn / pt-btn / mode-btn / tmpl-btn 共通外观）
export const btnBase = 'ui-button'

// primary 变体：实色填充
export const btnPrimary = 'ui-button-primary'

// active 态（选中）：中性色填充
export const btnActive = 'ui-button-active'

// 小号按钮（预览工具条用）
export const btnSm = 'ui-button-sm'

// 通用输入框
export const inputCls = 'ui-input w-full'

// textarea（等宽、可纵向拉伸）
export const textareaCls = inputCls + ' ui-textarea'

// 裸 select：appearance-none + chevron 箭头 + 透明背景
export const selectBareCls = 'ui-select chevron-arrow'

// 图标按钮（透明、hover 高亮）
export const iconBtnCls = 'ui-icon-button'

// 带边框的 select 容器（模板选择 / 简历切换器共用）
export const selectWrapCls = 'ui-select-wrap'

// 字段标签：小号次级文字
export const fieldLabelCls = 'ui-field-label'

// Popover 面板：悬浮卡片，配色走 CSS 变量，深浅主题自洽
export const popoverPanelCls = 'precision-popover'
