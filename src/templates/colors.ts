type Rgb = readonly [number, number, number]
const WHITE: Rgb = [255, 255, 255]
const BLACK: Rgb = [0, 0, 0]
const FALLBACK: Rgb = [26, 54, 93]
const DARK_PAPER: Rgb = [28, 32, 39]
const DARK_SIDEBAR: Rgb = [23, 36, 56]

function fromHex(value: string): Rgb | null {
  const trimmed = value.trim()
  if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(trimmed)) return null
  const hex = trimmed.slice(1)
  const expanded = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex
  return [parseInt(expanded.slice(0, 2), 16), parseInt(expanded.slice(2, 4), 16), parseInt(expanded.slice(4, 6), 16)]
}

function toHex(color: Rgb): string {
  return `#${color.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function mix(color: Rgb, background: Rgb, amount: number): Rgb {
  const channel = (index: number) => Math.round(color[index] * (1 - amount) + background[index] * amount)
  return [channel(0), channel(1), channel(2)]
}

function luminance(color: Rgb): number {
  const [r, g, b] = color.map((channel) => {
    const value = channel / 255
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
  })
  return r * .2126 + g * .7152 + b * .0722
}

function contrast(a: Rgb, b: Rgb): number {
  const first = luminance(a)
  const second = luminance(b)
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05)
}

export function contrastRatio(foreground: string, background: string): number {
  return contrast(fromHex(foreground) ?? FALLBACK, fromHex(background) ?? WHITE)
}

// 沿同色系向黑 / 白微调，只改变明度；为小字留出高于 4.5:1 的余量。
function readable(color: Rgb, backgrounds: Rgb[]): Rgb {
  const target = contrast(BLACK, backgrounds[0]) > contrast(WHITE, backgrounds[0]) ? BLACK : WHITE
  for (let step = 0; step <= 100; step++) {
    const candidate = mix(color, target, step / 100)
    if (backgrounds.every((background) => contrast(candidate, background) >= 5)) return candidate
  }
  return target
}

// 兼容历史 CSS 颜色写法；浏览器归一化为不透明 sRGB，纯 hex 路径不依赖 DOM。
function parseColor(value: string): Rgb {
  const hex = fromHex(value)
  if (hex) return hex
  if (typeof document === 'undefined' || !CSS.supports('color', value)) return FALLBACK
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d')
  if (!context) return FALLBACK
  context.fillStyle = '#fff'
  context.fillRect(0, 0, 1, 1)
  context.fillStyle = value
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

const paletteCache = new Map<string, ReturnType<typeof createPalette>>()

function createPalette(value: string) {
  const base = parseColor(value)
  const soft = mix(base, WHITE, .93)
  return {
    base: toHex(base),
    text: toHex(readable(base, [WHITE, soft])),
    soft: toHex(soft),
    line: toHex(mix(base, WHITE, .6)),
    band: toHex(readable(base, [WHITE])),
    onBand: '#ffffff',
    onDark: toHex(readable(base, [DARK_PAPER, DARK_SIDEBAR])),
    rgb: base.join(', '),
  }
}

export function accentPalette(color: string) {
  const cached = paletteCache.get(color)
  if (cached) return cached
  const palette = createPalette(color)
  if (paletteCache.size >= 128) paletteCache.clear()
  paletteCache.set(color, palette)
  return palette
}
