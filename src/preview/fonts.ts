// 文档字体按需加载：避免首屏拉取全部中英文字体。
// 系统字体无需网络；Web 字体只在用户实际选择后注入对应 stylesheet。
const FONT_STYLESHEETS: Record<string, string[]> = {
  sans: [
    'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc/chinese-simplified-400.css',
    'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc/chinese-simplified-700.css',
  ],
  serif: [
    'https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc/chinese-simplified-400.css',
    'https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc/chinese-simplified-700.css',
  ],
  wenkai: [
    'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont/lxgwwenkai-regular.css',
    'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont/lxgwwenkai-bold.css',
  ],
  puhuiti: ['https://cdn.jsdelivr.net/npm/c1-alibaba-puhui-ti/index.css'],
  inter: [
    'https://cdn.jsdelivr.net/npm/@fontsource/inter/latin-400.css',
    'https://cdn.jsdelivr.net/npm/@fontsource/inter/latin-600.css',
    'https://cdn.jsdelivr.net/npm/@fontsource/inter/latin-700.css',
  ],
  'source-sans': [
    'https://cdn.jsdelivr.net/npm/@fontsource/source-sans-3/latin-400.css',
    'https://cdn.jsdelivr.net/npm/@fontsource/source-sans-3/latin-600.css',
    'https://cdn.jsdelivr.net/npm/@fontsource/source-sans-3/latin-700.css',
  ],
  lora: [
    'https://cdn.jsdelivr.net/npm/@fontsource/lora/latin-400.css',
    'https://cdn.jsdelivr.net/npm/@fontsource/lora/latin-600.css',
    'https://cdn.jsdelivr.net/npm/@fontsource/lora/latin-700.css',
  ],
  'eb-garamond': [
    'https://cdn.jsdelivr.net/npm/@fontsource/eb-garamond/latin-400.css',
    'https://cdn.jsdelivr.net/npm/@fontsource/eb-garamond/latin-600.css',
  ],
}

const pendingStylesheets = new Map<string, Promise<boolean>>()

function waitForStylesheet(link: HTMLLinkElement): Promise<boolean> {
  if (link.dataset.documentFontReady === 'true' || link.sheet) return Promise.resolve(true)
  if (link.dataset.documentFontReady === 'false') return Promise.resolve(false)

  return new Promise((resolve) => {
    let settled = false
    const finish = (ready: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      link.dataset.documentFontReady = String(ready)
      resolve(ready)
    }
    link.addEventListener('load', () => finish(true), { once: true })
    link.addEventListener('error', () => finish(false), { once: true })
    // CDN 异常时不能让打印入口永久停留在“检查中”。
    const timeout = window.setTimeout(() => finish(false), 5000)
  })
}

function ensureStylesheet(url: string): Promise<boolean> {
  const pending = pendingStylesheets.get(url)
  if (pending) return pending

  let link = document.querySelector<HTMLLinkElement>(`link[data-document-font="${url}"]`)
  if (!link) {
    link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.dataset.documentFont = url
  }

  const promise = waitForStylesheet(link)
  pendingStylesheets.set(url, promise)
  if (!link.isConnected) document.head.appendChild(link)
  void promise.finally(() => {
    if (pendingStylesheets.get(url) === promise) pendingStylesheets.delete(url)
  })
  return promise
}

export async function loadDocumentFont(fontId = 'sans'): Promise<{ ready: boolean }> {
  const urls = FONT_STYLESHEETS[fontId] ?? []
  const stylesheetResults = await Promise.all(urls.map(ensureStylesheet))
  await (document.fonts?.ready ?? Promise.resolve())
  return { ready: stylesheetResults.every(Boolean) }
}
