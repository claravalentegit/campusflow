import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from './cn'
import { Tooltip } from './Tooltip'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle' | 'success' | 'gold'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'btn-3d bg-accent text-accent-fg [--press:var(--accent-press)]',
  secondary: 'btn-3d bg-surface text-fg border-2 border-line [--press:var(--line)] hover:border-line-strong',
  ghost: 'text-fg-2 hover:bg-surface-2 hover:text-fg active:scale-95 transition-transform',
  subtle: 'bg-surface-2 text-fg hover:bg-surface-3 active:scale-95 transition-transform',
  danger: 'btn-3d bg-danger text-white [--press:rgb(0_0_0/0.25)]',
  success: 'btn-3d bg-success-bright text-white [--press:var(--success-press)]',
  gold: 'btn-3d bg-gold text-white [--press:var(--gold-press)] [text-shadow:0_1px_0_var(--gold-press)]',
}
const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-13 px-6 text-base gap-2.5 rounded-2xl',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  iconRight?: LucideIcon
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-extrabold whitespace-nowrap select-none disabled:opacity-50 disabled:pointer-events-none',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={size === 'sm' ? 'size-3.5' : size === 'lg' ? 'size-5' : 'size-4'} aria-hidden strokeWidth={2.5} />}
      {children}
      {IconRight && <IconRight className={size === 'sm' ? 'size-3.5' : size === 'lg' ? 'size-5' : 'size-4'} aria-hidden strokeWidth={2.5} />}
    </button>
  )
})

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon
  label: string
  variant?: 'ghost' | 'secondary' | 'subtle'
  size?: 'sm' | 'md'
  tooltip?: boolean
  tooltipSide?: 'top' | 'bottom' | 'right' | 'left'
  badge?: ReactNode
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, variant = 'ghost', size = 'md', tooltip = true, tooltipSide = 'bottom', className, badge, type = 'button', ...rest },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-lg transition-colors duration-100 disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' ? 'size-8' : 'size-10',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-[18px]'} aria-hidden strokeWidth={2.25} />
      {badge}
    </button>
  )
  return tooltip ? (
    <Tooltip label={label} side={tooltipSide}>
      {button}
    </Tooltip>
  ) : (
    button
  )
})
