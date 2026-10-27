import { ArrowDown, ArrowUp, ChevronDown, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Popover } from '@/shared/ui/Popover'

export function ModuleContentActions({ label, index = 0, count = 0, onMove, onDelete, onRename, onToggleItems, itemsCollapsed }: {
  label: string; index?: number; count?: number; onMove?: (direction: -1 | 1) => void; onDelete?: () => void; onRename?: () => void; onToggleItems?: () => void; itemsCollapsed?: boolean
}) {
  return <Popover contentRole="menu" align="right" ariaLabel={`${label}操作`} trigger={<button type="button" className="module-icon-button" aria-label={`${label}更多操作`} title="更多操作"><MoreHorizontal size={17} /></button>}>
    <div className="module-action-menu">
      {onRename && <button type="button" role="menuitem" onClick={onRename}><Pencil size={14} />重命名模块</button>}
      {onToggleItems && <button type="button" role="menuitem" onClick={onToggleItems}><ChevronDown size={14} />{itemsCollapsed ? '展开全部条目' : '收起全部条目'}</button>}
      {onMove && <>
        <button type="button" role="menuitem" aria-label={`上移${label}`} disabled={index <= 0} onClick={() => onMove(-1)}><ArrowUp size={14} />向上移动</button>
        <button type="button" role="menuitem" aria-label={`下移${label}`} disabled={index >= count - 1} onClick={() => onMove(1)}><ArrowDown size={14} />向下移动</button>
      </>}
      {onDelete && <button type="button" role="menuitem" className="module-menu-danger" aria-label={`删除${label}`} onClick={onDelete}><Trash2 size={14} />删除{label.startsWith('模块') ? '模块' : '这条内容'}</button>}
    </div>
  </Popover>
}
