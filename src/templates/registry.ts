// 模板注册表 —— 唯一清单（single source of truth）
// 每个模板是独立插件：自带 Body 渲染组件 + co-located 样式，在此 import 汇总
// 新增模板：新建 templates/{id}/{index.tsx,{id}.css} + 此处加一行 import，无需改主流程
// 可选模板与历史兼容模板分开登记；TemplateId / TEMPLATE_LABELS 仍覆盖全部已保存的 id

import type { TemplatePlugin } from './types'
export type { TemplateBodyProps, TemplatePlugin } from './types'

import { classic } from './classic'
import { modern } from './modern'
import { minimal } from './minimal'
import { professional } from './professional'
import { creative } from './creative'
import { academic } from './academic'
import { tech } from './tech'
import { focus } from './focus'
import { flat } from './flat'
import { twoColumn } from './twoColumn'
import { dark } from './dark'
import { technicalCompact } from './technicalCompact'

export const TEMPLATES = [
  classic,
  technicalCompact,
  academic,
  focus,
  minimal,
  professional,
  modern,
] as const satisfies readonly TemplatePlugin[]

// 不再进入选择器，仍保留原渲染器、主题和标签，避免旧简历静默变版。
export const LEGACY_TEMPLATES = [
  creative,
  tech,
  flat,
  twoColumn,
  dark,
] as const satisfies readonly TemplatePlugin[]

const REGISTERED_TEMPLATES = [...TEMPLATES, ...LEGACY_TEMPLATES] as const

// 派生类型：从注册表推断，resume/model.ts 仅通过 import type 取用。
export type TemplateId = (typeof REGISTERED_TEMPLATES)[number]['id']

// 派生标签映射：Toolbar 下拉等直接消费
export const TEMPLATE_LABELS: Record<TemplateId, string> = Object.fromEntries(
  REGISTERED_TEMPLATES.map((t) => [t.id, t.label]),
) as Record<TemplateId, string>

// 主题覆盖中的未知键继续保留，只转换已知的历史别名。
export function resolveTemplateAlias(id: string): string {
  return id === 'asu' ? technicalCompact.id : id
}

// 外部标识在读取边界归一化；未知模板完整回退到经典的组件与 CSS 类。
export function normalizeTemplateId(id: string): TemplateId {
  return getTemplate(id).id
}

// 查表：供 ResumePreview 取 Body 组件用；未知 id 回退首项
export function getTemplate(id: string): TemplatePlugin<TemplateId> {
  const normalized = resolveTemplateAlias(id)
  return REGISTERED_TEMPLATES.find((t) => t.id === normalized) ?? TEMPLATES[0]
}
