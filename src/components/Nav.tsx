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
    <nav className="nav">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={active === t.id ? 'nav-tab active' : 'nav-tab'}
          aria-current={active === t.id ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}
