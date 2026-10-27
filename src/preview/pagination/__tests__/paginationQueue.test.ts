import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PaginationQueue } from '../paginationQueue'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('分页作业合并', () => {
  it('连续输入只执行停顿后的最后一版', async () => {
    const queue = new PaginationQueue()
    const run = vi.fn<(version: number) => Promise<void>>().mockResolvedValue()
    for (let version = 0; version < 10; version += 1) {
      queue.schedule(() => run(version))
      await vi.advanceTimersByTimeAsync(120)
    }
    expect(run).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    await queue.whenIdle()
    expect(run).toHaveBeenCalledExactlyOnceWith(9)
  })

  it('执行中的分页不会并发，等待期间仅保留最新待办', async () => {
    const queue = new PaginationQueue()
    const first = deferred()
    const calls: number[] = []
    queue.schedule(async () => { calls.push(1); await first.promise }, 0)
    await Promise.resolve()
    queue.schedule(async () => { calls.push(2) })
    await vi.advanceTimersByTimeAsync(200)
    const latest = queue.schedule(async () => { calls.push(3) })
    await vi.advanceTimersByTimeAsync(200)
    expect(calls).toEqual([1])
    first.resolve()
    await latest.promise
    expect(calls).toEqual([1, 3])
  })

  it('导出立即执行最新待办，定时器不会再次重复执行', async () => {
    const queue = new PaginationQueue()
    const run = vi.fn<() => Promise<void>>().mockResolvedValue()
    const task = queue.schedule(run)
    task.flush()
    await task.promise
    await vi.runAllTimersAsync()
    expect(run).toHaveBeenCalledOnce()
  })

  it('取消待办会结束等待，但不会执行分页', async () => {
    const queue = new PaginationQueue()
    const run = vi.fn<() => Promise<void>>().mockResolvedValue()
    const task = queue.schedule(run)
    task.cancel()
    await task.promise
    await vi.runAllTimersAsync()
    expect(run).not.toHaveBeenCalled()
  })

  it('清理时仍等待执行中的作业完成，再销毁分页器', async () => {
    const queue = new PaginationQueue()
    const first = deferred()
    queue.schedule(() => first.promise, 0)
    await Promise.resolve()
    const run = vi.fn<() => Promise<void>>().mockResolvedValue()
    queue.schedule(run)
    queue.clear()
    const destroy = vi.fn()
    const cleanup = queue.whenIdle().then(destroy)
    await Promise.resolve()
    expect(destroy).not.toHaveBeenCalled()
    first.resolve()
    await cleanup
    expect(destroy).toHaveBeenCalledOnce()
    expect(run).not.toHaveBeenCalled()
  })

  it('失败不会阻止后续文档分页', async () => {
    const queue = new PaginationQueue()
    const failed = queue.schedule(async () => { throw new Error('failed') }, 0)
    await expect(failed.promise).rejects.toThrow('failed')
    const run = vi.fn<() => Promise<void>>().mockResolvedValue()
    const latest = queue.schedule(run, 0)
    await latest.promise
    expect(run).toHaveBeenCalledOnce()
  })
})
