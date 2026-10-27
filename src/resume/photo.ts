export const RESUME_PHOTO_ALT = '证件照'
export const MAX_PHOTO_BYTES = 32 * 1024
export const DEFAULT_PHOTO_WIDTH = 84
export const MIN_PHOTO_WIDTH = 56
export const MAX_PHOTO_WIDTH = 140
const MAX_PHOTO_URL_LENGTH = Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 64
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

// 尺寸属于主题排版，旧文档缺省时继续使用原有大小；导入值统一约束在可读范围内。
export function normalizePhotoWidth(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined
  return Math.min(MAX_PHOTO_WIDTH, Math.max(MIN_PHOTO_WIDTH, Math.round(value)))
}

// 只保存有体积上限的本地位图，避免引入外部链接、临时 blob URL 或原始大图。
export function isResumePhoto(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_PHOTO_URL_LENGTH
    && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
}

export async function prepareResumePhoto(file: File): Promise<string> {
  if (!PHOTO_TYPES.has(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片。')
  if (file.size > 10 * 1024 * 1024) throw new Error('图片超过 10 MB，请选择较小的照片。')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('无法读取这张图片，请尝试其他照片。')
  }
  try {
    // 对应 28 × 36 mm 的证件照，保留约 300 dpi 的打印分辨率。
    const width = 336
    const height = 432
    const scale = Math.max(width / bitmap.width, height / bitmap.height)
    const sourceWidth = width / scale
    const sourceHeight = height / scale
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器暂时无法处理图片，请重试。')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, (bitmap.width - sourceWidth) / 2, (bitmap.height - sourceHeight) / 2,
      sourceWidth, sourceHeight, 0, 0, width, height)
    for (const quality of [0.88, 0.75, 0.6, 0.45, 0.3, 0.2]) {
      const result = canvas.toDataURL('image/jpeg', quality)
      if (isResumePhoto(result)) return result
    }
    throw new Error('照片压缩后仍过大，请尝试另一张图片。')
  } finally {
    bitmap.close()
  }
}
