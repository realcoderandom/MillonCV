import { describe, expect, it, vi } from 'vitest'
import { createDebouncedStorage } from '../../storage/debouncedStorage'
import { flushDraftAndStorage } from '../draftFlushProtocol'

describe('编辑器草稿持久化', () => {
  it('页面离开时先提交草稿，再持久化最新 store', () => {
    const calls: string[] = []

    flushDraftAndStorage(
      () => calls.push('draft'),
      () => calls.push('storage'),
    )

    expect(calls).toEqual(['draft', 'storage'])
  })

  it('同步 flush 会立即写入尚在防抖队列中的数据', () => {
    vi.useFakeTimers()
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    })

    const storage = createDebouncedStorage(500)
    storage.setItem('resume', 'latest draft')
    expect(data.get('resume')).toBeUndefined()

    storage.flush()
    expect(data.get('resume')).toBe('latest draft')

    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('写入失败时保留待保存数据，后续可重试', () => {
    vi.useFakeTimers()
    let shouldFail = true
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (shouldFail) throw new Error('quota exceeded')
        data.set(key, value)
      },
      removeItem: (key: string) => data.delete(key),
    })

    const storage = createDebouncedStorage(500)
    storage.setItem('resume', 'recoverable')
    storage.flush()
    expect(data.get('resume')).toBeUndefined()

    shouldFail = false
    storage.flush()
    expect(data.get('resume')).toBe('recoverable')

    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('读取失败会向上传递错误，并阻止排队、新写入和删除覆盖原数据', () => {
    vi.useFakeTimers()
    const write = vi.fn()
    const remove = vi.fn()
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('read denied') },
      setItem: write,
      removeItem: remove,
    })
    try {
      const storage = createDebouncedStorage()
      storage.setItem('resume', 'queued before read')
      expect(() => storage.getItem('resume')).toThrow('read denied')
      storage.setItem('resume', 'new sample')
      storage.removeItem('resume')
      storage.flush()
      vi.runAllTimers()
      expect(write).not.toHaveBeenCalled()
      expect(remove).not.toHaveBeenCalled()
      storage.setReadOnly(false)
      storage.setItem('resume', 'recovered')
      storage.flush()
      expect(write).toHaveBeenCalledWith('resume', 'recovered')
    } finally {
      vi.unstubAllGlobals()
      vi.useRealTimers()
    }
  })
})
