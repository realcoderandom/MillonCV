import { useEffect, useId, useRef, useState, type DragEvent } from 'react'
import { flushSync } from 'react-dom'
import { ImagePlus, RotateCcw, Trash2 } from 'lucide-react'
import type { Resume } from '@/resume/model'
import { useResumeStore } from '@/state/useResumeStore'
import { flushActiveEditorDraft } from '@/state/editing/editorDraft'
import { DEFAULT_PHOTO_WIDTH, MIN_PHOTO_WIDTH, MAX_PHOTO_WIDTH, isResumePhoto, normalizePhotoWidth, prepareResumePhoto, type PhotoCropOptions } from '@/resume/photo'
import { resolveResumeTheme } from '@/templates/theme'
import { Button } from '@/shared/ui/Button'
import { Popover } from '@/shared/ui/Popover'

const DEFAULT_CROP: Required<PhotoCropOptions> = { zoom: 1, offsetX: 0, offsetY: 0 }

export function ResumePhotoControl({ resume, variant = 'toolbar' }: { resume: Resume; variant?: 'toolbar' | 'portrait' }) {
  const inputId = useId()
  const sizeId = useId()
  const zoomId = useId()
  const offsetXId = useId()
  const offsetYId = useId()
  const setPhoto = useResumeStore((state) => state.setPhoto)
  const setTheme = useResumeStore((state) => state.setTheme)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draggingFile, setDraggingFile] = useState(false)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [crop, setCrop] = useState<Required<PhotoCropOptions>>(DEFAULT_CROP)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef(0)
  const basics = resume.sections.find((section) => section.type === 'basics')
  const photo = basics?.type === 'basics' && isResumePhoto(basics.data.photo) ? basics.data.photo : undefined
  const theme = resolveResumeTheme(resume)
  const photoWidth = normalizePhotoWidth(theme.photoWidth) ?? DEFAULT_PHOTO_WIDTH
  const photoHeight = Math.round(photoWidth * 9 / 7)

  useEffect(() => {
    setBusy(false)
    setError('')
    setDraggingFile(false)
    setSourceFile(null)
    setCrop(DEFAULT_CROP)
    return () => { requestRef.current += 1 }
  }, [resume.id])

  const applyPhoto = (value: string | undefined) => {
    // 先完成草稿的 React 提交，让 skipSync 标记不会吞掉紧随其后的照片同步。
    flushSync(flushActiveEditorDraft)
    setPhoto(resume.id, value)
  }

  const processFile = async (file: File, nextCrop: Required<PhotoCropOptions>, rememberSource = true) => {
    const request = ++requestRef.current
    setBusy(true)
    setError('')
    try {
      const value = await prepareResumePhoto(file, nextCrop)
      if (requestRef.current === request) {
        if (rememberSource) {
          setSourceFile(file)
          setCrop(nextCrop)
        }
        applyPhoto(value)
      }
    } catch (cause) {
      if (requestRef.current === request) setError(cause instanceof Error ? cause.message : '照片处理失败，请重试。')
    } finally {
      if (requestRef.current === request) setBusy(false)
    }
  }

  const updateCrop = (patch: Partial<Required<PhotoCropOptions>>) => {
    const next = { ...crop, ...patch }
    setCrop(next)
    if (sourceFile) void processFile(sourceFile, next, false)
  }

  const handleDragOver = (event: DragEvent) => {
    if (busy || !basics || !event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    if (!draggingFile) setDraggingFile(true)
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setDraggingFile(false)
    if (busy || !basics) return
    const file = event.dataTransfer.files?.[0]
    if (file) void processFile(file, DEFAULT_CROP, true)
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      id={inputId}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      aria-label="上传证件照"
      className="sr-only"
      disabled={busy || !basics}
      onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) void processFile(file, DEFAULT_CROP, true)
      }}
    />
  )

  const cropModified = crop.zoom !== 1 || crop.offsetX !== 0 || crop.offsetY !== 0

  // 表单区无照片时点击头像框直接一步打开文件选择，并支持直接拖入图片；有照片后弹出完整设置。
  if (variant === 'portrait' && !photo) {
    return (
      <div className="module-portrait-dropzone" data-dragging={draggingFile} onDragOver={handleDragOver} onDragLeave={() => setDraggingFile(false)} onDrop={handleDrop}>
        {fileInput}
        <button
          type="button"
          className="module-portrait-button"
          aria-label="添加证件照"
          title="点击或拖入图片上传证件照"
          disabled={busy || !basics}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus size={20} />
          <span>{busy ? '处理中…' : draggingFile ? '松开上传' : '添加照片'}</span>
          <small>点击或拖入</small>
          <span className="module-portrait-edit">上传照片</span>
        </button>
        {error && <p role="alert" className="module-portrait-error">{error}</p>}
      </div>
    )
  }

  return (
    <Popover
      ariaLabel="证件照设置"
      trigger={variant === 'portrait'
        ? <button type="button" className={`module-portrait-button has-photo${draggingFile ? ' is-dragging' : ''}`} aria-label="更换证件照" title="点击调整照片，或直接拖入新照片替换" onDragOver={handleDragOver} onDragLeave={() => setDraggingFile(false)} onDrop={handleDrop}><img src={photo} alt="当前证件照" /><span className="module-portrait-edit">{draggingFile ? '松开替换' : '更换照片'}</span></button>
        : <Button type="button" size="sm" className="preview-tool-button" aria-label="照片" title="上传、更换或移除证件照"><ImagePlus size={13} /><span className="preview-toolbar-label">照片</span></Button>}
    >
      <div className="photo-settings" data-dragging={draggingFile} onDragOver={handleDragOver} onDragLeave={() => setDraggingFile(false)} onDrop={handleDrop}>
        {photo ? <img className="photo-settings-preview" src={photo} alt="当前证件照" /> : <div className="photo-settings-empty">{draggingFile ? '松开上传' : '尚未添加照片'}</div>}
        <p>照片会自动裁切为证件照比例，并随简历保存；可直接拖入图片替换。</p>
        {photo && sourceFile && (
          <div className="photo-crop-settings">
            <div className="photo-crop-header">
              <span>裁切微调</span>
              <Button type="button" size="sm" disabled={busy || !cropModified} aria-label="重置照片裁切" onClick={() => updateCrop(DEFAULT_CROP)}><RotateCcw size={12} />重置</Button>
            </div>
            <div className="photo-crop-row">
              <label htmlFor={zoomId}>缩放</label>
              <output htmlFor={zoomId}>{crop.zoom.toFixed(2)}×</output>
              <input id={zoomId} type="range" min={1} max={2} step={0.05} value={crop.zoom} disabled={busy} onChange={(event) => updateCrop({ zoom: Number(event.target.value) })} />
            </div>
            <div className="photo-crop-row">
              <label htmlFor={offsetYId}>上下位置</label>
              <output htmlFor={offsetYId}>{Math.round(crop.offsetY * 100)}%</output>
              <input id={offsetYId} type="range" min={-1} max={1} step={0.05} value={crop.offsetY} disabled={busy} onChange={(event) => updateCrop({ offsetY: Number(event.target.value) })} />
            </div>
            <div className="photo-crop-row">
              <label htmlFor={offsetXId}>左右位置</label>
              <output htmlFor={offsetXId}>{Math.round(crop.offsetX * 100)}%</output>
              <input id={offsetXId} type="range" min={-1} max={1} step={0.05} value={crop.offsetX} disabled={busy} onChange={(event) => updateCrop({ offsetX: Number(event.target.value) })} />
            </div>
          </div>
        )}
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
        {fileInput}
        <div className="photo-settings-actions">
          <label htmlFor={inputId} className={`photo-upload-button ${busy || !basics ? 'is-disabled' : ''}`} aria-disabled={busy || !basics}>
            {busy ? '正在处理…' : photo ? '更换照片' : '上传照片'}
          </label>
          {photo && <Button type="button" size="sm" disabled={busy} onClick={() => { setError(''); setSourceFile(null); setCrop(DEFAULT_CROP); applyPhoto(undefined) }}><Trash2 size={13} />移除照片</Button>}
        </div>
        {!basics && <p>请先在编辑器中添加姓名。</p>}
        {error && <p role="alert" className="photo-settings-error">{error}</p>}
      </div>
    </Popover>
  )
}
