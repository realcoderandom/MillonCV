import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStateSerializer } from '../stateSerialization'
import { createDebouncedStorage } from '../debouncedStorage'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('延迟序列化', () => {
  it('连续更新只在停顿后编码一次，写入最后的状态', () => {
    vi.useFakeTimers()
    const write = vi.fn()
    vi.stubGlobal('localStorage', { setItem: write })
    const serialize = vi.fn(JSON.stringify)
    const storage = createDebouncedStorage(500, serialize)
    for (let index = 0; index < 20; index += 1) storage.setItem('resume', { value: index })
    expect(serialize).not.toHaveBeenCalled()
    vi.advanceTimersByTime(499)
    expect(write).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(serialize).toHaveBeenCalledExactlyOnceWith({ value: 19 })
    expect(write).toHaveBeenCalledExactlyOnceWith('resume', '{"value":19}')
  })

  it('同步 flush 也编码最新状态，编码失败后可以保留并重试', () => {
    vi.useFakeTimers()
    const write = vi.fn()
    vi.stubGlobal('localStorage', { setItem: write })
    const serialize = vi.fn<(value: { text: string }) => string>()
      .mockImplementationOnce(() => { throw new Error('encode failed') })
      .mockImplementation(JSON.stringify)
    const storage = createDebouncedStorage(500, serialize)
    storage.setItem('resume', { text: '末次输入' })
    storage.flush()
    expect(write).not.toHaveBeenCalled()
    storage.flush()
    expect(write).toHaveBeenCalledExactlyOnceWith('resume', '{"text":"末次输入"}')
    vi.runAllTimers()
    expect(serialize).toHaveBeenCalledTimes(2)
  })

  it('读取保护会取消尚未编码的状态', () => {
    vi.useFakeTimers()
    const write = vi.fn()
    vi.stubGlobal('localStorage', { setItem: write })
    const serialize = vi.fn(JSON.stringify)
    const storage = createDebouncedStorage(500, serialize)
    storage.setItem('resume', { text: '不应覆盖原数据' })
    storage.setReadOnly(true)
    storage.setItem('resume', { text: '新示例' })
    storage.flush()
    vi.runAllTimers()
    expect(serialize).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
  })
})

describe('持久化字段缓存', () => {
  it('偏好更新不再序列化未变的文档与历史，封装格式保持兼容', () => {
    const resumes = [{ id: 'resume', sections: [{ text: '正文'.repeat(1000) }] }]
    const snapshots = { resume: [{ id: 'history', resume: resumes[0] }] }
    const state = { resumes, snapshots, editorRatio: .52, uiTheme: 'light' }
    const serialize = createStateSerializer<typeof state>()
    serialize({ state, version: 10 })
    const stringify = vi.spyOn(JSON, 'stringify')
    const next = { ...state, editorRatio: .6, uiTheme: 'dark' }
    const json = serialize({ state: next, version: 10 })
    expect(stringify.mock.calls.every(([value]) => value === null || typeof value !== 'object')).toBe(true)
    expect(JSON.parse(json)).toEqual({ state: next, version: 10 })
  })

  it('正文与历史分别失效，删除和可选字段也与原生 JSON 一致', () => {
    const serialize = createStateSerializer<object>()
    const resumes = [{ text: '旧正文' }]
    const snapshots = [{ text: '历史版本' }]
    serialize({ state: { resumes, snapshots, optional: '旧字段' }, version: 10 })
    const nextResumes = [{ text: '新正文' }]
    const next = { resumes: nextResumes, snapshots, optional: undefined, ignored: () => {} }
    const stringify = vi.spyOn(JSON, 'stringify')
    expect(JSON.parse(serialize({ state: next, version: 10 }))).toEqual({ state: { resumes: nextResumes, snapshots }, version: 10 })
    expect(stringify).toHaveBeenCalledWith(nextResumes)
    expect(stringify).not.toHaveBeenCalledWith(snapshots)
    const nextSnapshots = [{ text: '新的恢复点' }]
    expect(JSON.parse(serialize({ state: { resumes: nextResumes, snapshots: nextSnapshots } }))).toEqual({ state: { resumes: nextResumes, snapshots: nextSnapshots } })
    expect(stringify).toHaveBeenCalledWith(nextSnapshots)
  })
})
