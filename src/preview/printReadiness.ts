import type { Resume } from '@/resume/model'
import type { PreviewLayoutStatus } from './layout'

export type PrintIssue = 'layout-pending' | 'layout-failed' | 'missing-name' | 'unsafe-overflow'

export interface PrintReadiness {
  candidateName: string
  candidateTitle: string
  suggestedFilename: string
  pageCount: number | null
  issues: PrintIssue[]
}

const EMPTY_CONTENT_VALUES = new Set(['姓名', '职位'])

function contentValue(value: string): string {
  const trimmed = value.trim()
  return EMPTY_CONTENT_VALUES.has(trimmed) ? '' : trimmed
}

function safeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()
}

export function getSuggestedPdfFilename(resume: Resume): string {
  const basics = resume.sections.find((section) => section.type === 'basics')
  const candidateName = basics?.type === 'basics' ? contentValue(basics.data.name) : ''
  const candidateTitle = basics?.type === 'basics' ? contentValue(basics.data.title) : ''
  const fromBody = [candidateName, candidateTitle].filter(Boolean).join('-')
  return safeFilename(fromBody || resume.name || '简历') || '简历'
}

export function getPrintReadiness(
  resume: Resume,
  layoutStatus: PreviewLayoutStatus | null,
): PrintReadiness {
  const basics = resume.sections.find((section) => section.type === 'basics')
  const candidateName = basics?.type === 'basics' ? contentValue(basics.data.name) : ''
  const candidateTitle = basics?.type === 'basics' ? contentValue(basics.data.title) : ''
  const currentLayout = layoutStatus?.resumeId === resume.id ? layoutStatus : null
  const activeLayout = currentLayout && !currentLayout.pending && !currentLayout.error ? currentLayout : null
  const issues: PrintIssue[] = []

  if (currentLayout?.error) issues.push('layout-failed')
  else if (!activeLayout) issues.push('layout-pending')
  if (!candidateName) issues.push('missing-name')
  if (activeLayout?.result === 'overflow') issues.push('unsafe-overflow')

  return {
    candidateName,
    candidateTitle,
    suggestedFilename: getSuggestedPdfFilename(resume),
    pageCount: activeLayout?.pageCount ?? null,
    issues,
  }
}
