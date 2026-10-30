// 与标签页共用 public/logo.svg 中的 M 图形，颜色继承当前界面主题。
export function Logo({ className = '', size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <use href={`${import.meta.env.BASE_URL}logo.svg#milloncv-mark`} />
    </svg>
  )
}
