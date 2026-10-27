// 通用按钮原子：统一 util-btn / pt-btn / mode-btn 外观，支持 primary / active 变体
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { btnBase, btnPrimary, btnActive, btnSm } from './classes'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary'
  active?: boolean
  size?: 'md' | 'sm'
  children: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({
  variant = 'default',
  active = false,
  size = 'md',
  className = '',
  children,
  ...rest
}, ref) {
  const cls = [
    btnBase,
    size === 'sm' ? btnSm : '',
    variant === 'primary' ? btnPrimary : '',
    active ? btnActive : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button ref={ref} className={cls} {...rest}>
      {children}
    </button>
  )
})
