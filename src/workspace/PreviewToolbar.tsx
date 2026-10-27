// 模板、排版与页数合并为一行；具体参数收入 Popover，保留完整设置。
import { ArrowLeft, Check, Palette, SlidersHorizontal, Undo2 } from 'lucide-react'
import { getTemplate } from '@/templates/registry'
import type { PreviewLayoutStatus } from '@/preview/layout'
import { useResumeStore } from '@/state/useResumeStore'
import { FONT_OPTIONS, type Resume } from '@/resume/model'
import { isResumeThemeDefault, resolveResumeTheme } from '@/templates/theme'
import { Button } from '@/shared/ui/Button'
import { Popover } from '@/shared/ui/Popover'
import { Select } from '@/shared/ui/Select'
import { TemplatePicker } from './TemplatePicker'
import { ResumePhotoControl } from '@/editor/photo/ResumePhotoControl'
import { ThemeColorSettings } from './ThemeColorSettings'

interface Props {
  resume: Resume
  layoutStatus: PreviewLayoutStatus | null
}

const FONT_SIZE_OPTIONS = [11, 12, 13, 14, 15, 16, 17, 18]
const H1_OPTIONS = [20, 22, 24, 26, 28, 30, 32, 34, 36]
const H2_OPTIONS = [14, 15, 16, 17, 18, 19, 20, 22, 24]
const H3_OPTIONS = [12, 13, 14, 15, 16, 17, 18]
const MARGIN_OPTIONS = [20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64]
const LINE_HEIGHT_OPTIONS = [1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0]
const SECTION_GAP_OPTIONS = [12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40]

const SIZE_PRESETS = [
  { id: 'compact', label: '紧凑', fontSize: 12, lineHeight: 1.4, margin: 28 },
  { id: 'standard', label: '标准', fontSize: 14, lineHeight: 1.6, margin: 40 },
  { id: 'loose', label: '宽松', fontSize: 15, lineHeight: 1.8, margin: 48 },
] as const

// 模板可以使用非整数排版参数，控件必须如实显示当前值。
const numericOptions = (opts: number[], current: number | undefined, unit = 'px') =>
  [...new Set(current === undefined ? opts : [...opts, current])].sort((a, b) => a - b)
    .map((value) => ({ value: String(value), label: `${value}${unit}` }))

const headingSizeOptions = (opts: number[], current?: number, recommended?: number) => [
  { value: '', label: recommended ? `默认（${recommended}px）` : '默认' },
  ...numericOptions(opts, current),
]

function Field({
  label,
  className = '',
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`preview-setting-field ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}

export function PreviewToolbar({ resume, layoutStatus, onEdit }: Props & { onEdit: () => void }) {
  const setTheme = useResumeStore((s) => s.setTheme)
  const resetTheme = useResumeStore((s) => s.resetTheme)
  const t = resolveResumeTheme(resume)
  const template = getTemplate(resume.template)
  const headingTheme = template.themeScope === 'template'
    ? resume.templateThemeOverrides?.[template.id] ?? {}
    : t
  const recommended = template.themeScope === 'template' ? template.defaultTheme : undefined
  const toolButtonCls = 'preview-tool-button'
  const defaultStyle = isResumeThemeDefault(resume)
  const activePreset = SIZE_PRESETS.find(
    (p) => t.fontSize === p.fontSize && t.lineHeight === p.lineHeight && t.margin === p.margin,
  )

  return (
    <div className="preview-toolbar">
      <TemplatePicker resume={resume} />
      <span className="preview-tool-divider" />
      <ResumePhotoControl resume={resume} />
      <Popover
        ariaLabel="风格设置"
        trigger={
          <Button type="button" size="sm" title="选择主题色与整套风格" className={toolButtonCls} aria-label="主色与风格">
            <Palette size={13} strokeWidth={1.75} />
            <span className="preview-toolbar-label">配色</span>
          </Button>
        }
      >
        <ThemeColorSettings resume={resume} />
      </Popover>

      <Popover
        ariaLabel="排版设置"
        trigger={
          <Button type="button" size="sm" title="调整字体、字号、间距与标题" className={toolButtonCls} aria-label="排版">
            <SlidersHorizontal size={13} strokeWidth={1.75} />
            <span className="preview-toolbar-label">排版</span>
          </Button>
        }
      >
        <div className="typography-settings flex w-[336px] flex-col gap-4">
          <div className="typography-presets flex items-center gap-1">
            <span className="mr-1 text-[12px] text-[var(--muted)]">排版预设</span>
            {SIZE_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                active={activePreset?.id === preset.id}
                title={`排版预设：${preset.label}（字号 ${preset.fontSize}px / 行高 ${preset.lineHeight} / 边距 ${preset.margin}px）`}
                onClick={() => setTheme(resume.id, {
                  fontSize: preset.fontSize,
                  lineHeight: preset.lineHeight,
                  margin: preset.margin,
                })}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-3">
            <Field label="字体" className="col-span-2 w-full">
              <Select
                aria-label="字体"
                padRight="22px"
                value={t.fontFamily ?? 'sans'}
                onChange={(value) => setTheme(resume.id, { fontFamily: value })}
                options={FONT_OPTIONS.map((font) => ({ value: font.id, label: font.label, style: { fontFamily: font.stack } }))}
              />
            </Field>
            <Field label="正文" className="w-full">
              <Select aria-label="正文字号" padRight="22px" value={String(t.fontSize)} onChange={(value) => setTheme(resume.id, { fontSize: Number(value) })} options={numericOptions(FONT_SIZE_OPTIONS, t.fontSize)} />
            </Field>
            <Field label="边距" className="w-full">
              <Select aria-label="边距" padRight="22px" value={String(t.margin)} onChange={(value) => setTheme(resume.id, { margin: Number(value) })} options={numericOptions(MARGIN_OPTIONS, t.margin)} />
            </Field>
            <Field label="行高" className="w-full">
              <Select aria-label="行高" padRight="22px" value={String(t.lineHeight)} onChange={(value) => setTheme(resume.id, { lineHeight: Number(value) })} options={numericOptions(LINE_HEIGHT_OPTIONS, t.lineHeight, '')} />
            </Field>
            <Field label="模块间距" className="w-full">
              <Select aria-label="模块间距" padRight="22px" value={headingTheme.sectionGap ? String(headingTheme.sectionGap) : ''} onChange={(value) => setTheme(resume.id, { sectionGap: value ? Number(value) : undefined })} options={headingSizeOptions(SECTION_GAP_OPTIONS, headingTheme.sectionGap, recommended?.sectionGap)} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="姓名" className="w-full">
              <Select aria-label="H1 字号" padRight="22px" value={headingTheme.h1Size ? String(headingTheme.h1Size) : ''} onChange={(value) => setTheme(resume.id, { h1Size: value ? Number(value) : undefined })} options={headingSizeOptions(H1_OPTIONS, headingTheme.h1Size, recommended?.h1Size)} />
            </Field>
            <Field label="章节" className="w-full">
              <Select aria-label="H2 字号" padRight="22px" value={headingTheme.h2Size ? String(headingTheme.h2Size) : ''} onChange={(value) => setTheme(resume.id, { h2Size: value ? Number(value) : undefined })} options={headingSizeOptions(H2_OPTIONS, headingTheme.h2Size, recommended?.h2Size)} />
            </Field>
            <Field label="条目" className="w-full">
              <Select aria-label="H3 字号" padRight="22px" value={headingTheme.h3Size ? String(headingTheme.h3Size) : ''} onChange={(value) => setTheme(resume.id, { h3Size: value ? Number(value) : undefined })} options={headingSizeOptions(H3_OPTIONS, headingTheme.h3Size, recommended?.h3Size)} />
            </Field>
          </div>
          <div className="flex justify-end border-t border-[var(--border)] pt-3">
            <Button type="button" size="sm" className={toolButtonCls} title="恢复当前模板的默认主题排版" disabled={defaultStyle} onClick={() => resetTheme(resume.id)}>
              <Undo2 size={13} strokeWidth={1.75} /> 恢复默认
            </Button>
          </div>
        </div>
      </Popover>

      <span className="toolbar-spacer" />
      <PreviewHeader resume={resume} layoutStatus={layoutStatus} />
      <button type="button" className="preview-back-button" aria-label="返回编辑" onClick={onEdit}><ArrowLeft size={15} /><span>编辑</span></button>
    </div>
  )
}

function currentLayout(resume: Resume, status: PreviewLayoutStatus | null) {
  return status?.resumeId === resume.id && !status.pending ? status : null
}

function resultLabel(status: PreviewLayoutStatus | null) {
  if (!status) return '正在测量页面…'
  if (status.error) return '分页失败，请刷新页面重试'
  if (status.result === 'compressed') return `已压缩 ${status.compressionPercent}%`
  if (status.result === 'overflow') return '内容过多，无法安全压缩'
  if (status.result === 'fits') return '内容适合一页，无需压缩'
  return '智能一页未开启'
}

export function PreviewHeader({ resume, layoutStatus }: Props) {
  const autoOnePage = useResumeStore((s) => s.autoOnePage)
  const setAutoOnePage = useResumeStore((s) => s.setAutoOnePage)
  const status = currentLayout(resume, layoutStatus)
  const label = resultLabel(status)

  return (
    <>
      <Popover
        ariaLabel="分页详情"
        trigger={<button type="button" className="page-count-button" title={label} aria-label={status && !status.error ? `${status.pageCount}页，${label}` : label}>{status?.error ? '分页失败' : status ? `${status.pageCount} 页` : '测量中'}</button>}
      >
        <div className="pagination-details">
          <strong>{status?.error ? '分页失败' : status ? `当前 ${status.pageCount} 页` : '正在测量页面'}</strong>
          <p className={status?.result === 'overflow' ? 'pagination-warning' : ''}>{label}</p>
          {status?.result === 'compressed' && (
            <dl>
              <dt>正文字号</dt><dd>{status.original.fontSize}px → {status.rendered.fontSize}px</dd>
              <dt>页边距</dt><dd>{status.original.margin}px → {status.rendered.margin}px</dd>
              <dt>行高</dt><dd>{status.original.lineHeight} → {status.rendered.lineHeight}</dd>
            </dl>
          )}
          {status?.result === 'overflow' && <p>原始内容约 {status.rawPageCount} 页。系统保留了可读字号，建议精简内容或使用紧凑排版。</p>}
          {status?.result === 'off' && status.pageCount > 1 && <p>智能一页可在安全范围内收紧略超一页的内容。</p>}
        </div>
      </Popover>
      <button type="button" className="smart-page-toggle" aria-pressed={autoOnePage} aria-label={`智能一页：${autoOnePage ? '已开启' : '未开启'}`} title="内容略超一页时自动压缩到一页" onClick={() => setAutoOnePage(!autoOnePage)}>
        <span>智能一页</span><span className="smart-page-track" aria-hidden="true" />
      </button>
    </>
  )
}

export function PreviewStatusBar({ resume, layoutStatus }: Props) {
  const status = currentLayout(resume, layoutStatus)
  return (
    <footer className={`preview-status-bar ${status?.result === 'overflow' ? 'has-overflow' : ''}`}>
      <span className="preview-result" role="status" aria-live="polite"><Check size={12} />{resultLabel(status)}</span>
      <span className="preview-interaction-hint">点击内容定位编辑 · A4</span>
    </footer>
  )
}
