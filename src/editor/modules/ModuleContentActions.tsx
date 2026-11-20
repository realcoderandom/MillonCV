import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronDown, Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Popover } from '@/shared/ui/Popover'

export function ModuleContentActions({ label, index = 0, count = 0, onMove, onDuplicate, onDelete, onRename, onToggleItems, itemsCollapsed, region, onToggleRegion }: {
  label: string; index?: number; count?: number; onMove?: (direction: -1 | 1) => void; onDuplicate?: () => void; onDelete?: () => void; onRename?: () => void; onToggleItems?: () => void; itemsCollapsed?: boolean; region?: 'main' | 'sidebar'; onToggleRegion?: () => void
}) {
  return <Popover contentRole="menu" align="right" ariaLabel={`${label}操作`} trigger={<button type="button" className="module-icon-button" aria-label={`${label}更多操作`} title="更多操作"><MoreHorizontal size={17} /></button>}>
    <div className="module-action-menu">
      {onRename && <button type="button" role="menuitem" onClick={onRename}><Pencil size={14} />重命名模块</button>}
      {onToggleItems && <button type="button" role="menuitem" onClick={onToggleItems}><ChevronDown size={14} />{itemsCollapsed ? '展开全部条目' : '收起全部条目'}</button>}
      {onToggleRegion && region && <button type="button" role="menuitem" onClick={onToggleRegion}><ArrowLeftRight size={14} />{region === 'main' ? '移至侧栏' : '移至主栏'}</button>}
      {onDuplicate && <button type="button" role="menuitem" aria-label={`复制${label}`} onClick={onDuplicate}><Copy size={14} />复制这条内容</button>}
      {onMove && <>
        <button type="button" role="menuitem" aria-label={`上移${label}`} disabled={index <= 0} onClick={() => onMove(-1)}><ArrowUp size={14} />向上移动</button>
        <button type="button" role="menuitem" aria-label={`下移${label}`} disabled={index >= count - 1} onClick={() => onMove(1)}><ArrowDown size={14} />向下移动</button>
      </>}
      {onDelete && <button type="button" role="menuitem" className="module-menu-danger" aria-label={`删除${label}`} onClick={onDelete}><Trash2 size={14} />删除{label.startsWith('模块') ? '模块' : '这条内容'}</button>}
    </div>
  </Popover>
}
