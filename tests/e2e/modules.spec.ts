import { test, expect, openResume, readStoredState, resumeFixture, seedStorage, storedFixture, storedJson, switchMode } from '@/../tests/e2e/fixtures'

test('删除经历后继续编辑其他条目，撤销和刷新均保留修改、顺序及子项目 id', async ({ page }) => {
  const resume = resumeFixture()
  const experience = resume.sections.find((section) => section.type === 'experience')!
  experience.data.items.push({ id: 'second-company', title: '第二家公司', subtitle: '工程师', description: '其他经历' })
  await page.clock.install()
  await seedStorage(page, storedJson(storedFixture(resume)))
  await openResume(page)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await page.getByRole('button', { name: '经历：平台公司更多操作', exact: true }).click()
  await page.getByRole('menuitem', { name: '删除经历：平台公司', exact: true }).click()
  await expect(page.locator('.modular-editor [data-resume-item="company"]')).toHaveCount(0)
  await page.getByRole('button', { name: '展开经历：第二家公司', exact: true }).click()
  const second = page.locator('.modular-editor [data-resume-item="second-company"]')
  await second.getByRole('textbox', { name: '公司名称', exact: true }).fill('第二家公司已修改')
  await page.getByRole('button', { name: '撤销删除', exact: true }).click()
  await page.clock.runFor(1200)
  const state = await readStoredState(page)
  const storedExperience = state.resumes[0].sections.find((section) => section.type === 'experience')!
  expect(storedExperience.data.items.map((item) => item.id)).toEqual(['company', 'second-company'])
  expect(storedExperience.data.items[0].projects?.[0].id).toBe('project')
  expect(storedExperience.data.items[1].title).toBe('第二家公司已修改')
  await page.reload()
  await page.clock.resume()
  await expect(page.locator('.modular-editor [data-resume-project="project"]')).toBeVisible()
  await page.getByRole('button', { name: '展开经历：第二家公司已修改', exact: true }).click()
  await expect(second.getByRole('textbox', { name: '公司名称', exact: true })).toHaveValue('第二家公司已修改')
})

test('子项目撤销保留父条目新内容，自定义模块改名经过三模式仍同步', async ({ page }) => {
  const resume = resumeFixture()
  resume.sections.push({ id: 'custom', type: 'custom', title: '荣誉', data: { title: '荣誉', content: '- 原始内容' } })
  await page.clock.install()
  await seedStorage(page, storedJson(storedFixture(resume)))
  await openResume(page)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await page.getByRole('button', { name: '子项目：检索系统更多操作', exact: true }).click()
  await page.getByRole('menuitem', { name: '删除子项目：检索系统', exact: true }).click()
  const company = page.locator('.modular-editor [data-resume-item="company"]')
  await company.getByRole('textbox', { name: '职位', exact: true }).fill('更新后的技术负责人')
  await page.getByRole('button', { name: '撤销删除', exact: true }).click()
  const custom = page.locator('.modular-editor [data-resume-section="custom"]')
  await custom.getByRole('textbox', { name: '模块标题', exact: true }).fill('证书与荣誉')
  await switchMode(page, 'Markdown')
  await expect(page.getByRole('textbox', { name: 'Markdown 简历源码' })).toHaveValue(/## 证书与荣誉/)
  await switchMode(page, '文档编辑')
  await expect(page.getByRole('textbox', { name: '富文本简历编辑器' }).locator('h2')).toContainText(['工作经历', '技能', '证书与荣誉'])
  await switchMode(page, '模块编辑')
  await expect(company.getByRole('textbox', { name: '职位', exact: true })).toHaveValue('更新后的技术负责人')
  await expect(page.locator('.modular-editor [data-resume-project="project"]')).toBeVisible()
  await page.clock.runFor(1200)
  expect((await readStoredState(page)).resumes[0].sections.find((section) => section.id === 'custom')).toMatchObject({
    id: 'custom', type: 'custom', title: '证书与荣誉', data: { title: '证书与荣誉', content: '- 原始内容' },
  })
})

test('表单初始折叠与键盘连续录入体验：已填网址默认展开、子项目折叠显示计数、Tab/Enter 顺畅跳转与新建空白骨架', async ({ page }) => {
  const resume = resumeFixture()
  const basics = resume.sections.find((section) => section.type === 'basics')!
  basics.data.contact.website = 'https://example.com'
  await seedStorage(page, storedJson(storedFixture(resume)))
  await openResume(page)

  // 已填网站时默认展开可选联系方式
  await expect(page.getByRole('textbox', { name: '个人网站', exact: true })).toBeVisible()

  // 子项目默认折叠；收起父条目时在摘要中显示子项目计数
  const project = page.locator('.modular-editor [data-resume-project="project"]')
  await expect(project).toHaveAttribute('data-collapsed', 'true')
  await expect(project.getByRole('textbox', { name: '子项目名称', exact: true })).toBeHidden()
  await page.getByRole('button', { name: '收起经历：平台公司', exact: true }).click()
  await expect(page.locator('.modular-editor [data-resume-item="company"] .module-item-projects')).toHaveText('1 个子项目')
  await page.getByRole('button', { name: '展开经历：平台公司', exact: true }).click()

  // 模块标题按 Enter 跳入首个字段；Tab 跳过富文本工具栏直达正文；Ctrl+Enter 跳出多行框
  const expPanel = page.locator('.modular-editor [data-resume-section="experience"]')
  const expTitle = expPanel.getByRole('textbox', { name: '模块标题', exact: true })
  await expTitle.focus()
  await page.keyboard.press('Enter')
  await expect(expPanel.getByRole('textbox', { name: '公司名称', exact: true })).toBeFocused()

  const rightText = expPanel.getByRole('textbox', { name: '时间 / 补充信息', exact: true })
  await rightText.focus()
  await page.keyboard.press('Tab')
  await expect(expPanel.getByRole('textbox', { name: '工作描述', exact: true })).toBeFocused()
  await page.keyboard.press('Control+Shift+Enter')
  await expect(rightText).toBeFocused()

  // 新建简历不含字面量占位值，自带标准骨架，且空网站折叠收起
  await page.getByRole('button', { name: /^当前简历：/ }).click()
  await page.getByRole('button', { name: '新建简历', exact: true }).click()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: '姓名', exact: true })).toHaveValue('')
  await expect(page.getByRole('textbox', { name: '求职职位', exact: true })).toHaveValue('')
  await expect(page.getByRole('textbox', { name: '个人网站', exact: true })).toBeHidden()
  await expect(page.locator('.modular-editor .module-detail')).toHaveCount(4)
})

test('P1/P2 表单高效操作：置顶添加、复制、手柄排序、连续删除撤销、表单级撤销重做、链接编辑、双栏切换与页数提示', async ({ page }) => {
  const resume = resumeFixture()
  resume.template = 'modern'
  const experience = resume.sections.find((section) => section.type === 'experience')!
  experience.data.items.push({ id: 'second-company', title: '第二家公司', subtitle: '工程师', rightText: '2021.01 - 2022.12', description: '其他经历' })
  await seedStorage(page, storedJson(storedFixture(resume)))
  await openResume(page)

  // 编辑区底栏同步展示当前页数
  await expect(page.locator('.editor-page-indicator')).toContainText(/共 \d+ 页/)

  // 联系方式温和格式提醒（非阻塞）
  const email = page.getByRole('textbox', { name: '邮箱', exact: true })
  await email.fill('not-an-email')
  await email.blur()
  await expect(page.locator('.module-field-notice')).toContainText('邮箱格式似乎不完整')
  await email.fill('valid@example.com')
  await expect(page.locator('.module-field-notice')).toHaveCount(0)

  // 顶部快捷添加最新经历 + 快捷设为“至今”
  const expPanel = page.locator('.modular-editor [data-resume-section="experience"]')
  await expPanel.getByRole('button', { name: '在顶部添加最新经历', exact: true }).click()
  const topItem = expPanel.locator('.module-item:not(.module-subproject)').first()
  await topItem.getByRole('textbox', { name: '公司名称', exact: true }).fill('最新公司')
  await topItem.getByRole('textbox', { name: '时间 / 补充信息', exact: true }).fill('2025.01')
  await topItem.getByRole('button', { name: '+ 至今', exact: true }).click()
  await expect(topItem.getByRole('textbox', { name: '时间 / 补充信息', exact: true })).toHaveValue('2025.01 — 至今')

  // 链接编辑器：未选中文字时直接填写显示文字 + 无协议 URL（自动补 https://），并支持移除链接
  const descField = topItem.locator('.module-markdown-field[data-resume-field="description"]')
  await descField.getByRole('button', { name: '链接', exact: true }).click()
  await descField.getByRole('textbox', { name: '显示文字', exact: true }).fill('项目主页')
  await descField.getByRole('textbox', { name: '链接地址', exact: true }).fill('example.com/demo')
  await descField.getByRole('button', { name: '应用', exact: true }).click()
  const insertedLink = descField.locator('.module-field-prose a')
  await expect(insertedLink).toHaveText('项目主页')
  await expect(insertedLink).toHaveAttribute('href', 'https://example.com/demo')
  await insertedLink.click()
  await descField.getByRole('button', { name: '链接', exact: true }).click()
  await descField.getByRole('button', { name: '移除链接', exact: true }).click()
  await expect(descField.locator('.module-field-prose a')).toHaveCount(0)

  // 复制条目 & 手柄键盘排序
  await page.getByRole('button', { name: '经历：最新公司更多操作', exact: true }).click()
  await page.getByRole('menuitem', { name: '复制经历：最新公司', exact: true }).click()
  await expect(expPanel.locator('.module-item:not(.module-subproject)')).toHaveCount(4)
  const firstDrag = expPanel.locator('.module-item:not(.module-subproject)').first().locator('.module-item-drag-handle')
  await firstDrag.focus()
  await page.keyboard.press('ArrowDown')
  await expect(expPanel.locator('.module-item:not(.module-subproject)').nth(1).locator('.module-item-name')).toHaveText('最新公司')

  // 表单级统一撤销与重做
  const undoButton = page.locator('.module-history-controls').getByRole('button', { name: '撤销', exact: true })
  const redoButton = page.locator('.module-history-controls').getByRole('button', { name: '重做', exact: true })
  await expect(undoButton).toBeEnabled()
  await undoButton.click()
  await expect(redoButton).toBeEnabled()
  await redoButton.click()

  // 连续删除两条经历后可分两次全部撤销
  await page.getByRole('button', { name: '经历：平台公司更多操作', exact: true }).click()
  await page.getByRole('menuitem', { name: '删除经历：平台公司', exact: true }).click()
  await page.getByRole('button', { name: '经历：第二家公司更多操作', exact: true }).click()
  await page.getByRole('menuitem', { name: '删除经历：第二家公司', exact: true }).click()
  await expect(page.locator('.content-delete-toast')).toContainText('共 2 条可撤销')
  await page.getByRole('button', { name: '撤销删除', exact: true }).click()
  await expect(page.locator('.modular-editor [data-resume-item="second-company"]')).toHaveCount(1)
  await page.getByRole('button', { name: '撤销删除', exact: true }).click()
  await expect(page.locator('.modular-editor [data-resume-item="company"]')).toHaveCount(1)

  // 双栏模板下表单标题栏显示主栏/侧栏标签且可一键切换
  const skillsRegionButton = page.locator('.modular-editor [data-resume-section="skills"] .module-region-badge')
  await expect(skillsRegionButton).toHaveText('侧栏')
  await skillsRegionButton.click()
  await expect(skillsRegionButton).toHaveText('主栏')
})
