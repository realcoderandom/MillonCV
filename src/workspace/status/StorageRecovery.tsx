import { AlertTriangle, Download, RefreshCw } from 'lucide-react'
import { retryResumeHydration } from '@/state/useResumeStore'
import type { ResumeHydrationState } from '@/state/storage/resumeHydration'
import { Button } from '@/shared/ui/Button'

export function StorageRecovery({ state }: { state: ResumeHydrationState }) {
  const download = () => {
    if (state.raw === null) return
    const url = URL.createObjectURL(new Blob([state.raw], { type: 'application/json;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'milloncv-recovery.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return <main className="empty-workspace min-h-screen px-6" aria-busy={state.status === 'loading'}>
    {state.status === 'loading' ? <p role="status">正在读取本地简历…</p> : <div className="max-w-lg space-y-4" role="alert">
      <AlertTriangle size={32} className="text-[var(--danger)]" />
      <h1>无法读取本地简历</h1>
      <p>{state.raw === null
        ? '已暂停自动保存，避免覆盖本地数据。请检查浏览器存储权限后重试读取。'
        : '已暂停自动保存，避免覆盖本地数据。请先下载原始备份，再重试读取。'}</p>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" disabled={state.raw === null} onClick={download}><Download size={15} />下载原始备份</Button>
        <Button onClick={retryResumeHydration}><RefreshCw size={15} />重试读取</Button>
      </div>
      <details className="text-sm"><summary>错误详情</summary><p className="mt-2 break-words">{state.error}</p></details>
    </div>}
  </main>
}
