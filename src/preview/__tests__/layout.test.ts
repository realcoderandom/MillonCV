import { describe, expect, it } from 'vitest'
import {
  decideOnePageCompression,
  ONE_PAGE_MIN_SCALE,
  pageCountFromRatio,
} from '../layout'

describe('预览页数与智能一页决策', () => {
  it('关闭智能一页时不压缩', () => {
    expect(decideOnePageCompression(1.12, false)).toEqual({ compression: 1, result: 'off' })
  })

  it('一页内显示无需压缩', () => {
    expect(decideOnePageCompression(0.9, true)).toEqual({ compression: 1, result: 'fits' })
  })

  it('略超一页时给出安全压缩比例', () => {
    const result = decideOnePageCompression(1.08, true)
    expect(result.result).toBe('compressed')
    expect(result.compression).toBeLessThan(1)
    expect(result.compression).toBeGreaterThanOrEqual(ONE_PAGE_MIN_SCALE)
  })

  it('内容过多时不强行压缩', () => {
    expect(decideOnePageCompression(1.31, true)).toEqual({ compression: 1, result: 'overflow' })
  })

  it('页数计算容忍整数边界的子像素误差', () => {
    expect(pageCountFromRatio(1.0005)).toBe(1)
    expect(pageCountFromRatio(1.2)).toBe(2)
  })
})
