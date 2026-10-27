interface PendingLayout {
  promise: Promise<void>
  flush?: () => void
}

const pendingLayouts = new WeakMap<HTMLElement, PendingLayout>()

export function trackResumePagination(root: HTMLElement, pending: Promise<void>, flush?: () => void) {
  pendingLayouts.set(root, { promise: pending, flush })
}

export function flushResumePagination(root: HTMLElement | null) {
  if (root) pendingLayouts.get(root)?.flush?.()
}

export async function waitForResumePagination(root: HTMLElement, prepare?: () => Promise<unknown>) {
  // 等待期间又有新输入时，旧结果不能触发打印。
  let pending: PendingLayout | undefined
  do {
    pending = pendingLayouts.get(root)
    pending?.flush?.()
    try {
      await pending?.promise
      await prepare?.()
    } catch (error) {
      if (pending === pendingLayouts.get(root)) throw error
    }
  } while (pending !== pendingLayouts.get(root))
  if (root.dataset.paginationError) throw new Error(root.dataset.paginationError)
}
