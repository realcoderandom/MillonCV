import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLogger, createServer } from 'vite'
import { test, expect, seedStorage, switchMode } from './fixtures'

test('Vite 开发模式冷启动与缓存重启均可加载分页资源', async ({ page }, testInfo) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'milloncv-vite-e2e-'))
  const serverErrors: string[] = []
  const pageErrors: string[] = []
  const httpErrors: string[] = []
  const logger = createLogger('silent')
  const logError = logger.error
  logger.error = (message, options) => {
    serverErrors.push(message)
    logError(message, options)
  }
  page.on('pageerror', (error) => {
    if (page.url().startsWith('http://127.0.0.1:')) pageErrors.push(error.message)
  })
  page.on('response', (response) => {
    if (response.url().startsWith('http://127.0.0.1:') && response.status() >= 400) {
      httpErrors.push(`${response.status()} ${response.url()}`)
    }
  })
  await seedStorage(page)
  let expectedName = '当前姓名'

  try {
    // 使用项目的真实配置与独立缓存，覆盖浏览器触发的依赖预构建，不影响本地开发会话。
    for (const phase of ['冷启动', '缓存重启']) {
      const server = await createServer({
        cacheDir,
        customLogger: logger,
        server: { host: '127.0.0.1', port: 4174 + testInfo.parallelIndex, strictPort: true, open: false },
      })
      try {
        await server.listen()
        await page.goto(server.resolvedUrls!.local[0])
        await switchMode(page, '模块编辑')
        await expect(page.getByRole('textbox', { name: '姓名', exact: true })).toHaveValue(expectedName)
        await expect(page.locator('#resume-print-root')).toContainText(expectedName)
        const frame = page.frameLocator('iframe[title="简历分页预览"]')
        await expect(frame.locator('.pagedjs_page')).toHaveCount(1)
        const script = await frame.locator('script[src]').getAttribute('src')
        expect(script).toContain('paged.min.js')
        expect(script).not.toContain('/.vite/')

        expectedName = `开发模式${phase}`
        await page.getByRole('textbox', { name: '姓名', exact: true }).fill(expectedName)
        await expect(page.locator('#resume-print-root')).toContainText(expectedName)
        await switchMode(page, '文档编辑')
        await expect(page.locator('.tiptap')).toContainText(expectedName)
        await page.reload()
        await expect(page.locator('#resume-print-root')).toContainText(expectedName)
        expect(serverErrors).toEqual([])
        expect(pageErrors).toEqual([])
        expect(httpErrors).toEqual([])
      } finally {
        // 先断开旧页面的 HMR，避免重启时自动重连发起刷新，打断下一次导航。
        try {
          await page.goto('about:blank')
        } finally {
          await server.close()
        }
      }
    }
  } finally {
    try {
      await testInfo.attach('development-errors.json', {
        body: JSON.stringify({ serverErrors, pageErrors, httpErrors }, null, 2),
        contentType: 'application/json',
      })
    } finally {
      await rm(cacheDir, { recursive: true, force: true })
    }
  }
})
