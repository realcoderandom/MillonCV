// PDF 导出：等待预览分页完成，再由 Chrome 打印同一份分页快照为矢量 PDF。
// 交互：调用 window.print()，用户在打印对话框选择「另存为 PDF」
// filename 仅作备用标题（部分浏览器在打印对话框可用），实际文件名由用户在保存时指定

import { waitForResumePagination } from './pagination/paginationReady'

export async function exportResumeToPdf(el: HTMLElement, filename: string): Promise<void> {
  // 照片使用固定尺寸；打印前仍需等解码完成，避免首次上传后立即打印出现空白。
  await waitForResumePagination(el, () =>
    Promise.all(Array.from(el.querySelectorAll('img')).map((image) => image.decode().catch(() => {}))))
  // 备用：尝试以简历名作为打印文档标题（非所有浏览器支持，不影响功能）
  const prevTitle = document.title
  if (filename) {
    try {
      document.title = filename.replace(/\.pdf$/i, '')
    } catch {
      /* 忽略 */
    }
  }

  try {
    // 触发浏览器打印对话框：用户在此选「另存为 PDF」即得矢量 PDF
    // 打印样式隐藏应用界面，仅输出 #resume-print-root 中已经分好的纸张。
    window.print()
  } finally {
    document.title = prevTitle
  }
}
