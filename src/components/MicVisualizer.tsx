// "Listening" indicator: animated equalizer bars shown while dictating. Driven
// purely by CSS (no second getUserMedia stream) so it never competes with
// SpeechRecognition for the microphone. Staggered delays make it look alive.
const DELAYS = ['0ms', '120ms', '240ms', '360ms', '180ms', '60ms']

export function MicVisualizer({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="flex h-6 items-center gap-1" aria-hidden="true">
      {DELAYS.map((d, i) => (
        <span
          key={i}
          className="h-full w-1.5 origin-center rounded-full bg-accent"
          style={{ animation: 'mic-bounce 0.8s ease-in-out infinite', animationDelay: d }}
        />
      ))}
    </div>
  )
}
