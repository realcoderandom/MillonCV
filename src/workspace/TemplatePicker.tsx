// 模板选择器：按钮触发弹窗，以卡片网格可视化各模板样式，点击切换
// 卡片用真实模板 Body + 固定示例数据 + transform scale 缩放，所见即所得
import { memo, useRef, useState } from 'react'
import { LayoutTemplate, X } from 'lucide-react'
import type { Resume, Section, TemplateId, ThemeConfig } from '@/resume/model'
import { TEMPLATES, getTemplate } from '@/templates/registry'
import { useResumeStore } from '@/state/useResumeStore'
import { themeStyle } from '@/templates/rendering'
import { selectWrapCls } from '@/shared/ui/classes'
import { useModalFocus } from '@/shared/hooks/useModalFocus'
import { resolveResumeTheme, selectResumeTemplate } from '@/templates/theme'

// 缩略图设计尺寸：与 .resume 一致（794px 宽，A4 比例 210:297）
const DESIGN_W = 794
const DESIGN_H = DESIGN_W * (297 / 210) // ≈ 1122
const THUMB_W = 184
const SCALE = THUMB_W / DESIGN_W // ≈ 0.232
const THUMB_H = DESIGN_H * SCALE // ≈ 260

// 固定示例数据：所有卡片共用，保证模板视觉一致可比（不随用户数据变化）
// 含 basics + experience + skills，体现单栏、侧栏与标题样式的差异
const THUMBNAIL_SECTIONS: Section[] = [
  {
    id: 'thumb-basics',
    type: 'basics',
    title: '基本信息',
    data: {
      name: '张三',
      title: '资深前端工程师',
      contact: {
        phone: '138-0000-0000',
        email: 'zhangsan@example.com',
        location: '上海',
        website: '',
        github: 'github.com/zhangsan',
      },
      summary: '七年前端开发经验，专注大型 Web 应用架构与性能优化。',
    },
  },
  {
    id: 'thumb-exp',
    type: 'experience',
    title: '工作经历',
    data: {
      items: [
        {
          id: 't1',
          title: '字节跳动',
          subtitle: '高级前端工程师',
          rightText: '2021 - 至今',
          description: '主导直播中台架构升级，首屏加载从 3.2s 降至 1.1s。',
        },
        {
          id: 't2',
          title: '腾讯',
          subtitle: '前端工程师',
          rightText: '2019 - 2021',
          description: '负责小程序电商模块，服务 2000 万用户。',
        },
      ],
    },
  },
  {
    id: 'thumb-skills',
    type: 'skills',
    title: '技能',
    data: { content: 'React · TypeScript · Vite · Node.js' },
  },
]

// 单个模板缩略图：真实渲染 Body，transform scale 缩放到卡片尺寸
const TemplateThumb = memo(function TemplateThumb({
  id,
  theme,
}: {
  id: TemplateId
  theme: ThemeConfig
}) {
  const { Body } = getTemplate(id)
  return (
    <div aria-hidden="true" {...{ inert: '' }} className="overflow-hidden rounded-[4px] bg-white" style={{ width: THUMB_W, height: THUMB_H }}>
      {/* position: relative 锚定缩放；pointer-events:none 防止缩略图内链接吞点击 */}
      <div
        className={`resume ${id}`}
        style={{
          ...themeStyle(theme),
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${SCALE})`,
          transformOrigin: 'top left',
          position: 'relative',
          boxShadow: 'none',
          pointerEvents: 'none',
        }}
      >
        <Body sections={THUMBNAIL_SECTIONS} />
      </div>
    </div>
  )
})

interface Props {
  resume: Resume
}

export function TemplatePicker({ resume }: Props) {
  const setTemplate = useResumeStore((s) => s.setTemplate)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const currentTpl = getTemplate(resume.template)

  useModalFocus({
    active: open,
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    restoreFocusRef: triggerRef,
    onClose: () => setOpen(false),
  })

  const currentLabel = currentTpl.label
  const legacyCurrent = !TEMPLATES.some((template) => template.id === resume.template)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${selectWrapCls} template-trigger`}
        onClick={() => setOpen(true)}
        title="切换布局模板"
        aria-label={`模板：${currentLabel}，切换布局模板`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <LayoutTemplate size={14} className="text-[var(--muted)] flex-shrink-0" />
        <span className="text-[13px] text-[var(--fg-dim)]">模板</span>
        <span className="text-[13px] text-[var(--fg)] font-medium">{currentLabel}</span>
      </button>

      {open && (
        <div
          data-no-print
          className="ui-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-dialog-title"
        >
          {/* 遮罩点击关闭；面板 stopPropagation 阻止冒泡 */}
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="template-dialog ui-dialog-panel max-h-[85dvh] max-w-[92vw] overflow-y-auto border border-[var(--border)] bg-[var(--panel-raised)] shadow-[var(--shadow-soft)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-6">
              <div className="min-w-0 flex-1">
                <h2 id="template-dialog-title" className="text-[20px] font-medium text-[var(--fg)]">
                  选择模板
                </h2>
                <p className="mt-1 text-[12px] text-[var(--muted)]">
                  {TEMPLATES.length} 款版式，按求职场景选择，颜色和排版可以稍后微调。
                </p>
                {legacyCurrent && (
                  <p className="mt-2 text-[12px] text-[var(--fg-dim)]" role="status">
                    当前使用的「{currentLabel}」已停止提供新选择，现有版式仍可继续编辑与导出。
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  ref={closeButtonRef}
                  type="button"
                  aria-label="关闭模板选择"
                  onClick={() => setOpen(false)}
                  className="ui-icon-button h-8 w-8"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
            <div className="template-grid">
              {TEMPLATES.map((t) => {
                const selected = t.id === resume.template
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTemplate(resume.id, t.id)
                      setOpen(false)
                    }}
                    className={`template-card flex w-[202px] flex-col border p-2 text-left transition-colors ${
                      selected
                        ? 'border-[var(--ui-accent)] bg-[var(--ui-selected)]'
                        : 'border-[var(--border)] hover:border-[var(--border-strong-hover)] hover:bg-[var(--hover)]'
                    }`}
                    title={`${t.label}：${t.bestFor}`}
                    aria-label={`${t.label}，适合${t.bestFor}，${t.description}`}
                    aria-pressed={selected}
                  >
                    <div className="self-center">
                      <TemplateThumb id={t.id} theme={resolveResumeTheme(selectResumeTemplate(resume, t.id))} />
                    </div>
                    <span className="mt-2 flex w-full items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-[var(--fg)]">{t.label}</span>
                      {selected && <span className="text-[11px] font-medium text-[var(--ui-accent)]">当前</span>}
                    </span>
                    <span className="mt-1 text-[10px] font-medium text-[var(--fg-dim)]">{t.bestFor}</span>
                    <span className="mt-0.5 text-[10px] leading-relaxed text-[var(--muted)]">{t.description}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
