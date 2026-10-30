import { describe, expect, it } from 'vitest'
import { createSampleResume } from '@/resume/sample'
import { RESUME_STORAGE_VERSION } from '../../resumeMigrations'
import { validateResumeStorage } from '../resumeStorageSchema'

function storedSkills(data: unknown, version = 10) {
  const resume = createSampleResume()
  return { version, state: { resumes: [{ ...resume, sections: resume.sections.map((section) => section.type === 'skills'
    ? { ...section, data }
    : section) }] } }
}

describe('技能正文读取边界', () => {
  it.each([
    { groups: [] },
    { content: null, groups: [{ category: '语言', items: ['TypeScript'] }] },
  ])('允许可完整迁移的旧技能结构', (data) => {
    expect(() => validateResumeStorage(storedSkills(data), RESUME_STORAGE_VERSION)).not.toThrow()
  })

  it.each([
    {}, { content: null }, { content: 42 }, { content: [] }, { content: { text: '保留原始内容' } },
    { content: ['保留原始内容'], groups: [] },
  ])('无法识别的正文仍报错，禁止转换为空字符串', (data) => {
    expect(() => validateResumeStorage(storedSkills(data), RESUME_STORAGE_VERSION))
      .toThrow('本地简历数据格式异常：resumes[0].sections[2].data.content')
  })

  it('旧分组中的异常条目精确报错，不跳过内容', () => {
    expect(() => validateResumeStorage(storedSkills({ groups: [{ category: '语言', items: ['TypeScript', { text: '异常条目' }] }] }), RESUME_STORAGE_VERSION))
      .toThrow('本地简历数据格式异常：resumes[0].sections[2].data.groups[0].items[1]')
  })

  it('已迁移版本仍严格要求字符串正文', () => {
    expect(() => validateResumeStorage(storedSkills({ groups: [] }, RESUME_STORAGE_VERSION), RESUME_STORAGE_VERSION))
      .toThrow('本地简历数据格式异常：resumes[0].sections[2].data.content')
  })
})
