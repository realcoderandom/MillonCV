import { describe, expect, it } from 'vitest'
import { createResumeCommands } from '../commands'
import { createSampleResume } from '../sample'
import { normalizeResumeLayout } from '../layout'
import type { ItemSection, ResumeLayout, Section } from '../model'

function setup() {
  const original = createSampleResume()
  const experience: ItemSection = {
    id: 'experience', type: 'experience', title: '工作经历', data: { items: [
      { id: 'first', title: '第一家公司', subtitle: '开发', description: '原始描述', projects: [
        { id: 'child', title: '子项目', subtitle: '负责人', description: '子项目描述' },
      ] },
      { id: 'second', title: '第二家公司', subtitle: '开发', description: '保留内容' },
    ] },
  }
  original.sections = [original.sections[0], experience, { id: 'skills', type: 'skills', title: '技能', data: { content: 'TypeScript' } }]
  const other = { ...structuredClone(original), id: 'other' }
  let resumes = [original, other]
  const setSections = (id: string, update: (sections: Section[]) => Section[]) => {
    resumes = resumes.map((resume) => {
      if (resume.id !== id) return resume
      const sections = update(resume.sections)
      return sections === resume.sections ? resume : { ...resume, sections }
    })
  }
  const setLayout = (id: string, layout: ResumeLayout | undefined) => {
    resumes = resumes.map((resume) => resume.id === id
      ? { ...resume, layout: normalizeResumeLayout(layout, resume.sections) }
      : resume)
  }
  const commands = createResumeCommands(original.id, () => ({ resumes, setSections, setLayout }))
  const current = () => resumes.find((resume) => resume.id === original.id)!
  const items = () => (current().sections.find((section) => section.id === 'experience') as ItemSection).data.items
  return { commands, current, items, original, other, setLayout, resumes: () => resumes, removeResume: () => { resumes = [other] } }
}

describe('模块编辑命令的状态边界', () => {
  it('连续字段修改读取最新值，其他分节与另一份简历保持原引用', () => {
    const { commands, current, original, other, resumes } = setup()
    const basics = original.sections[0]
    commands.patchBasics(basics.id, { name: '新姓名' })
    commands.patchContact(basics.id, { email: 'new@example.com' })
    commands.patchBasics(basics.id, { title: '新职位' })
    expect(current().sections[0]).toMatchObject({ data: { name: '新姓名', title: '新职位', contact: { email: 'new@example.com' } } })
    expect(current().sections[1]).toBe(original.sections[1])
    expect(resumes()[1]).toBe(other)
    expect(original.sections[0]).toBe(basics)
    expect(original.sections[0]).not.toMatchObject({ data: { name: '新姓名' } })
    const before = current()
    commands.patchItem('experience', 'missing', { title: '忽略' })
    commands.patchProject('experience', 'first', 'missing', { title: '忽略' })
    commands.moveItem('experience', 'first', -1)
    expect(current()).toBe(before)
  })

  it('删除条目后编辑其他条目，撤销只恢复被删内容且重复调用不覆盖新状态', () => {
    const { commands, current, items } = setup()
    const removal = commands.removeItem('experience', 'first')!
    expect(removal.focusId).toBe('second')
    commands.patchItem('experience', 'second', { title: '第二家公司已修改' })
    removal.undo.restore()
    expect(items().map((item) => item.id)).toEqual(['first', 'second'])
    expect(items()[0].projects?.[0].id).toBe('child')
    expect(items()[1].title).toBe('第二家公司已修改')
    const restored = current()
    removal.undo.restore()
    expect(current()).toBe(restored)
  })

  it('子项目撤销保留父条目的新内容，父条目已删除时不会重新创建它', () => {
    const { commands, current, items } = setup()
    const removal = commands.removeItem('experience', 'first', 'child')!
    expect(items()[0]).not.toHaveProperty('projects')
    commands.patchItem('experience', 'first', { subtitle: '新职位' })
    removal.undo.restore()
    expect(items()[0]).toMatchObject({ subtitle: '新职位', projects: [{ id: 'child' }] })
    commands.removeItem('experience', 'first')
    const before = current()
    removal.undo.restore()
    expect(current()).toBe(before)
    expect(items().map((item) => item.id)).toEqual(['second'])
  })

  it('分节撤销恢复显示位置和区域，同时保留之后的布局与正文修改', () => {
    const { commands, current, original, setLayout } = setup()
    const basicsId = original.sections[0].id
    setLayout(original.id, { order: [basicsId, 'skills', 'experience'], regions: { skills: 'sidebar' }, sidebarWidth: 30 })
    const removal = commands.removeSection('skills')!
    commands.patchItem('experience', 'second', { description: '删除后继续编辑' })
    setLayout(original.id, { order: ['experience', basicsId], regions: { experience: 'sidebar' }, sidebarWidth: 38 })
    removal.undo.restore()
    expect(current().layout).toEqual({
      order: ['experience', 'skills', basicsId], regions: { experience: 'sidebar', skills: 'sidebar' }, sidebarWidth: 38,
    })
    expect(current().sections[1]).toMatchObject({ data: { items: [expect.anything(), { description: '删除后继续编辑' }] } })
    setLayout(original.id, { order: ['skills', 'experience', basicsId], sidebarWidth: 35 })
    const before = current()
    removal.undo.restore()
    expect(current()).toBe(before)
  })

  it('自定义标题同步两处字段，基础信息不可删除或重复添加', () => {
    const { commands, current, original } = setup()
    expect(commands.removeSection(original.sections[0].id)).toBeUndefined()
    expect(commands.addSection('basics')).toBeUndefined()
    const custom = commands.addSection('custom')!
    commands.renameSection(custom.id, '证书与荣誉')
    commands.setContent(custom.id, '- 认证工程师')
    expect(current().sections[current().sections.length - 1]).toMatchObject({
      id: custom.id, title: '证书与荣誉', data: { title: '证书与荣誉', content: '- 认证工程师' },
    })
  })

  it('命令绑定原简历，原简历删除后旧命令和撤销不影响其他简历', () => {
    const { commands, other, removeResume, resumes } = setup()
    const removal = commands.removeSection('skills')!
    removeResume()
    commands.patchItem('experience', 'first', { title: '迟到的输入' })
    commands.addSection('custom')
    removal.undo.restore()
    expect(commands.currentResume()).toBeUndefined()
    expect(resumes()).toEqual([other])
    expect(resumes()[0]).toBe(other)
  })
})
