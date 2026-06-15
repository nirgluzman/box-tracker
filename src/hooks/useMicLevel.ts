import { useEffect, useState } from 'react'

// While `active`, open the mic and return the live input loudness (RMS, 0..1)
// so a visualizer can react to the user's voice. Time-domain amplitude is used
// (not a frequency band) so any speech drives it, not just certain pitches.
// Independent of SpeechRecognition; both can read the mic at once. 0 when
// inactive or if mic access is denied.
export function useMicLevel(active: boolean): number {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    if (!active) {
      setLevel(0)
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
        analyser.fftSize = 256
        src.connect(analyser)
        const data = new Uint8Array(analyser.fftSize)
        const loop = () => {
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / data.length)
          setLevel(Math.min(1, rms * 3)) // gain so normal speech fills the bars
          raf = requestAnimationFrame(loop)
        }
        loop()
      })
      .catch(() => {
        /* mic denied/unavailable - stays at 0 */
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      ctx?.close()
    }
  }, [active])

  return level
}
