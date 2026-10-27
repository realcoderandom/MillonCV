import { useId, useState } from 'react'
import { Check, ChevronDown, Plus, Undo2 } from 'lucide-react'
import { DEFAULT_THEME, type Resume } from '@/resume/model'
import { THEME_COLORS, matchingThemeColor } from '@/resume/themeColors'
import { THEME_PRESETS, matchingThemePreset } from '@/resume/themePresets'
import { getTemplate } from '@/templates/registry'
import { accentPalette } from '@/templates/colors'
import { isResumeThemeDefault, resolveResumeTheme } from '@/templates/theme'
import { useResumeStore } from '@/state/useResumeStore'

const COMMON_COLORS = THEME_COLORS.filter((color) => color.group === 'common')
const MORE_COLORS = THEME_COLORS.filter((color) => color.group === 'more')
const STYLE_GROUPS = ([{ id: 'light', label: '柔和风格' }, { id: 'classic', label: '经典风格' }] as const)
  .map((group) => ({ ...group, presets: THEME_PRESETS.filter((preset) => preset.group === group.id) }))

export function ThemeColorSettings({ resume }: { resume: Resume }) {
  const setTheme = useResumeStore((state) => state.setTheme)
  const resetTheme = useResumeStore((state) => state.resetTheme)
  const theme = resolveResumeTheme(resume)
  const template = getTemplate(resume.template)
  const activeColor = matchingThemeColor(theme.primaryColor)
  const activeStyle = matchingThemePreset(theme)
  const moreId = useId()
  const [moreOpen, setMoreOpen] = useState(activeColor?.group === 'more')
  const defaultColor = template.defaultTheme?.primaryColor ?? DEFAULT_THEME.primaryColor
  const colorLabel = (value: string) => matchingThemeColor(value)?.name ?? (value.toLowerCase() === defaultColor.toLowerCase() ? '模板默认' : '自定义')

  const colorButton = (preset: (typeof THEME_COLORS)[number]) => (
    <button
      key={preset.id}
      type="button"
      className="theme-color-button"
      data-theme-color={preset.id}
      data-popover-autofocus={activeColor?.id === preset.id ? '' : undefined}
      aria-label={`主题色：${preset.name}`}
      aria-pressed={theme.primaryColor.toLowerCase() === preset.color}
      title={`${preset.name} · ${preset.description}${'recommended' in preset ? ' · 推荐' : ''}`}
      onClick={() => setTheme(resume.id, { primaryColor: preset.color })}
    >
      <span className="theme-color-dot" style={{ backgroundColor: preset.color }} aria-hidden="true" />
      <span>{preset.name}</span>
      <Check size={12} className="theme-color-check" aria-hidden="true" />
    </button>
  )

  return <div className="style-settings">
    <div className="style-settings-heading">
      <strong>主题色</strong>
      <span role="status" aria-live="polite" title={theme.primaryColor}>{colorLabel(theme.primaryColor)} · 仅调整颜色</span>
    </div>
    <div className="theme-color-grid" role="group" aria-label="常用主题色">
      {COMMON_COLORS.map(colorButton)}
    </div>
    <div className="theme-color-options">
      <button type="button" className="theme-more-button" aria-expanded={moreOpen} aria-controls={moreId} onClick={() => setMoreOpen((open) => !open)}>
        更多配色 <span>2</span><ChevronDown size={12} aria-hidden="true" />
      </button>
      <label className="theme-custom-color">
        <Plus size={12} aria-hidden="true" /><span>自定义</span>
        <input type="color" aria-label="自定义主题色" data-popover-autofocus={!activeColor ? '' : undefined} value={accentPalette(theme.primaryColor).base} onChange={(event) => setTheme(resume.id, { primaryColor: event.target.value })} />
      </label>
      <button type="button" className="style-reset-button" aria-label="恢复模板配色" title="恢复当前模板配色，保留排版" disabled={theme.primaryColor.toLowerCase() === defaultColor.toLowerCase() && !(template.themeScope === 'template' && resume.templateThemeOverrides?.[template.id]?.primaryColor)} onClick={() => setTheme(resume.id, { primaryColor: template.themeScope === 'template' ? undefined : defaultColor })}>
        <Undo2 size={12} aria-hidden="true" />恢复配色
      </button>
    </div>
    {moreOpen && <div id={moreId} className="theme-color-grid" role="group" aria-label="更多主题色">
      {MORE_COLORS.map(colorButton)}
    </div>}
    <details className="theme-full-styles">
      <summary>整套风格<span>{activeStyle?.name ?? (isResumeThemeDefault(resume) ? '模板默认' : '自定义')}</span><ChevronDown size={12} aria-hidden="true" /></summary>
      <p>同时应用配色、字体、字号与间距</p>
      <div className="theme-preset-list" role="group" aria-label="整套风格预设">
        {STYLE_GROUPS.map((group) => <div key={group.id} className="theme-preset-group" role="group" aria-label={group.label}>
          <div className="theme-preset-group-label" aria-hidden="true"><span>{group.label}</span><span>{group.presets.length} 款</span></div>
          {group.presets.map((preset) => <button
            key={preset.id} type="button" className="theme-preset-button"
            aria-label={`应用${preset.name}整套风格`} aria-pressed={activeStyle?.id === preset.id}
            aria-describedby={`theme-preset-${preset.id}-description`} data-theme-preset={preset.id}
            onClick={() => setTheme(resume.id, preset.theme)}
          >
            <span className="theme-color-dot" aria-hidden="true" style={{ backgroundColor: preset.theme.primaryColor }} />
            <span className="theme-preset-copy"><strong>{preset.name}</strong><small id={`theme-preset-${preset.id}-description`}>{preset.description}</small></span>
            <Check className="theme-preset-check" size={15} aria-hidden="true" />
          </button>)}
        </div>)}
      </div>
      <div className="style-reset-row">
        <span>当前模板：{template.label}</span>
        <button type="button" className="style-reset-button" aria-label="恢复默认风格" disabled={isResumeThemeDefault(resume)} onClick={() => resetTheme(resume.id)}>
          <Undo2 size={12} aria-hidden="true" />恢复默认风格
        </button>
      </div>
    </details>
  </div>
}
