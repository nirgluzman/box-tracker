// Small inline loading spinner. Inherits the current text color (border-current)
// so it sits naturally inside buttons and labels.
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.125em] ${className}`}
    />
  )
}
