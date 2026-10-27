import { useId, type KeyboardEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { scrollToResumeTarget, type ResumeField } from '@/resume/focus'

function advanceField(event: KeyboardEvent<HTMLInputElement>) {
  // 输入法确认候选词时保留 Enter；普通单行输入可前进，Shift + Enter 可返回。
  if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey) return
  const section = event.currentTarget.closest('.module-detail')
  if (!section) return
  const fields = Array.from(section.querySelectorAll<HTMLElement>('.module-input-field input, .module-field-prose[contenteditable="true"], .module-field-source'))
    .filter((element) => element.getClientRects().length > 0 && !element.closest('[hidden], [inert], details:not([open])'))
  const next = fields[fields.indexOf(event.currentTarget) + (event.shiftKey ? -1 : 1)]
  if (!next) return
  event.preventDefault()
  next.focus({ preventScroll: true })
  const container = section.closest<HTMLElement>('.module-editor-scroll')
  if (container) {
    const bounds = next.getBoundingClientRect()
    const visible = container.getBoundingClientRect()
    if (bounds.top < visible.top + 16 || bounds.bottom > visible.bottom - 16) {
      scrollToResumeTarget(container, next.closest<HTMLElement>('[data-resume-field]') ?? next)
    }
  }
}

export function ModuleField({ label, value, onChange, id, placeholder, field, type = 'text', icon: Icon, autoComplete = 'off', variant, optional }: {
  label: string; value: string; onChange: (value: string) => void; id?: string; placeholder?: string; field: ResumeField; type?: 'text' | 'email' | 'tel' | 'url'
  icon?: LucideIcon; autoComplete?: string; variant?: 'name'; optional?: boolean
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return <div className={`module-input-field${variant ? ` module-input-field-${variant}` : ''}`} data-resume-field={field} data-filled={Boolean(value)}>
    <div className="module-input-label"><label htmlFor={inputId}>{label}{optional && <span className="module-field-optional">选填</span>}</label><span className="module-field-key" aria-hidden="true">Enter <span>下一项</span> ↵</span></div>
    <div className="module-input-control">
      {Icon && <Icon size={15} className="module-input-icon" aria-hidden="true" />}
      <input id={inputId} type={type} autoComplete={autoComplete} autoCapitalize={type === 'email' || type === 'url' ? 'none' : undefined} enterKeyHint="next" aria-describedby={`${inputId}-keyboard`} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} onKeyDown={advanceField} />
    </div>
    <span id={`${inputId}-keyboard`} className="sr-only">按 Enter 编辑下一项，Shift 加 Enter 返回上一项。</span>
  </div>
}
