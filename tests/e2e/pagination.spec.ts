import { test, expect, openResume, resumeFixture, seedStorage, storedFixture, storedJson, switchMode } from '@/../tests/e2e/fixtures'

for (const template of ['classic', 'modern', 'technicalCompact'] as const) {
  test(`${template} 使用最新的多页分页快照打印，并生成有效 PDF`, async ({ page }, testInfo) => {
    const resume = resumeFixture()
    resume.template = template
    // 独立模板同样指定系统字体，避免网络速度改变分页结果。
    resume.templateThemeOverrides = { technicalCompact: { fontFamily: 'technical-print' } }
    const work = resume.sections.find((section) => section.type === 'experience')!
    work.data.items[0].description = Array.from({ length: 45 }, (_, index) => `- 第 ${index + 1} 项成果：负责架构设计、交付流程与质量保障，持续完善用户体验和工程协作。`).join('\n')
    await seedStorage(page, storedJson(storedFixture(resume)))
    await openResume(page)
    await switchMode(page, 'Markdown')
    const source = page.getByRole('textbox', { name: 'Markdown 简历源码' })
    await source.fill((await source.inputValue()).replace('# 当前姓名', '# 最新打印姓名'))
    await page.evaluate(() => {
      const result: { text: string; pages: number; title: string }[] = []
      Object.defineProperty(window, '__printResults', { value: result })
      window.print = () => result.push({
        text: document.getElementById('resume-print-root')?.textContent ?? '',
        pages: document.querySelectorAll('#resume-print-root .pagedjs_page').length,
        title: document.title,
      })
    })
    await page.getByRole('button', { name: '导出 PDF', exact: true }).click()
    const printButton = page.getByRole('button', { name: '打开打印窗口', exact: true })
    await expect(printButton).toBeEnabled()
    await printButton.click()
    const printed = await page.evaluate(() => (window as Window & { __printResults?: { text: string; pages: number; title: string }[] }).__printResults ?? [])
    expect(printed).toHaveLength(1)
    expect(printed[0].text).toContain('最新打印姓名')
    expect(printed[0].text).toContain('第 45 项成果')
    expect(printed[0].pages).toBeGreaterThan(1)
    expect(printed[0].title).toContain('最新打印姓名')
    expect(await page.title()).toBe('MillonCV')
    const framePages = await page.frameLocator('iframe[title="简历分页预览"]').locator('.pagedjs_page').count()
    expect(framePages).toBe(printed[0].pages)
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length).toBe(printed[0].pages)
    await testInfo.attach(`${template}.pdf`, { body: pdf, contentType: 'application/pdf' })
  })
}

test('新分页失败时禁止导出遗留的旧快照', async ({ page }) => {
  await seedStorage(page)
  await openResume(page)
  await expect.poll(() => page.locator('#resume-print-root .pagedjs_page').count()).toBeGreaterThan(0)
  const frame = page.frames().find((frame) => frame !== page.mainFrame())!
  await frame.evaluate(() => Object.defineProperty(window, 'PagedModule', { value: undefined, configurable: true }))
  await page.getByRole('textbox', { name: '姓名', exact: true }).fill('分页失败后的新姓名')
  await expect(page.locator('#resume-print-root')).toHaveAttribute('data-pagination-error', /分页组件加载失败/)
  await expect(page.locator('#resume-print-root')).toContainText('当前姓名')
  await page.getByRole('button', { name: '导出 PDF', exact: true }).click()
  await expect(page.getByRole('button', { name: '打开打印窗口', exact: true })).toBeDisabled()
})
