import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, type Resume } from '../model'
import { resolveResumeTarget, type ResumeTarget } from '../focus'

const resume: Resume = {
  id: 'resume-a', name: '岗位版本', template: 'classic', theme: DEFAULT_THEME, updatedAt: 0,
  sections: [
    { id: 'basics', type: 'basics', title: '个人信息', data: { name: '陈晓', title: '前端工程师', contact: { phone: '', email: '', location: '', website: '', github: '' }, summary: '' } },
    { id: 'work', type: 'experience', title: '相关经历', data: { items: [
      { id: 'company', title: '公司', subtitle: '工程师', description: '', projects: [{ id: 'project', title: '子项目', subtitle: '', description: '' }] },
    ] } },
    { id: 'awards', type: 'custom', title: '研究成果', data: { title: '研究成果', content: '' } },
  ],
}
const section: ResumeTarget = { resumeId: resume.id, sectionId: 'work' }
const item: ResumeTarget = { ...section, itemId: 'company' }

describe('工作区双向定位', () => {
  it('保留条目和子项目的具体字段', () => {
    const target: ResumeTarget = { ...item, projectId: 'project', field: 'description' }
    expect(resolveResumeTarget(resume, target)).toEqual(target)
  })

  it('跨简历的旧请求不会定位到同名模块', () => {
    expect(resolveResumeTarget(resume, { ...item, resumeId: 'resume-b' })).toBeNull()
  })

  it('已删除的模块不会定位到其他模块', () => {
    expect(resolveResumeTarget(resume, { ...section, sectionId: 'removed' })).toBeNull()
  })

  it('条目被删除后退回所属模块，去除旧字段', () => {
    expect(resolveResumeTarget(resume, { ...item, itemId: 'removed', field: 'description' })).toEqual(section)
  })

  it('子项目被删除后退回父条目，去除子项目字段', () => {
    expect(resolveResumeTarget(resume, { ...item, projectId: 'removed', field: 'title' })).toEqual(item)
  })

  it('模块层面的请求不会误用子条目的字段', () => {
    expect(resolveResumeTarget(resume, { ...section, field: 'description' })).toEqual(section)
  })

  it('保留基本信息和自定义模块中的字段', () => {
    for (const target of [
      { resumeId: resume.id, sectionId: 'basics', field: 'email' },
      { resumeId: resume.id, sectionId: 'basics', field: 'workExperience' },
      { resumeId: resume.id, sectionId: 'awards', field: 'content' },
      { ...section, field: 'heading' },
    ] satisfies ResumeTarget[]) expect(resolveResumeTarget(resume, target)).toEqual(target)
  })

  it('忽略与模块类型不符的字段', () => {
    expect(resolveResumeTarget(resume, { resumeId: resume.id, sectionId: 'basics', field: 'description' })).toEqual({ resumeId: resume.id, sectionId: 'basics' })
  })
})
