import { useMicLevel } from '../hooks/useMicLevel'

// Bell-shaped per-bar weights so the center bars peak higher - all bars react
// to the single loudness level, just by different amounts.
const WEIGHTS = [0.45, 0.7, 0.9, 1, 0.9, 0.7, 0.45]

// Live equalizer bars showing mic loudness while dictating. Self-contained so
// its ~60fps updates don't re-render the parent form.
export function MicVisualizer({ active }: { active: boolean }) {
  const level = useMicLevel(active)
  return (
    <div className="flex h-6 items-center gap-1" aria-hidden="true">
      {WEIGHTS.map((w, i) => {
        // Small per-bar jitter so the bars shimmer rather than move in lockstep.
        const jitter = 0.8 + Math.random() * 0.4
        const h = Math.max(10, Math.min(100, level * w * jitter * 120))
        return (
          <span
            key={i}
            className="w-1.5 rounded-full bg-accent transition-[height] duration-75"
            style={{ height: `${h}%` }}
          />
        )
      })}
    </div>
  )
}
