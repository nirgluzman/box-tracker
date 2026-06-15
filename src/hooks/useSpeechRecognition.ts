import { useCallback, useEffect, useRef, useState } from 'react'

// Wraps the Web Speech API for live dictation (SPEC 7). Android Chrome only;
// language is set explicitly to he-IL (there is no "auto").
// onFinal fires once when dictation ends, with the final transcript - callers
// use it to trigger summarization as an event rather than a render effect.
export function useSpeechRecognition(lang = 'he-IL', onFinal?: (text: string) => void) {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
  const supported = !!Ctor

  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognition | null>(null)
  const finalRef = useRef('')

  // Keep the latest onFinal without recreating start().
  const onFinalRef = useRef(onFinal)
  useEffect(() => {
    onFinalRef.current = onFinal
  })

  // Tear down on unmount.
  useEffect(() => () => recRef.current?.abort(), [])

  const start = useCallback(() => {
    if (!Ctor) return
    finalRef.current = ''
    setTranscript('')
    setError(null)

    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalRef.current += result[0].transcript
        else interim += result[0].transcript
      }
      setTranscript(finalRef.current + interim)
    }
    // Surface the failure instead of silently stopping - "no-speech",
    // "not-allowed" (mic blocked), "audio-capture" (no mic), "network", etc.
    rec.onerror = (e) => {
      setError((e as unknown as { error?: string }).error ?? 'error')
      setListening(false)
    }
    rec.onend = () => {
      setListening(false)
      const text = finalRef.current.trim()
      if (text) onFinalRef.current?.(text)
    }

    try {
      recRef.current = rec
      rec.start()
      setListening(true)
    } catch {
      setError('start-failed')
      setListening(false)
    }
  }, [Ctor, lang])

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const reset = useCallback(() => {
    finalRef.current = ''
    setTranscript('')
  }, [])

  return { supported, listening, transcript, error, start, stop, reset }
}
