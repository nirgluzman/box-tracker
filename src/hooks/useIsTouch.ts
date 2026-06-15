import { useEffect, useState } from 'react'

// True on touch devices (phones/tablets), false on mouse-driven laptops/desktops.
// Used to hide the rear-camera "Take photo" button on laptops, where there is no
// useful rear camera and the `capture` attribute is ignored anyway. Voice input
// and gallery upload stay available everywhere.
export function useIsTouch() {
  const [touch, setTouch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const on = () => setTouch(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return touch
}
