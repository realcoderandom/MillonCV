/** 页面离开时必须先提交编辑器草稿，再同步持久化最新状态。 */
export function flushDraftAndStorage(
  flushDraft: () => void,
  flushStorage: () => void,
) {
  flushDraft()
  flushStorage()
}
