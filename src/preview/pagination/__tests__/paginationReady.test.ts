import { describe, expect, it, vi } from 'vitest'
import { trackResumePagination, waitForResumePagination } from '../paginationReady'

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

describe('打印等待真实分页', () => {
  it('等待期间发生新编辑时，必须等待最新的一次分页', async () => {
    const root = { dataset: {} } as HTMLElement
    const first = deferred()
    const latest = deferred()
    trackResumePagination(root, first.promise)
    let ready = false
    const waiting = waitForResumePagination(root).then(() => { ready = true })
    trackResumePagination(root, latest.promise)
    first.resolve()
    await Promise.resolve()
    expect(ready).toBe(false)
    latest.resolve()
    await waiting
    expect(ready).toBe(true)
  })

  it('不会打印失败任务遗留的旧快照', async () => {
    const root = { dataset: {} } as HTMLElement
    const layout = deferred()
    trackResumePagination(root, layout.promise)
    const waiting = waitForResumePagination(root)
    layout.reject(new Error('分页失败'))
    await expect(waiting).rejects.toThrow('分页失败')
  })

  it('过期任务失败后仍可等待最新的有效分页', async () => {
    const root = { dataset: {} } as HTMLElement
    const first = deferred()
    trackResumePagination(root, first.promise)
    const waiting = waitForResumePagination(root)
    trackResumePagination(root, Promise.resolve())
    first.reject(new Error('已过期'))
    await expect(waiting).resolves.toBeUndefined()
  })

  it('导出等待时立即推动尚未执行的分页', async () => {
    const root = { dataset: {} } as HTMLElement
    const pending = deferred()
    const flush = vi.fn(pending.resolve)
    trackResumePagination(root, pending.promise, flush)
    await waitForResumePagination(root)
    expect(flush).toHaveBeenCalledOnce()
  })

  it('图片准备期间发生新编辑，也必须重等并准备最新分页', async () => {
    const root = { dataset: {} } as HTMLElement
    const latest = deferred()
    trackResumePagination(root, Promise.resolve())
    const prepare = vi.fn<() => Promise<void>>().mockImplementationOnce(async () => {
      trackResumePagination(root, latest.promise)
    }).mockResolvedValue()
    let ready = false
    const waiting = waitForResumePagination(root, prepare).then(() => { ready = true })
    await Promise.resolve()
    await Promise.resolve()
    expect(ready).toBe(false)
    latest.resolve()
    await waiting
    expect(prepare).toHaveBeenCalledTimes(2)
  })
})
