import { describe, expect, it } from 'vitest'
import { createSampleResume } from '@/resume/sample'
import { getPrintReadiness } from '../printReadiness'
import type { PreviewLayoutStatus } from '../layout'

function layout(resumeId: string, result: PreviewLayoutStatus['result']): PreviewLayoutStatus {
  return {
    resumeId,
    pageCount: result === 'overflow' ? 2 : 1,
    rawPageCount: result === 'overflow' ? 2 : 1,
    result,
    compressionPercent: 0,
    original: { fontSize: 14, lineHeight: 1.6, margin: 40 },
    rendered: { fontSize: 14, lineHeight: 1.6, margin: 40 },
  }
}

describe('打印前交付检查', () => {
  it('正常简历返回姓名、页数且无问题', () => {
    const resume = createSampleResume()
    expect(getPrintReadiness(resume, layout(resume.id, 'fits'))).toEqual({
      candidateName: '张三',
      candidateTitle: '资深前端工程师',
      suggestedFilename: '张三-资深前端工程师',
      pageCount: 1,
      issues: [],
    })
  })

  it('识别未完成测量和空白姓名', () => {
    const resume = createSampleResume()
    const basics = resume.sections.find((section) => section.type === 'basics')
    if (basics?.type === 'basics') basics.data.name = '   '
    expect(getPrintReadiness(resume, null).issues).toEqual(['layout-pending', 'missing-name'])
  })

  it('识别超出智能一页安全压缩范围', () => {
    const resume = createSampleResume()
    expect(getPrintReadiness(resume, layout(resume.id, 'overflow')).issues).toContain('unsafe-overflow')
  })

  it('不会使用其他简历的页数', () => {
    const resume = createSampleResume()
    expect(getPrintReadiness(resume, layout('another-resume', 'fits')).pageCount).toBeNull()
  })

  it('同一简历重新分页时，不把上一次的页数当成交付结果', () => {
    const resume = createSampleResume()
    const readiness = getPrintReadiness(resume, { ...layout(resume.id, 'fits'), pending: true })
    expect(readiness.pageCount).toBeNull()
    expect(readiness.issues).toContain('layout-pending')
  })

  it('分页失败时阻止使用旧快照，区别于仍在计算', () => {
    const resume = createSampleResume()
    const readiness = getPrintReadiness(resume, { ...layout(resume.id, 'fits'), error: '分页失败' })
    expect(readiness.pageCount).toBeNull()
    expect(readiness.issues).toContain('layout-failed')
    expect(readiness.issues).not.toContain('layout-pending')
  })

  it('文件名优先组合正文姓名与职位，并清理非法字符', () => {
    const resume = createSampleResume()
    const basics = resume.sections.find((section) => section.type === 'basics')
    if (basics?.type === 'basics') {
      basics.data.name = '张/三'
      basics.data.title = '前端:工程师'
    }
    expect(getPrintReadiness(resume, layout(resume.id, 'fits')).suggestedFilename).toBe('张-三-前端-工程师')
  })

  it('空白占位内容不作为姓名或职位，文件名回退版本名称', () => {
    const resume = createSampleResume()
    resume.name = '前端岗位版本'
    const basics = resume.sections.find((section) => section.type === 'basics')
    if (basics?.type === 'basics') {
      basics.data.name = '姓名'
      basics.data.title = '职位'
    }
    const readiness = getPrintReadiness(resume, layout(resume.id, 'fits'))
    expect(readiness.candidateName).toBe('')
    expect(readiness.candidateTitle).toBe('')
    expect(readiness.suggestedFilename).toBe('前端岗位版本')
    expect(readiness.issues).toContain('missing-name')
  })
})
