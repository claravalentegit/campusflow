export function BrandMark({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden>
      <rect width="36" height="36" rx="11" fill="var(--accent-press)" />
      <rect width="36" height="32" rx="11" fill="var(--accent)" />
      <path d="M20 6L10 19h7l-1.5 9L26 15h-7z" fill="#fff" />
    </svg>
  )
}
