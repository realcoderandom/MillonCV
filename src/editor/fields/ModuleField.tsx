import { memo, useId, type KeyboardEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { scrollToResumeTarget, type ResumeField } from '@/resume/focus'

const MODULE_FIELD_SELECTOR = '.module-input-field input, .module-field-prose[contenteditable="true"], .module-field-source'

function isVisibleControl(element: HTMLElement): boolean {
  return element.getClientRects().length > 0 && !element.closest('[hidden], [inert], details:not([open])')
}

function focusFieldElement(element: HTMLElement) {
  element.focus({ preventScroll: true })
  const container = element.closest<HTMLElement>('.module-editor-scroll')
  if (!container) return
  const bounds = element.getBoundingClientRect()
  const visible = container.getBoundingClientRect()
  if (bounds.top < visible.top + 16 || bounds.bottom > visible.bottom - 16) {
    scrollToResumeTarget(container, element.closest<HTMLElement>('[data-resume-field]') ?? element)
  }
}

export function moveFocusBetweenFields(current: HTMLElement, direction: -1 | 1): boolean {
  const section = current.closest('.module-detail')
  if (!section) return false
  const fields = Array.from(section.querySelectorAll<HTMLElement>(MODULE_FIELD_SELECTOR)).filter(isVisibleControl)
  const index = fields.indexOf(current)
  if (index < 0) return false
  const next = fields[index + direction]
  if (!next) return false
  focusFieldElement(next)
  return true
}

export function focusFirstSectionField(section: Element): boolean {
  const fields = Array.from(section.querySelectorAll<HTMLElement>(MODULE_FIELD_SELECTOR)).filter(isVisibleControl)
  const fallback = fields[0] ?? Array.from(section.querySelectorAll<HTMLElement>('.module-empty button, .module-item-toggle')).find(isVisibleControl)
  if (!fallback) return false
  focusFieldElement(fallback)
  return true
}

function advanceField(event: KeyboardEvent<HTMLInputElement>) {
  // 输入法确认候选词时保留 Enter；普通单行输入可前进，Shift + Enter 可返回。
  if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey) return
  if (moveFocusBetweenFields(event.currentTarget, event.shiftKey ? -1 : 1)) {
    event.preventDefault()
  }
}

export const ModuleField = memo(function ModuleField({ label, value, onChange, id, placeholder, field, type = 'text', icon: Icon, autoComplete = 'off', variant, optional, action, notice, onBlur }: {
  label: string; value: string; onChange: (value: string) => void; id?: string; placeholder?: string; field: ResumeField; type?: 'text' | 'email' | 'tel' | 'url'
  icon?: LucideIcon; autoComplete?: string; variant?: 'name'; optional?: boolean; action?: ReactNode; notice?: string; onBlur?: () => void
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = notice ? `${inputId}-keyboard ${inputId}-notice` : `${inputId}-keyboard`
  return <div className={`module-input-field${variant ? ` module-input-field-${variant}` : ''}${notice ? ' has-notice' : ''}`} data-resume-field={field} data-filled={Boolean(value)}>
    <div className="module-input-label">
      <label htmlFor={inputId}>{label}{optional && <span className="module-field-optional">选填</span>}</label>
      <span className="module-input-label-tools">{action}<span className="module-field-key" aria-hidden="true">Enter <span>下一项</span> ↵</span></span>
    </div>
    <div className="module-input-control">
      {Icon && <Icon size={15} className="module-input-icon" aria-hidden="true" />}
      <input id={inputId} type={type} autoComplete={autoComplete} autoCapitalize={type === 'email' || type === 'url' ? 'none' : undefined} enterKeyHint="next" aria-describedby={describedBy} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} onKeyDown={advanceField} />
    </div>
    {notice && <p id={`${inputId}-notice`} className="module-field-notice" role="status">{notice}</p>}
    <span id={`${inputId}-keyboard`} className="sr-only">按 Enter 编辑下一项，Shift 加 Enter 返回上一项。</span>
  </div>
})
