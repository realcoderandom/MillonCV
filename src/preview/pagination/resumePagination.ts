// 使用静态资源路径，避免开发服务器把 UMD 文件按 ES 模块预构建。
import pagedScriptUrl from '@pagedjs-script?url'
import documentStyles from '../styles/paged-document.css?inline'

export const PAGE_WIDTH = 210 * 96 / 25.4

interface PagedPreviewer {
  preview(content: DocumentFragment, stylesheets: Record<string, string>[], target: HTMLElement): Promise<{ total: number }>
  chunker: { pagesArea?: HTMLElement; removePages(): void; destroy(): void }
  polisher: { styleEl?: HTMLElement; destroy(): void }
}

interface PagedWindow extends Window {
  PagedModule?: { Previewer: new () => PagedPreviewer }
}

interface ResumeStyles { css: string; breaks: string }

/** 模板 CSS 由 Chrome 原生解析，分页器只转换分页声明，保留 :has/:is 等现代选择器。 */
export function collectResumeStyles(document: Document): ResumeStyles {
  const styles: string[] = []
  const breaks: string[] = []
  const collect = (rules: CSSRuleList, printing = false) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        if (!/\.resume(?![-\w])|\.accent-soften\b/.test(rule.selectorText)) continue
        if (printing && /data-resume-highlight|tabindex/.test(rule.selectorText)) continue
        styles.push(rule.cssText)
        const declarations = ['break-before', 'break-after', 'break-inside', 'orphans', 'widows']
          .flatMap((property) => {
            const value = rule.style.getPropertyValue(property)
            return value ? [`${property}: ${value};`] : []
          }).join(' ')
        if (declarations) breaks.push(`${rule.selectorText} { ${declarations} }`)
      } else if ('cssRules' in rule) {
        collect((rule as CSSGroupingRule).cssRules, printing || (rule instanceof CSSMediaRule && rule.conditionText.includes('print')))
      }
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    // 动态打印快照不能再次作为输入，避免每次分页都累积样式。
    if (sheet.ownerNode instanceof Element && sheet.ownerNode.hasAttribute('data-resume-print-styles')) continue
    try { collect(sheet.cssRules) } catch { /* 跨域字体由 FontFaceSet 单独同步。 */ }
  }
  return {
    css: `${styles.join('\n')}\n.resume { width: 210mm; aspect-ratio: auto; min-height: 0 !important; box-shadow: none; }`,
    breaks: `@page { size: A4; margin: 0; }\n${breaks.join('\n')}`,
  }
}

export function createPaginationFrame(): string {
  // 独立文档隔离分页器的全局样式；脚本由 Vite 本地打包，不依赖 CDN。
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><base href="${location.href}"><style data-resume-page-presentation>${documentStyles}</style><script src="${pagedScriptUrl}"></script></head><body class="preview-pane"><span id="resume-preview-edit-help" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">点击内容或按 Enter 定位编辑。</span><div id="pages"></div></body></html>`
}

/** 屏幕与打印复用同一批分页 DOM；打印不再对连续简历重新分页。 */
export class ResumePaginator {
  private previewer: PagedPreviewer | null = null

  constructor(private frame: HTMLIFrameElement) {}

  get document() { return this.frame.contentDocument! }
  get root() { return this.document.getElementById('pages') as HTMLDivElement }

  async paginate(source: HTMLElement, styles: ResumeStyles): Promise<number> {
    this.destroy()
    const frameWindow = this.frame.contentWindow as PagedWindow | null
    if (!frameWindow?.PagedModule) throw new Error('分页组件加载失败，请刷新页面重试。')
    let templateStyles = this.document.querySelector<HTMLStyleElement>('[data-resume-template-styles]')
    if (!templateStyles) {
      templateStyles = this.document.createElement('style')
      templateStyles.dataset.resumeTemplateStyles = ''
      this.document.head.append(templateStyles)
    }
    templateStyles.textContent = styles.css
    // 复用主文档实际用到且已就绪的字体，避免字体回退和加载全部中文字库。
    source.ownerDocument.fonts.forEach((font) => {
      if (font.status === 'loaded') this.document.fonts.add(font)
    })
    const previewer = new frameWindow.PagedModule.Previewer()
    this.previewer = previewer
    const content = this.document.createDocumentFragment()
    content.append(this.document.importNode(source, true))
    const flow = await previewer.preview(content, [{ [location.href]: styles.breaks }], this.root)
    // 展示样式不交给分页器转换，否则 @media print 会被提升到屏幕样式。
    const presentation = this.document.querySelector('[data-resume-page-presentation]')
    if (presentation) this.document.head.append(presentation)
    return Math.max(1, flow.total)
  }

  publish(printRoot: HTMLElement, printStyles: HTMLStyleElement) {
    printRoot.replaceChildren(...Array.from(this.root.childNodes, (node) => node.cloneNode(true)))
    printStyles.textContent = Array.from(this.document.querySelectorAll('style'), (style) => style.textContent).join('\n')
    this.frame.style.height = `${Math.ceil(this.root.getBoundingClientRect().height)}px`
    delete printRoot.dataset.paginationError
  }

  destroy() {
    if (this.previewer?.chunker.pagesArea) {
      this.previewer.chunker.removePages()
      this.previewer.chunker.destroy()
    }
    if (this.previewer?.polisher.styleEl) this.previewer.polisher.destroy()
    this.previewer = null
  }
}
