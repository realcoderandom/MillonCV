import { test as base, expect, type Page } from '@playwright/test'
import type { Resume } from '@/resume/model'
import type { ResumeSnapshot } from '@/state/useResumeStore'
import { RESUME_STORAGE_VERSION } from '@/state/resumeMigrations'

export const STORAGE_KEY = 'resume-maker:store'

export interface StoredState {
  resumes: Resume[]
  currentId: string | null
  snapshots: Record<string, ResumeSnapshot[]>
  uiTheme?: 'light' | 'dark'
}

export function resumeFixture(name = '当前姓名', id = 'resume-e2e'): Resume {
  return {
    id, name: '回归简历', template: 'classic', updatedAt: Date.now(),
    theme: { primaryColor: '#1a365d', fontSize: 14, margin: 40, lineHeight: 1.6, fontFamily: 'technical-print' },
    sections: [
      { id: 'basics', type: 'basics', title: '基本信息', data: { name, title: '前端工程师', contact: { phone: '', email: 'resume@example.com', location: '台北', website: '', github: '' }, summary: '负责产品开发与工程质量。' } },
      { id: 'experience', type: 'experience', title: '工作经历', data: { items: [{ id: 'company', title: '平台公司', subtitle: '技术负责人', rightText: '2024 - 至今', description: '- 负责架构设计', projects: [{ id: 'project', title: '检索系统', subtitle: '核心开发', description: '- 实现检索与重排' }] }] } },
      { id: 'skills', type: 'skills', title: '技能', data: { content: '- TypeScript\n- React' } },
    ],
  }
}

export function storedFixture(resume = resumeFixture()): StoredState {
  return {
    resumes: [resume], currentId: resume.id,
    snapshots: { [resume.id]: [{ id: 'snapshot-e2e', createdAt: Date.now() - 60_000, resume: resumeFixture('历史姓名', resume.id) }] },
  }
}

export function storedJson(state = storedFixture()): string {
  return JSON.stringify({ version: RESUME_STORAGE_VERSION, state })
}

export async function seedStorage(page: Page, raw = storedJson()) {
  await page.addInitScript(({ key, raw }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, raw)
  }, { key: STORAGE_KEY, raw })
}

export async function readStoredState(page: Page): Promise<StoredState> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, STORAGE_KEY)
}

export async function switchMode(page: Page, mode: '模块编辑' | '文档编辑' | 'Markdown') {
  await page.getByRole('button', { name: /^编辑模式：/ }).click()
  await page.getByRole('menuitemradio', { name: new RegExp(`^${mode}`) }).click()
}

export async function openResume(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('textbox', { name: '姓名', exact: true })).toHaveValue('当前姓名')
}

export const test = base.extend({
  page: async ({ page }, use) => {
    // 字体失败走产品自身的系统字体回退，测试不依赖外部 CDN。
    await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort())
    await use(page)
  },
})

export { expect }
