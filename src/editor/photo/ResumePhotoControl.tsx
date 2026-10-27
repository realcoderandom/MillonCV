import { useEffect, useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ImagePlus, Trash2 } from 'lucide-react'
import type { Resume } from '@/resume/model'
import { useResumeStore } from '@/state/useResumeStore'
import { flushActiveEditorDraft } from '@/state/editing/editorDraft'
import { DEFAULT_PHOTO_WIDTH, MIN_PHOTO_WIDTH, MAX_PHOTO_WIDTH, isResumePhoto, normalizePhotoWidth, prepareResumePhoto } from '@/resume/photo'
import { resolveResumeTheme } from '@/templates/theme'
import { Button } from '@/shared/ui/Button'
import { Popover } from '@/shared/ui/Popover'

export function ResumePhotoControl({ resume, variant = 'toolbar' }: { resume: Resume; variant?: 'toolbar' | 'portrait' }) {
  const inputId = useId()
  const sizeId = useId()
  const setPhoto = useResumeStore((state) => state.setPhoto)
  const setTheme = useResumeStore((state) => state.setTheme)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requestRef = useRef(0)
  const basics = resume.sections.find((section) => section.type === 'basics')
  const photo = basics?.type === 'basics' && isResumePhoto(basics.data.photo) ? basics.data.photo : undefined
  const theme = resolveResumeTheme(resume)
  const photoWidth = normalizePhotoWidth(theme.photoWidth) ?? DEFAULT_PHOTO_WIDTH
  const photoHeight = Math.round(photoWidth * 9 / 7)

  useEffect(() => {
    setBusy(false)
    setError('')
    return () => { requestRef.current += 1 }
  }, [resume.id])

  const applyPhoto = (value: string | undefined) => {
    // 先完成草稿的 React 提交，让 skipSync 标记不会吞掉紧随其后的照片同步。
    flushSync(flushActiveEditorDraft)
    setPhoto(resume.id, value)
  }

  const upload = async (file: File) => {
    const request = ++requestRef.current
    setBusy(true)
    setError('')
    try {
      const value = await prepareResumePhoto(file)
      if (requestRef.current === request) applyPhoto(value)
    } catch (cause) {
      if (requestRef.current === request) setError(cause instanceof Error ? cause.message : '照片处理失败，请重试。')
    } finally {
      if (requestRef.current === request) setBusy(false)
    }
  }

  return (
    <Popover
      ariaLabel="证件照设置"
      trigger={variant === 'portrait'
        ? <button type="button" className={`module-portrait-button${photo ? ' has-photo' : ''}`} aria-label={photo ? '更换证件照' : '添加证件照'} title="上传、更换或移除证件照">{photo ? <img src={photo} alt="当前证件照" /> : <><ImagePlus size={20} /><span>添加照片</span><small>选填</small></>}<span className="module-portrait-edit">{photo ? '更换照片' : '上传照片'}</span></button>
        : <Button type="button" size="sm" className="preview-tool-button" aria-label="照片" title="上传、更换或移除证件照"><ImagePlus size={13} /><span className="preview-toolbar-label">照片</span></Button>}
    >
      <div className="photo-settings">
        {photo ? <img className="photo-settings-preview" src={photo} alt="当前证件照" /> : <div className="photo-settings-empty">尚未添加照片</div>}
        <p>照片会自动裁切为证件照比例，并随简历保存。</p>
        {photo && (
          <div className="layout-width-setting photo-size-setting">
            <label htmlFor={sizeId}>照片大小</label>
            <output htmlFor={sizeId}>{photoWidth} × {photoHeight} px</output>
            <input
              id={sizeId}
              type="range"
              aria-label="照片大小"
              aria-valuetext={`${photoWidth} × ${photoHeight} 像素，等比缩放`}
              min={MIN_PHOTO_WIDTH}
              max={MAX_PHOTO_WIDTH}
              step={1}
              value={photoWidth}
              disabled={busy}
              onChange={(event) => setTheme(resume.id, { photoWidth: Number(event.target.value) })}
            />
            <div className="photo-size-footer">
              <span>等比缩放，高度自动调整</span>
              <Button type="button" size="sm" disabled={busy || theme.photoWidth === undefined} aria-label="恢复默认照片大小" onClick={() => setTheme(resume.id, { photoWidth: undefined })}>恢复默认</Button>
            </div>
          </div>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="上传证件照"
          className="sr-only"
          disabled={busy || !basics}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void upload(file)
          }}
        />
        <div className="photo-settings-actions">
          <label htmlFor={inputId} className={`photo-upload-button ${busy || !basics ? 'is-disabled' : ''}`} aria-disabled={busy || !basics}>
            {busy ? '正在处理…' : photo ? '更换照片' : '上传照片'}
          </label>
          {photo && <Button type="button" size="sm" disabled={busy} onClick={() => { setError(''); applyPhoto(undefined) }}><Trash2 size={13} />移除照片</Button>}
        </div>
        {!basics && <p>请先在编辑器中添加姓名。</p>}
        {error && <p role="alert" className="photo-settings-error">{error}</p>}
      </div>
    </Popover>
  )
}
