import { useMicLevel } from '../hooks/useMicLevel'

// Live equalizer bars showing mic input level while dictating. Self-contained so
// its ~60fps updates don't re-render the parent form.
export function MicVisualizer({ active }: { active: boolean }) {
  const bars = useMicLevel(active)
  return (
    <div className="flex h-6 items-end gap-1" aria-hidden="true">
      {bars.map((v, i) => (
        <span
          key={i}
          className="w-1.5 rounded-full bg-accent transition-[height] duration-75"
          style={{ height: `${Math.max(8, v * 100)}%` }}
        />
      ))}
    </div>
  )
}
