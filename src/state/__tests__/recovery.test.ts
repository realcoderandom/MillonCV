import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSampleResume } from '@/resume/sample'
import { serializeResume } from '@/resume/markdown/serialize'
import { parseMarkdownWithDiagnostics } from '@/resume/markdown/parse'
import { resolveResumeTheme } from '@/templates/theme'
import { getTemplate, LEGACY_TEMPLATES } from '@/templates/registry'
import { getResumeHydrationState } from '../storage/resumeHydration'
import { RESUME_STORAGE_VERSION } from '../resumeMigrations'
import type { Resume } from '@/resume/model'

let useResumeStore: typeof import('../useResumeStore').useResumeStore
let flushResumeStorage: typeof import('../useResumeStore').flushResumeStorage

beforeAll(async () => {
  const data = new Map<string, string>()
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  })
  ;({ useResumeStore, flushResumeStorage } = await import('../useResumeStore'))
})

describe('简历恢复机制', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-13T14:00:00Z'))
    const resume = createSampleResume()
    resume.id = 'resume-a'
    useResumeStore.setState({
      resumes: [resume],
      currentId: resume.id,
      moduleNavigationWidth: 176,
      snapshots: {},
      lastDeleted: null,
      parseNotice: null,
    })
  })

  it.each([8, 9])('v%s 的旧默认项目标题在主文档、快照与撤销记录中同步更新，自定义标题保留', async (version) => {
    const resume = structuredClone(useResumeStore.getState().resumes[0])
    const project = resume.sections.find((section) => section.type === 'projects')!
    project.title = '项目经历'
    resume.sections.push({ ...project, id: 'custom-project-title', title: '代表作品' })
    resume.sections.push({ id: 'custom-section', type: 'custom', title: '项目经历', data: { title: '项目经历', content: '保留自定义内容' } })
    const snapshot = { id: 'old-project-title', createdAt: Date.now(), resume }
    localStorage.setItem('resume-maker:store', JSON.stringify({ version, state: {
      resumes: [resume], currentId: resume.id,
      snapshots: { [resume.id]: [snapshot] },
      lastDeleted: { resume, snapshots: [snapshot], index: 0, deletedAt: Date.now() },
      parseNotice: { id: 'parse-notice', resumeId: resume.id, diagnostics: [], previousSections: resume.sections },
    } }))
    await useResumeStore.persist.rehydrate()
    const state = useResumeStore.getState()
    const expected = resume.sections.map((section) => section.id === project.id ? { ...section, title: '项目经验' } : section)
    for (const document of [state.resumes[0], state.snapshots[resume.id][0].resume, state.lastDeleted!.resume, state.lastDeleted!.snapshots[0].resume]) {
      expect(document.sections).toEqual(expected)
    }
    expect(state.parseNotice?.previousSections).toEqual(expected)
    expect(serializeResume(state.resumes[0])).toContain('## 项目经验')
  })

  it('完成迁移后用户仍可把项目模块命名为旧字样，刷新不会再次覆盖', async () => {
    const resume = structuredClone(useResumeStore.getState().resumes[0])
    resume.sections.find((section) => section.type === 'projects')!.title = '项目经历'
    localStorage.setItem('resume-maker:store', JSON.stringify({ version: 10, state: { resumes: [resume], currentId: resume.id } }))
    await useResumeStore.persist.rehydrate()
    expect(useResumeStore.getState().resumes[0].sections).toEqual(resume.sections)
  })

  it.each([undefined, 0, 1, 10])('v%s 的旧技能分组在正文和所有历史容器中恢复为 Markdown，保存后仍可读取', async (version) => {
    const original = structuredClone(useResumeStore.getState().resumes[0])
    const resume = { ...original, sections: original.sections.map((section) => section.type === 'skills'
      ? { ...section, data: { groups: [
        { id: 'languages', category: '语言', items: ['TypeScript', 'Go'] },
        { id: 'frameworks', category: '框架', items: ['React', 'Vue'] },
        { id: 'other', category: '', items: ['无分组技能'] },
      ] } }
      : section) }
    const snapshot = { id: 'legacy-skills', createdAt: Date.now(), resume }
    localStorage.setItem('resume-maker:store', JSON.stringify({ version, state: {
      resumes: [resume], currentId: resume.id,
      snapshots: { [resume.id]: [snapshot] },
      lastDeleted: { resume, snapshots: [snapshot], index: 0, deletedAt: Date.now() },
      parseNotice: { id: 'notice', resumeId: resume.id, diagnostics: [], previousSections: resume.sections },
    } }))

    await useResumeStore.persist.rehydrate()
    expect(getResumeHydrationState().status).toBe('ready')
    const loaded = useResumeStore.getState()
    const expectedSkills = { ...original.sections[2], data: { content: '**语言**\n- TypeScript\n- Go\n\n**框架**\n- React\n- Vue\n\n- 无分组技能' } }
    for (const sections of [
      loaded.resumes[0].sections, loaded.snapshots[resume.id][0].resume.sections,
      loaded.lastDeleted!.resume.sections, loaded.lastDeleted!.snapshots[0].resume.sections,
      loaded.parseNotice!.previousSections,
    ]) {
      expect(sections[2]).toEqual(expectedSkills)
      expect(sections.filter((section) => section.type !== 'skills')).toEqual(original.sections.filter((section) => section.type !== 'skills'))
    }
    expect(loaded.resumes[0].id).toBe(original.id)
    expect(loaded.resumes[0].theme).toEqual(original.theme)

    flushResumeStorage()
    expect(JSON.parse(localStorage.getItem('resume-maker:store')!).version).toBe(RESUME_STORAGE_VERSION)
    await useResumeStore.persist.rehydrate()
    expect(getResumeHydrationState().status).toBe('ready')
    expect(useResumeStore.getState().resumes[0].sections[2]).toEqual(expectedSkills)
  })

  it('编辑前生成快照，并可恢复到该版本', () => {
    const original = structuredClone(useResumeStore.getState().resumes[0].sections)
    const changed = structuredClone(original)
    changed[0].title = '已修改基本信息'

    useResumeStore.getState().setSections('resume-a', changed)
    const snapshot = useResumeStore.getState().snapshots['resume-a'][0]
    expect(snapshot.resume.sections).toEqual(original)

    useResumeStore.getState().restoreSnapshot('resume-a', snapshot.id)
    expect(useResumeStore.getState().resumes[0].sections).toEqual(original)
  })

  it.each(['json', 'snapshots', 'sections', 'theme', 'version', 'envelope', 'null', 'array'])('读取异常 %s 不覆盖原存储，可在修复后重试', async (kind) => {
    const resume = structuredClone(useResumeStore.getState().resumes[0])
    const valid = JSON.stringify({ version: 10, state: { resumes: [resume], currentId: resume.id } })
    const raw = kind === 'json' ? '{"state":'
      : kind === 'snapshots' ? JSON.stringify({ version: 10, state: { resumes: [resume], snapshots: { [resume.id]: null } } })
      : kind === 'sections' ? JSON.stringify({ version: 10, state: { resumes: [{ ...resume, sections: null }] } })
      : kind === 'theme' ? JSON.stringify({ version: 10, state: { resumes: [{ ...resume, theme: { ...resume.theme, primaryColor: null } }] } })
      : kind === 'version' ? JSON.stringify({ version: RESUME_STORAGE_VERSION + 1, state: { resumes: [resume] } })
      : kind === 'null' ? 'null' : kind === 'array' ? '[]' : '{}'
    localStorage.setItem('resume-maker:store', raw)
    await useResumeStore.persist.rehydrate()
    expect(getResumeHydrationState()).toMatchObject({ status: 'error', raw })
    expect(useResumeStore.persist.hasHydrated()).toBe(false)
    useResumeStore.getState().setUiTheme('dark')
    flushResumeStorage()
    vi.advanceTimersByTime(2_000)
    expect(localStorage.getItem('resume-maker:store')).toBe(raw)

    localStorage.setItem('resume-maker:store', valid)
    await useResumeStore.persist.rehydrate()
    expect(getResumeHydrationState().status).toBe('ready')
    expect(useResumeStore.persist.hasHydrated()).toBe(true)
    expect(useResumeStore.getState().resumes).toEqual([resume])
    useResumeStore.getState().renameResume(resume.id, '重新保存成功')
    flushResumeStorage()
    expect(JSON.parse(localStorage.getItem('resume-maker:store')!).state.resumes[0].name).toBe('重新保存成功')
  })

  it('忽略未知状态字段而不覆盖操作函数，空字符串键也不会被误判为 JSON 根', async () => {
    const resume = structuredClone(useResumeStore.getState().resumes[0])
    localStorage.setItem('resume-maker:store', JSON.stringify({ version: 10, state: {
      resumes: [resume], currentId: resume.id, createResume: 'invalid action', future: { '': '保留未来扩展空间' },
    } }))
    await useResumeStore.persist.rehydrate()
    expect(getResumeHydrationState().status).toBe('ready')
    expect(useResumeStore.getState().resumes).toEqual([resume])
    expect(typeof useResumeStore.getState().createResume).toBe('function')
  })

  it('旧数据的可选照片宽度为 null 时仍交给规范化处理', async () => {
    const resume = structuredClone(useResumeStore.getState().resumes[0])
    localStorage.setItem('resume-maker:store', JSON.stringify({ version: 8, state: {
      resumes: [{ ...resume, theme: { ...resume.theme, photoWidth: null } }], currentId: resume.id,
    } }))
    await useResumeStore.persist.rehydrate()
    expect(getResumeHydrationState().status).toBe('ready')
    expect(useResumeStore.getState().resumes[0].theme.photoWidth).toBeUndefined()
  })

  it('连续表单修改均基于最新 sections，不互相覆盖', () => {
    const { setSections } = useResumeStore.getState()
    const basics = useResumeStore.getState().resumes[0].sections[0]
    setSections('resume-a', (sections) => sections.map((section) => section.id === basics.id && section.type === 'basics'
      ? { ...section, data: { ...section.data, name: '最新姓名' } }
      : section))
    setSections('resume-a', (sections) => sections.map((section) => section.id === basics.id && section.type === 'basics'
      ? { ...section, data: { ...section.data, title: '最新职位' } }
      : section))

    expect(useResumeStore.getState().resumes[0].sections[0]).toMatchObject({ data: { name: '最新姓名', title: '最新职位' } })
  })

  it('切换简历后旧编辑器的定向提交只修改旧简历', () => {
    const second = createSampleResume()
    second.id = 'resume-b'
    useResumeStore.setState((state) => ({ resumes: [...state.resumes, second], currentId: second.id }))
    const before = structuredClone(second.sections)
    useResumeStore.getState().setSections('resume-a', (sections) => sections.map((section) => section.type === 'basics'
      ? { ...section, data: { ...section.data, name: '旧简历最后输入' } }
      : section))

    const state = useResumeStore.getState()
    expect(state.currentId).toBe('resume-b')
    expect(state.resumes.find((resume) => resume.id === 'resume-b')?.sections).toEqual(before)
    expect(state.resumes.find((resume) => resume.id === 'resume-a')?.sections[0]).toMatchObject({ data: { name: '旧简历最后输入' } })
  })

  it('每份简历最多保留 10 个自动快照', () => {
    for (let index = 0; index < 12; index += 1) {
      vi.advanceTimersByTime(31_000)
      const sections = structuredClone(useResumeStore.getState().resumes[0].sections)
      sections[0].title = `版本 ${index}`
      useResumeStore.getState().setSections('resume-a', sections)
    }

    expect(useResumeStore.getState().snapshots['resume-a']).toHaveLength(10)
  })

  it('删除后可撤销，并恢复原顺序和当前简历', () => {
    const second = createSampleResume()
    second.id = 'resume-b'
    useResumeStore.setState((state) => ({ resumes: [...state.resumes, second] }))
    const sections = structuredClone(useResumeStore.getState().resumes[0].sections)
    sections[0].title = '生成删除前快照'
    useResumeStore.getState().setSections('resume-a', sections)

    useResumeStore.getState().removeResume('resume-a')
    expect(useResumeStore.getState().resumes.map((resume) => resume.id)).toEqual(['resume-b'])
    expect(useResumeStore.getState().snapshots['resume-a']).toBeUndefined()

    useResumeStore.getState().undoRemoveResume()
    expect(useResumeStore.getState().resumes.map((resume) => resume.id)).toEqual([
      'resume-a',
      'resume-b',
    ])
    expect(useResumeStore.getState().currentId).toBe('resume-a')
    expect(useResumeStore.getState().snapshots['resume-a']).toHaveLength(1)
  })

  it('结构变化提示可撤销到解析前内容', () => {
    const previous = structuredClone(useResumeStore.getState().resumes[0].sections)
    const parsed = structuredClone(previous)
    parsed[1] = {
      id: 'custom-fallback',
      type: 'custom',
      title: '任职记录',
      data: { title: '任职记录', content: '- 内容仍在' },
    }

    useResumeStore.getState().commitParsedSections(
      'resume-a',
      parsed,
      [{
        kind: 'section-type-changed',
        title: '任职记录',
        fromType: 'experience',
        toType: 'custom',
      }],
      previous,
    )
    expect(useResumeStore.getState().parseNotice?.resumeId).toBe('resume-a')

    useResumeStore.getState().undoLastParse()
    expect(useResumeStore.getState().resumes[0].sections).toEqual(previous)
    expect(useResumeStore.getState().parseNotice).toBeNull()
  })

  it('布局调整不改写正文，切换模板、编辑正文与复制后仍保留配置', () => {
    const resume = useResumeStore.getState().resumes[0]
    const markdown = serializeResume(resume)
    const layout = {
      order: resume.sections.map((s) => s.id).reverse(),
      regions: { [resume.sections[1].id]: 'sidebar' as const },
      sidebarWidth: 38,
    }
    useResumeStore.getState().setLayout(resume.id, layout)
    useResumeStore.getState().setTemplate(resume.id, 'modern')
    useResumeStore.getState().setTemplate(resume.id, 'classic')

    const parsed = parseMarkdownWithDiagnostics(markdown, resume.sections)
    useResumeStore.getState().commitParsedSections(resume.id, parsed.sections, parsed.diagnostics, resume.sections)
    const updated = useResumeStore.getState().resumes[0]
    expect(updated.layout).toEqual(layout)
    expect(serializeResume(updated)).toBe(markdown)

    const copyId = useResumeStore.getState().duplicateResume(resume.id)
    const copy = useResumeStore.getState().resumes.find((r) => r.id === copyId)
    expect(copy?.layout).toEqual(layout)
    expect(copy?.layout).not.toBe(updated.layout)
  })

  it('恢复模板布局只清除布局配置，保留主题与正文', () => {
    const resume = useResumeStore.getState().resumes[0]
    useResumeStore.getState().setLayout(resume.id, { sidebarWidth: 38 })
    useResumeStore.getState().setLayout(resume.id, undefined)
    const updated = useResumeStore.getState().resumes[0]
    expect(updated.layout).toBeUndefined()
    expect(updated.sections).toEqual(resume.sections)
    expect(updated.theme).toEqual(resume.theme)
  })

  it('历史快照会保存并恢复对应布局', () => {
    const resume = useResumeStore.getState().resumes[0]
    useResumeStore.getState().setLayout(resume.id, { sidebarWidth: 38 })
    vi.advanceTimersByTime(31_000)
    useResumeStore.getState().setLayout(resume.id, { sidebarWidth: 28 })
    const snapshot = useResumeStore.getState().snapshots[resume.id][0]
    expect(snapshot.resume.layout).toEqual({ sidebarWidth: 38 })
    useResumeStore.getState().restoreSnapshot(resume.id, snapshot.id)
    expect(useResumeStore.getState().resumes[0].layout).toEqual({ sidebarWidth: 38 })
  })

  it('旧文档 hydrate 时沿用默认布局，新配置能够随文档重新加载', async () => {
    const resume = useResumeStore.getState().resumes[0]
    localStorage.setItem('resume-maker:store', JSON.stringify({
      version: 5,
      state: { resumes: [resume], currentId: resume.id },
    }))
    await useResumeStore.persist.rehydrate()
    expect(useResumeStore.getState().resumes[0].layout).toBeUndefined()

    useResumeStore.getState().setLayout(resume.id, { sidebarWidth: 36 })
    vi.advanceTimersByTime(2_000)
    const saved = localStorage.getItem('resume-maker:store')
    expect(saved).toBeTruthy()
    expect(JSON.parse(saved!).state.resumes[0].layout).toEqual({ sidebarWidth: 36 })
    await useResumeStore.persist.rehydrate()
    expect(useResumeStore.getState().resumes[0].layout).toEqual({ sidebarWidth: 36 })
  })

  it('目录宽度独立保存、限制边界，不修改简历和历史', () => {
    const before = useResumeStore.getState().resumes[0]
    useResumeStore.getState().setModuleNavigationWidth(255.5)
    expect(useResumeStore.getState().moduleNavigationWidth).toBe(256)
    expect(useResumeStore.getState().resumes[0]).toBe(before)
    expect(useResumeStore.getState().snapshots).toEqual({})
    vi.advanceTimersByTime(2_000)
    expect(JSON.parse(localStorage.getItem('resume-maker:store')!).state.moduleNavigationWidth).toBe(256)
    useResumeStore.getState().setModuleNavigationWidth(500)
    expect(useResumeStore.getState().moduleNavigationWidth).toBe(320)
    useResumeStore.getState().setModuleNavigationWidth(10)
    expect(useResumeStore.getState().moduleNavigationWidth).toBe(160)
    useResumeStore.getState().setModuleNavigationWidth(Number.NaN)
    expect(useResumeStore.getState().moduleNavigationWidth).toBe(176)
  })

  it('目录宽度刷新后恢复，旧存储缺少宽度时使用默认值', async () => {
    const resume = useResumeStore.getState().resumes[0]
    localStorage.setItem('resume-maker:store', JSON.stringify({ version: 8, state: { resumes: [resume], currentId: resume.id, moduleNavigationWidth: 248 } }))
    await useResumeStore.persist.rehydrate()
    expect(useResumeStore.getState().moduleNavigationWidth).toBe(248)
    localStorage.setItem('resume-maker:store', JSON.stringify({ version: 8, state: { resumes: [resume], currentId: resume.id } }))
    await useResumeStore.persist.rehydrate()
    expect(useResumeStore.getState().moduleNavigationWidth).toBe(176)
  })

  it('技术精简主题调整独立保存，复制、撤销删除与历史恢复均不丢失', () => {
    const state = useResumeStore.getState()
    const original = state.resumes[0]
    state.setTemplate(original.id, 'technicalCompact')
    state.setTheme(original.id, { fontSize: 12, h2Size: 20 })
    state.setSections(original.id, structuredClone(original.sections))
    const snapshot = useResumeStore.getState().snapshots[original.id][0]
    state.setTheme(original.id, { fontSize: 16 })
    state.restoreSnapshot(original.id, snapshot.id)
    const restored = useResumeStore.getState().resumes[0]
    expect(resolveResumeTheme(restored).fontSize).toBe(12)
    expect(restored.theme).toEqual(original.theme)

    const copyId = state.duplicateResume(original.id)
    const copy = useResumeStore.getState().resumes.find((resume) => resume.id === copyId)!
    expect(copy.templateThemeOverrides).toEqual(restored.templateThemeOverrides)
    expect(copy.templateThemeOverrides).not.toBe(restored.templateThemeOverrides)
    state.removeResume(copyId)
    state.undoRemoveResume()
    expect(resolveResumeTheme(useResumeStore.getState().resumes.find((resume) => resume.id === copyId)!).fontSize).toBe(12)

    state.setTemplate(original.id, 'classic')
    state.resetTheme(original.id)
    expect(useResumeStore.getState().resumes[0].templateThemeOverrides).toEqual({ technicalCompact: { fontSize: 12, h2Size: 20 } })
  })

  it('v6 旧文档主题保持原值，技术精简覆盖值可持久化并重新加载', async () => {
    const resume = useResumeStore.getState().resumes[0]
    resume.theme = { ...resume.theme, fontSize: 17, primaryColor: '#a34b2f', h2Size: 23 }
    localStorage.setItem('resume-maker:store', JSON.stringify({ version: 6, state: { resumes: [resume], currentId: resume.id } }))
    await useResumeStore.persist.rehydrate()
    expect(useResumeStore.getState().resumes[0].theme).toEqual(resume.theme)
    expect(useResumeStore.getState().resumes[0].templateThemeOverrides).toBeUndefined()

    useResumeStore.getState().setTemplate(resume.id, 'technicalCompact')
    useResumeStore.getState().setTheme(resume.id, { lineHeight: 1.4, fontSize: 12 })
    vi.advanceTimersByTime(2_000)
    await useResumeStore.persist.rehydrate()
    const reloaded = useResumeStore.getState().resumes[0]
    expect(resolveResumeTheme(reloaded)).toMatchObject({ fontSize: 12, lineHeight: 1.4, h2Size: 17 })
    useResumeStore.getState().setTemplate(resume.id, 'classic')
    expect(useResumeStore.getState().resumes[0].theme).toEqual(resume.theme)
  })

  it.each([7, 8, 9])('v%s 读取时统一迁移文档、快照和删除记录的旧标识与主题覆盖键', async (version) => {
    const resume = useResumeStore.getState().resumes[0]
    const stored = { ...resume, template: 'asu', theme: { ...resume.theme, photoWidth: 999 }, templateThemeOverrides: { asu: { fontSize: 12, lineHeight: null, photoWidth: 20 } } }
    const snapshot = { id: 'old-snapshot', createdAt: Date.now(), resume: stored }
    localStorage.setItem('resume-maker:store', JSON.stringify({
      version,
      state: {
        resumes: [stored], currentId: resume.id,
        snapshots: { [resume.id]: [snapshot] },
        lastDeleted: { resume: stored, snapshots: [snapshot], index: 0, deletedAt: Date.now() },
      },
    }))
    await useResumeStore.persist.rehydrate()
    const loaded = useResumeStore.getState()
    for (const document of [loaded.resumes[0], loaded.snapshots[resume.id][0].resume, loaded.lastDeleted!.resume, loaded.lastDeleted!.snapshots[0].resume]) {
      expect(document.template).toBe('technicalCompact')
      expect(document.templateThemeOverrides).toEqual({ technicalCompact: { fontSize: 12, photoWidth: 56 } })
      expect(document.sections).toEqual(resume.sections)
      expect(document.theme.photoWidth).toBe(140)
      expect(resolveResumeTheme(document).lineHeight).toBe(1.52)
    }
  })

  it('旧标识导入、历史恢复与撤销删除后，导出始终使用技术精简标识且设置不丢失', () => {
    const resume = useResumeStore.getState().resumes[0]
    const stored = {
      ...resume,
      template: 'asu',
      templateThemeOverrides: { asu: { fontSize: 12, photoWidth: 110 }, future: { margin: 25 } },
      layout: { sidebarWidth: 35 },
    }
    const state = useResumeStore.getState()
    const importedId = state.importResume(stored)
    const expected = {
      template: 'technicalCompact', sections: stored.sections, theme: stored.theme, layout: stored.layout,
      templateThemeOverrides: { technicalCompact: { fontSize: 12, photoWidth: 110 }, future: { margin: 25 } },
    }
    expect(state.exportResume(importedId)).toMatchObject(expected)
    // 恢复入口也需兼容尚未经过 hydrate 的旧快照。
    useResumeStore.setState({ snapshots: { [resume.id]: [{ id: 'legacy-id', createdAt: Date.now(), resume: stored as Resume }] } })
    state.restoreSnapshot(resume.id, 'legacy-id')
    expect(state.exportResume(resume.id)).toMatchObject(expected)
    state.removeResume(importedId)
    state.undoRemoveResume()
    expect(state.exportResume(importedId)).toMatchObject(expected)
    const copyId = state.duplicateResume(importedId)
    expect(state.exportResume(copyId)).toMatchObject(expected)
  })

  it.each(LEGACY_TEMPLATES)('退出选择器的 $label 模板在刷新、导入和历史恢复后仍保留原版式', async (template) => {
    const resume = useResumeStore.getState().resumes[0]
    const stored = {
      ...resume,
      template: template.id,
      theme: { ...resume.theme, fontSize: 16, primaryColor: '#a34b2f' },
      layout: { sidebarWidth: 35, regions: { [resume.sections[0].id]: 'sidebar' as const } },
      templateThemeOverrides: { technicalCompact: { photoWidth: 110 } },
    }
    const snapshot = { id: 'legacy-template-snapshot', createdAt: Date.now(), resume: stored }
    localStorage.setItem('resume-maker:store', JSON.stringify({
      version: 8,
      state: { resumes: [stored], currentId: stored.id, snapshots: { [stored.id]: [snapshot] } },
    }))
    await useResumeStore.persist.rehydrate()
    expect(useResumeStore.getState().resumes[0]).toEqual(stored)
    expect(getTemplate(useResumeStore.getState().resumes[0].template)).toBe(template)

    const importedId = useResumeStore.getState().importResume(stored)
    expect(useResumeStore.getState().resumes.find((item) => item.id === importedId)).toMatchObject({
      template: stored.template, theme: stored.theme, sections: stored.sections,
      layout: stored.layout, templateThemeOverrides: stored.templateThemeOverrides,
    })
    useResumeStore.getState().setTemplate(stored.id, 'classic')
    useResumeStore.getState().restoreSnapshot(stored.id, snapshot.id)
    expect(useResumeStore.getState().resumes.find((item) => item.id === stored.id)).toMatchObject(stored)
  })

  it.each(['classic', 'technicalCompact'] as const)('照片大小在 %s 模板中随刷新、复制和历史恢复保留', async (template) => {
    const state = useResumeStore.getState()
    const id = state.resumes[0].id
    state.setTemplate(id, template)
    state.setTheme(id, { photoWidth: 116 })
    const sections = structuredClone(useResumeStore.getState().resumes[0].sections)
    state.setSections(id, sections)
    const snapshot = useResumeStore.getState().snapshots[id][0]
    vi.advanceTimersByTime(2_000)
    await useResumeStore.persist.rehydrate()
    expect(resolveResumeTheme(useResumeStore.getState().resumes[0]).photoWidth).toBe(116)

    const copyId = state.duplicateResume(id)
    const copy = useResumeStore.getState().resumes.find((resume) => resume.id === copyId)!
    expect(resolveResumeTheme(copy).photoWidth).toBe(116)
    expect(copy.sections).toEqual(sections)
    state.setTheme(id, { photoWidth: 60 })
    state.restoreSnapshot(id, snapshot.id)
    expect(resolveResumeTheme(useResumeStore.getState().resumes.find((resume) => resume.id === id)!).photoWidth).toBe(116)
  })

  it('照片和子项目随刷新、复制、历史恢复保留，移除照片不影响正文', async () => {
    const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII='
    const state = useResumeStore.getState()
    const resume = state.resumes[0]
    const sections = structuredClone(resume.sections)
    const company = sections.find((section) => section.type === 'experience')!
    if (company.type === 'experience') company.data.items[0].projects = [{ id: 'nested-project', title: '任务编排', subtitle: '开发', description: '- 交付内容' }]
    state.setSections(resume.id, sections)
    state.setPhoto(resume.id, photo)
    const markdown = serializeResume(useResumeStore.getState().resumes[0])
    const parsed = parseMarkdownWithDiagnostics(markdown, useResumeStore.getState().resumes[0].sections)
    state.commitParsedSections(resume.id, parsed.sections, parsed.diagnostics, sections)
    vi.advanceTimersByTime(2_000)
    await useResumeStore.persist.rehydrate()
    const restored = useResumeStore.getState().resumes[0]
    expect(serializeResume(restored)).toBe(markdown)
    const copyId = state.duplicateResume(resume.id)
    const copy = useResumeStore.getState().resumes.find((item) => item.id === copyId)!
    expect(copy.sections).toEqual(restored.sections)
    expect(copy.sections).not.toBe(restored.sections)

    state.setPhoto(resume.id, undefined)
    const snapshot = useResumeStore.getState().snapshots[resume.id][0]
    expect(serializeResume(useResumeStore.getState().resumes[0])).not.toContain('![证件照]')
    state.restoreSnapshot(resume.id, snapshot.id)
    expect(serializeResume(useResumeStore.getState().resumes[0])).toBe(markdown)
  })
})
