import { useEffect, useState } from 'react'

const BARS = 7

// While `active`, open the mic and return live per-bar audio magnitudes (0..1)
// for a simple equalizer-style visualizer, so the user sees the mic is picking
// up their voice. Independent of SpeechRecognition (which manages its own audio);
// both can read the mic at once. Returns flat bars when inactive or on denial.
export function useMicLevel(active: boolean): number[] {
  const [bars, setBars] = useState<number[]>(() => Array(BARS).fill(0))

  useEffect(() => {
    if (!active) {
      setBars(Array(BARS).fill(0))
      return
    }
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let raf = 0
    let cancelled = false

    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        ctx = new AudioContext()
        const src = ctx.createMediaStreamSource(s)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 64
        src.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const per = Math.floor(data.length / BARS)
        const loop = () => {
          analyser.getByteFrequencyData(data)
          const next: number[] = []
          for (let i = 0; i < BARS; i++) {
            let sum = 0
            for (let j = 0; j < per; j++) sum += data[i * per + j]
            next.push(Math.min(1, sum / per / 170))
          }
          setBars(next)
          raf = requestAnimationFrame(loop)
        }
        loop()
      })
      .catch(() => {
        /* mic denied/unavailable - leave bars flat */
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      ctx?.close()
    }
  }, [active])

  return bars
}
