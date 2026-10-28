import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from './cn'

const CONTROL =
  'w-full rounded-xl border-2 border-line bg-surface px-3 text-sm font-semibold text-fg placeholder:font-medium placeholder:text-fg-3 transition-[border-color,box-shadow] hover:border-line-strong focus:border-accent focus:shadow-[0_0_0_4px_var(--accent-soft)] focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:shadow-[0_0_0_4px_var(--danger-soft)]'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(CONTROL, 'h-11', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(CONTROL, 'min-h-20 py-2.5 leading-5', className)} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <span className={cn('relative block', className)}>
      <select ref={ref} className={cn(CONTROL, 'h-11 cursor-pointer appearance-none pr-9')} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-3" strokeWidth={2.5} aria-hidden />
    </span>
  )
})

export interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  className?: string
  optional?: boolean
  /** Explicit control id, e.g. to focus the first invalid field after submit. */
  id?: string
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode
}

/** Label + control + hint/error, wired up for screen readers. */
export function Field({ label, hint, error, className, optional, id: explicitId, children }: FieldProps) {
  const autoId = useId()
  const id = explicitId ?? autoId
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-extrabold text-fg">
        {label}
        {optional && <span className="ml-1.5 text-xs font-bold text-fg-3">optional</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-err`} className="text-xs font-bold text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs font-semibold text-fg-3">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
