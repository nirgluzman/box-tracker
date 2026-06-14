// SPEC 6 / 9 — responsive nav. Bottom tab bar < 768px, top bar >= 768px (CSS).
export type Screen = 'add' | 'browse' | 'unpack' | 'config'

const TABS: { id: Screen; label: string }[] = [
  { id: 'add', label: 'Add Box' },
  { id: 'browse', label: 'Browse' },
  { id: 'unpack', label: 'Unpack' },
  { id: 'config', label: 'Config' },
]

export default function Nav({
  active,
  onChange,
}: {
  active: Screen
  onChange: (s: Screen) => void
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 flex border-t border-edge bg-surface md:static md:border-t-0 md:border-b">
      {TABS.map((t) => {
        const isActive = active === t.id
        return (
          <button
            key={t.id}
            className={`min-h-12 flex-1 px-1 py-3.5 text-sm transition-colors ${
              isActive ? 'font-bold text-accent' : 'text-muted hover:text-fg'
            }`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}
