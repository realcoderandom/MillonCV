import type { Frame, Page } from '@playwright/test'
import { test, expect, openResume, readStoredState, resumeFixture, seedStorage, storedFixture, storedJson } from '@/../tests/e2e/fixtures'

async function observePagination(page: Page): Promise<Frame> {
  await expect.poll(() => page.locator('#resume-print-root .pagedjs_page').count()).toBe(1)
  const frame = page.frames().find((frame) => frame !== page.mainFrame())!
  await frame.evaluate(() => {
    const module = Reflect.get(window, 'PagedModule') as { Previewer: { prototype: { preview: (...args: unknown[]) => Promise<unknown> } } }
    const original = module.Previewer.prototype.preview
    const metrics = { calls: 0 }
    Reflect.set(window, '__paginationMetrics', metrics)
    module.Previewer.prototype.preview = function (this: unknown, ...args: unknown[]) {
      metrics.calls += 1
      return original.apply(this, args)
    }
  })
  return frame
}

async function paginationCalls(frame: Frame) {
  return frame.evaluate(() => (Reflect.get(window, '__paginationMetrics') as { calls: number }).calls)
}

for (const template of ['classic', 'technicalCompact'] as const) {
  test(`${template} 连续输入只分页一次，重命名不重排，立即导出使用最新内容`, async ({ page }, testInfo) => {
    const resume = resumeFixture()
    resume.template = template
    resume.templateThemeOverrides = { technicalCompact: { fontFamily: 'technical-print' } }
    await page.clock.install()
    await seedStorage(page, storedJson(storedFixture(resume)))
    await openResume(page)
    const frame = await observePagination(page)
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
    const name = page.getByRole('textbox', { name: '姓名', exact: true })
    for (let index = 0; index < 10; index += 1) {
      await name.fill(`连续输入 ${index}`)
      await page.clock.runFor(120)
    }
    expect(await paginationCalls(frame)).toBe(0)
    await page.clock.runFor(200)
    await expect(page.locator('#resume-print-root')).toContainText('连续输入 9')
    const afterTyping = await paginationCalls(frame)
    expect(afterTyping).toBe(1)

    await page.getByRole('button', { name: /^简历版本：/ }).click()
    await page.getByRole('button', { name: '重命名版本', exact: true }).click()
    await page.getByRole('textbox', { name: /版本名称/ }).fill('重命名的版本')
    await page.getByRole('button', { name: '确认版本名称', exact: true }).click()
    await page.keyboard.press('Escape')
    await page.clock.runFor(600)
    const afterRename = await paginationCalls(frame)
    expect(afterRename).toBe(afterTyping)

    await name.fill('立即导出的末次输入')
    await page.evaluate(() => {
      window.print = () => Reflect.set(window, '__printedText', document.getElementById('resume-print-root')?.textContent)
    })
    await page.getByRole('button', { name: '导出 PDF', exact: true }).click()
    // 未推进 200ms 的合并计时器，打开导出入口就应推动最新分页。
    await expect.poll(() => paginationCalls(frame)).toBe(afterRename + 1)
    await page.clock.runFor(600)
    await page.getByRole('button', { name: '打开打印窗口', exact: true }).click()
    expect(await page.evaluate(() => Reflect.get(window, '__printedText') as string)).toContain('立即导出的末次输入')
    await testInfo.attach('pagination-counts.json', { contentType: 'application/json', body: JSON.stringify({
      template, inputEvents: 10, paginationRunsAfterTyping: afterTyping, paginationRunsForRename: afterRename - afterTyping,
      paginationRunsIncludingExport: await paginationCalls(frame),
    }, null, 2) })
  })
}

test('大历史存储的连续偏好更新只写一次，不重复编码正文和快照', async ({ page }, testInfo) => {
  const state = storedFixture()
  state.resumes = Array.from({ length: 5 }, (_, index) => resumeFixture(index === 0 ? '当前姓名' : `版本 ${index}`, `resume-${index}`))
  state.currentId = state.resumes[0].id
  state.snapshots = Object.fromEntries(state.resumes.map((resume) => [resume.id, Array.from({ length: 10 }, (_, index) => {
    const history = structuredClone(resume)
    const skills = history.sections.find((section) => section.type === 'skills')!
    skills.data.content = '历史内容'.repeat(10_000)
    return { id: `snapshot-${index}`, createdAt: Date.now() - index * 31_000, resume: history }
  })]))
  const raw = storedJson(state)
  await page.clock.install()
  await seedStorage(page, raw)
  await openResume(page)
  await page.evaluate(() => {
    const metrics = { encodes: 0, writes: 0 }
    const isResume = (value: unknown) => value !== null && typeof value === 'object' && Array.isArray(Reflect.get(value, 'sections'))
    const hasDocuments = (value: unknown) => {
      if (value === null || typeof value !== 'object') return false
      const object = value as Record<string, unknown>
      if (Array.isArray(object.resumes)) return true
      if (object.state && typeof object.state === 'object' && Array.isArray(Reflect.get(object.state, 'resumes'))) return true
      if (Array.isArray(value)) return value.some((item: unknown) => isResume(item))
      return Object.values(object).some((value) => Array.isArray(value) && value.some((item: unknown) => item !== null
        && typeof item === 'object' && isResume(Reflect.get(item, 'resume'))))
    }
    const stringify = JSON.stringify
    JSON.stringify = ((value: unknown, ...args: unknown[]) => {
      if (hasDocuments(value)) metrics.encodes += 1
      return Reflect.apply(stringify, JSON, [value, ...args])
    }) as typeof JSON.stringify
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      if (this === localStorage && key === 'resume-maker:store') metrics.writes += 1
      return write.call(this, key, value)
    }
    Reflect.set(window, '__storageMetrics', metrics)
  })
  await page.getByRole('button', { name: '切换深色主题', exact: true }).click()
  await expect.poll(async () => (await readStoredState(page)).uiTheme).toBe('dark')
  const coldEncodes = await page.evaluate(() => {
    const metrics = Reflect.get(window, '__storageMetrics') as { encodes: number; writes: number }
    const count = metrics.encodes
    metrics.encodes = 0
    metrics.writes = 0
    return count
  })
  expect(coldEncodes).toBeGreaterThanOrEqual(2)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  for (let index = 0; index < 20; index += 1) {
    await page.getByRole('button', { name: /^切换[浅深]色主题$/ }).click()
  }
  const beforeFlush = await page.evaluate(() => Reflect.get(window, '__storageMetrics') as { encodes: number; writes: number })
  expect(beforeFlush).toEqual({ encodes: 0, writes: 0 })
  await page.clock.runFor(500)
  const afterFlush = await page.evaluate(() => Reflect.get(window, '__storageMetrics') as { encodes: number; writes: number })
  expect(afterFlush).toEqual({ encodes: 0, writes: 1 })
  const stored = await readStoredState(page)
  expect(stored.resumes).toEqual(state.resumes)
  expect(stored.snapshots).toEqual(state.snapshots)
  await testInfo.attach('serialization-counts.json', { contentType: 'application/json', body: JSON.stringify({
    serializedCharacters: raw.length, resumes: 5, snapshots: 50, preferenceUpdates: 20, coldEncodes, ...afterFlush,
  }, null, 2) })
})

test('执行中的旧分页不会发布，后续输入只运行最新待办', async ({ page }) => {
  await page.clock.install()
  await seedStorage(page)
  await openResume(page)
  const frame = await observePagination(page)
  await frame.evaluate(() => {
    const module = Reflect.get(window, 'PagedModule') as { Previewer: { prototype: { preview: (...args: unknown[]) => Promise<unknown> } } }
    const original = module.Previewer.prototype.preview
    let release!: () => void
    const blocked = new Promise<void>((done) => { release = done })
    Reflect.set(window, '__releasePagination', release)
    let first = true
    module.Previewer.prototype.preview = async function (this: unknown, ...args: unknown[]) {
      const result = await original.apply(this, args)
      if (first) { first = false; await blocked }
      return result
    }
  })
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  const name = page.getByRole('textbox', { name: '姓名', exact: true })
  await name.fill('执行中的过期输入')
  await page.clock.runFor(400)
  expect(await paginationCalls(frame)).toBe(1)
  for (let index = 0; index < 5; index += 1) {
    await name.fill(`最新待办 ${index}`)
    await page.clock.runFor(120)
  }
  await page.clock.runFor(200)
  expect(await paginationCalls(frame)).toBe(1)
  await expect(page.locator('#resume-print-root')).toContainText('当前姓名')
  await frame.evaluate(() => (Reflect.get(window, '__releasePagination') as () => void)())
  await page.clock.runFor(400)
  await expect(page.locator('#resume-print-root')).toContainText('最新待办 4')
  expect(await paginationCalls(frame)).toBe(2)
})
