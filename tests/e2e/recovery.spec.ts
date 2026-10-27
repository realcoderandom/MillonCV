import { readFile } from 'node:fs/promises'
import { test, expect, openResume, readStoredState, resumeFixture, seedStorage, storedFixture, storedJson, STORAGE_KEY, switchMode } from '@/../tests/e2e/fixtures'

test('首次空存储创建一份示例，刷新后继续使用同一份数据', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^简历版本：示例简历/ })).toBeVisible()
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).not.toBeNull()
  const before = await readStoredState(page)
  expect(before.resumes).toHaveLength(1)
  await page.reload()
  await expect(page.getByRole('button', { name: /^简历版本：示例简历/ })).toBeVisible()
  const after = await readStoredState(page)
  expect(after.resumes.map((resume) => resume.id)).toEqual(before.resumes.map((resume) => resume.id))
})

for (const kind of ['json', 'snapshots', 'sections'] as const) {
  test(`异常 ${kind} 保留原存储并可下载完整原始备份`, async ({ page }) => {
    const state = storedFixture()
    const raw = kind === 'json' ? '{"version":10,"state":'
      : kind === 'snapshots' ? JSON.stringify({ version: 10, state: { ...state, snapshots: { 'resume-e2e': null } } })
      : JSON.stringify({ version: 10, state: { ...state, resumes: [{ ...state.resumes[0], sections: null }] } })
    await seedStorage(page, raw)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '无法读取本地简历' })).toBeVisible()
    await expect(page.getByRole('button', { name: '导出 PDF' })).toHaveCount(0)

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '下载原始备份' }).click()
    const download = await downloadPromise
    expect(await readFile((await download.path())!, 'utf8')).toBe(raw)
    await page.reload()
    await expect(page.getByRole('heading', { name: '无法读取本地简历' })).toBeVisible()
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(raw)
  })
}

test('数据修复后可以重试读取，并重新保存正文', async ({ page }) => {
  await seedStorage(page, '{"state":')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '无法读取本地简历' })).toBeVisible()
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: STORAGE_KEY, raw: storedJson() })
  await page.getByRole('button', { name: '重试读取' }).click()
  const name = page.getByRole('textbox', { name: '姓名', exact: true })
  await expect(name).toHaveValue('当前姓名')
  await name.fill('恢复后继续编辑')
  await expect.poll(async () => (await readStoredState(page)).resumes[0].sections[0]).toMatchObject({ data: { name: '恢复后继续编辑' } })
  await page.reload()
  await expect(name).toHaveValue('恢复后继续编辑')
})

for (const mode of ['Markdown', '文档编辑'] as const) {
  test(`${mode} 在防抖提交前恢复快照，旧草稿不能覆盖恢复结果`, async ({ page }) => {
    await page.clock.install()
    await seedStorage(page)
    await openResume(page)
    await switchMode(page, mode)
    const source = page.getByRole('textbox', { name: 'Markdown 简历源码' })
    const heading = page.getByRole('textbox', { name: '富文本简历编辑器' }).locator('h1')
    if (mode === 'Markdown') await expect(source).toBeVisible()
    else await expect(heading).toHaveText('当前姓名')
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))

    if (mode === 'Markdown') await source.fill((await source.inputValue()).replace('# 当前姓名', '# 恢复前的末次草稿'))
    else await heading.fill('恢复前的末次草稿')
    await page.getByRole('button', { name: '查看自动快照' }).click()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: '恢复', exact: true }).click()
    await page.clock.runFor(1200)
    if (mode === 'Markdown') await expect(source).toHaveValue(/^# 历史姓名\n/)
    else await expect(heading).toHaveText('历史姓名')
    const state = await readStoredState(page)
    expect(state.resumes[0].sections[0]).toMatchObject({ data: { name: '历史姓名' } })
    expect(state.snapshots['resume-e2e'].some((snapshot) => snapshot.resume.sections[0].type === 'basics'
      && snapshot.resume.sections[0].data.name === '恢复前的末次草稿')).toBe(true)
    await page.reload()
    await expect(page.getByRole('textbox', { name: '姓名', exact: true })).toHaveValue('历史姓名')
  })
}

test('未知模板读取后完整回退经典，保存仍保留未来模板的主题覆盖', async ({ page }) => {
  const state = storedFixture()
  const resume = { ...state.resumes[0], template: 'future-template', templateThemeOverrides: { 'future-template': { fontSize: 17 } } }
  await seedStorage(page, JSON.stringify({ version: 10, state: { ...state, resumes: [resume] } }))
  await openResume(page)
  await expect(page.locator('#resume-print-root .resume')).toHaveClass(/\bclassic\b/)
  await expect(page.locator('#resume-print-root')).toContainText('当前姓名')
  await page.getByRole('textbox', { name: '姓名', exact: true }).fill('回退后继续编辑')
  await expect.poll(async () => (await readStoredState(page)).resumes[0].template).toBe('classic')
  expect((await readStoredState(page)).resumes[0].templateThemeOverrides).toEqual({ 'future-template': { fontSize: 17 } })
  await page.reload()
  await expect(page.getByRole('textbox', { name: '姓名', exact: true })).toHaveValue('回退后继续编辑')
  await expect(page.locator('#resume-print-root .resume')).toHaveClass(/\bclassic\b/)
})

test('v1 历史快照恢复完整日期、项目简介与技术栈，并识别旧模板别名', async ({ page }) => {
  const state = storedFixture()
  const history = {
    ...resumeFixture('历史姓名'), template: 'asu',
    templateThemeOverrides: { asu: { fontFamily: 'technical-print' } },
    sections: [
      resumeFixture('历史姓名').sections[0],
      { id: 'legacy-projects', type: 'projects', title: '项目经历', data: { items: [{
        id: 'legacy-project', title: '旧项目', subtitle: '负责人', start: '2020', end: '2022',
        description: '- 完成开发', techStack: 'TypeScript', summary: '历史项目简介', fieldOrder: ['summary', 'techStack'],
      }] } },
    ],
  }
  await seedStorage(page, JSON.stringify({ version: 1, state: {
    ...state, snapshots: { 'resume-e2e': [{ id: 'snapshot-v1', createdAt: Date.now() - 60_000, resume: history }] },
  } }))
  await openResume(page)
  await page.getByRole('button', { name: '查看自动快照' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '恢复', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '姓名', exact: true })).toHaveValue('历史姓名')
  await expect(page.getByRole('textbox', { name: '时间 / 补充信息', exact: true })).toHaveValue('2020 - 2022')
  await expect(page.locator('#resume-print-root .resume')).toHaveClass(/\btechnicalCompact\b/)
  await expect(page.locator('#resume-print-root')).toContainText('历史项目简介')
  await expect(page.locator('#resume-print-root')).toContainText('技术栈：TypeScript')
  await expect.poll(async () => (await readStoredState(page)).resumes[0].template).toBe('technicalCompact')
  const restored = (await readStoredState(page)).resumes[0]
  expect(restored.sections[1]).toMatchObject({ title: '项目经验', data: { items: [{
    id: 'legacy-project', rightText: '2020 - 2022', description: '历史项目简介\n\n**技术栈**：TypeScript\n\n- 完成开发',
  }] } })
  await page.reload()
  await expect(page.getByRole('textbox', { name: '时间 / 补充信息', exact: true })).toHaveValue('2020 - 2022')
})
