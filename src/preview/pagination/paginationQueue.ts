export const PAGINATION_DEBOUNCE_MS = 200

interface Task {
  run: () => Promise<void>
  promise: Promise<void>
  resolve: () => void
  reject: (error: unknown) => void
  ready: boolean
}

// 同时最多一个执行中的作业和一个最新待办；输入停顿后再分页，导出可立即推动待办。
export class PaginationQueue {
  private active: Task | null = null
  private pending: Task | null = null
  private timer: ReturnType<typeof setTimeout> | null = null

  schedule(run: () => Promise<void>, delay = PAGINATION_DEBOUNCE_MS) {
    this.clear()
    let resolve!: () => void
    let reject!: (error: unknown) => void
    const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail })
    const task: Task = { run, promise, resolve, reject, ready: false }
    this.pending = task
    const flush = () => {
      if (this.pending !== task) return
      if (this.timer) clearTimeout(this.timer)
      this.timer = null
      task.ready = true
      this.start()
    }
    if (delay === 0) flush()
    else this.timer = setTimeout(flush, delay)
    return { promise, flush, cancel: () => { if (this.pending === task) this.clear() } }
  }

  clear() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.pending?.resolve()
    this.pending = null
  }

  async whenIdle() {
    while (this.active || this.pending) {
      await (this.pending ?? this.active)!.promise.catch(() => {})
    }
  }

  private start() {
    if (this.active || !this.pending?.ready) return
    const task = this.pending
    this.pending = null
    this.active = task
    void Promise.resolve().then(task.run).then(() => {
      this.active = null
      task.resolve()
      this.start()
    }, (error: unknown) => {
      this.active = null
      task.reject(error)
      this.start()
    })
  }
}
