import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useBackDismiss } from '../hooks/useBackDismiss'

// Clickable photo thumbnails that open a full-screen, pinch-to-zoom viewer.
export function PhotoThumbs({ urls, size = 'size-16' }: { urls: string[]; size?: string }) {
  const [open, setOpen] = useState<number | null>(null)
  if (urls.length === 0) return null
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, idx) => (
          <button
            key={u}
            type="button"
            onClick={() => setOpen(idx)}
            className="rounded focus-visible:outline-2 focus-visible:outline-accent"
            aria-label="View photo full screen"
          >
            <img src={u} alt="" className={`${size} rounded border border-edge object-cover`} />
          </button>
        ))}
      </div>
      {open !== null && (
        <Lightbox photos={urls} index={open} onClose={() => setOpen(null)} />
      )}
    </>
  )
}

// Full-screen image viewer: pinch-to-zoom + drag-to-pan + double-tap to toggle
// zoom. Tap the backdrop, the ×, or press Escape to close. Dependency-free,
// driven by pointer events so one and two-finger gestures both work on Android.
export function Lightbox({
  photos,
  index,
  onClose,
}: {
  photos: string[]
  index: number
  onClose: () => void
}) {
  const [i, setI] = useState(index)
  const imgRef = useRef<HTMLImageElement>(null)
  const view = useRef({ scale: 1, tx: 0, ty: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null)
  const lastTap = useRef(0)
  // Single-finger horizontal swipe to switch photos, but only while not zoomed
  // (when zoomed, a one-finger drag pans instead). Tracks the gesture origin and
  // accumulated dx for live drag feedback.
  const swipe = useRef<{ startX: number; startY: number; dx: number; active: boolean } | null>(null)

  // Android back button closes the viewer instead of changing screens.
  useBackDismiss(true, onClose)

  const pinchDist = () => {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  const apply = () => {
    const el = imgRef.current
    if (el) {
      const { scale, tx, ty } = view.current
      el.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
    }
  }
  const reset = () => {
    view.current = { scale: 1, tx: 0, ty: 0 }
    apply()
  }

  // Lock body scroll while open; close on Escape.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function onPointerDown(e: ReactPointerEvent<HTMLImageElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      pinchStart.current = { dist: pinchDist(), scale: view.current.scale }
      swipe.current = null // a second finger cancels any swipe in progress
    } else if (pointers.current.size === 1 && view.current.scale <= 1 && photos.length > 1) {
      swipe.current = { startX: e.clientX, startY: e.clientY, dx: 0, active: false }
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLImageElement>) {
    const p = pointers.current.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    if (pointers.current.size >= 2 && pinchStart.current) {
      view.current.scale = clamp(pinchStart.current.scale * (pinchDist() / pinchStart.current.dist), 1, 5)
      apply()
    } else if (pointers.current.size === 1 && view.current.scale > 1) {
      view.current.tx += dx
      view.current.ty += dy
      apply()
    } else if (swipe.current) {
      // Not zoomed: track total movement; once it's clearly horizontal, drag the
      // image with the finger so the swipe feels physical.
      const s = swipe.current
      s.dx = e.clientX - s.startX
      const totalY = e.clientY - s.startY
      if (!s.active && Math.abs(s.dx) > 10 && Math.abs(s.dx) > Math.abs(totalY)) s.active = true
      if (s.active) {
        // Rubber-band: dragging past the first photo (right) or last photo
        // (left) meets resistance and won't navigate, signalling the end.
        const atStart = i === 0 && s.dx > 0
        const atEnd = i === photos.length - 1 && s.dx < 0
        view.current.tx = atStart || atEnd ? s.dx / 3 : s.dx
        apply()
      }
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLImageElement>) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    const s = swipe.current
    swipe.current = null
    // Commit a swipe past a quarter of the viewport width (or a clear flick);
    // go() resets the transform. Otherwise snap the dragged image back.
    if (s?.active && view.current.scale <= 1) {
      const threshold = Math.min(80, window.innerWidth / 4)
      const dir = s.dx < 0 ? 1 : -1
      const target = i + dir
      // Navigate only within bounds; at an edge the image just snaps back.
      if (Math.abs(s.dx) > threshold && target >= 0 && target < photos.length) {
        go(dir)
        return
      }
    }
    if (view.current.scale <= 1) reset() // snap back when zoomed out
  }

  function onImageClick() {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      view.current.scale = view.current.scale > 1 ? 1 : 2.5
      if (view.current.scale === 1) {
        view.current.tx = 0
        view.current.ty = 0
      }
      apply()
    }
    lastTap.current = now
  }

  function go(delta: number) {
    setI((prev) => clamp(prev + delta, 0, photos.length - 1))
    reset()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-full bg-white/15 text-2xl text-white"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            disabled={i === 0}
            className="absolute left-2 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white disabled:opacity-30"
            onClick={(e) => {
              e.stopPropagation()
              go(-1)
            }}
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            disabled={i === photos.length - 1}
            className="absolute right-2 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white disabled:opacity-30"
            onClick={(e) => {
              e.stopPropagation()
              go(1)
            }}
            aria-label="Next photo"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-white/15 px-2 py-0.5 text-xs text-white">
            {i + 1} / {photos.length}
          </div>
        </>
      )}

      <img
        ref={imgRef}
        key={i}
        src={photos[i]}
        alt=""
        className="max-h-[100dvh] max-w-[100vw] touch-none select-none object-contain"
        draggable={false}
        onClick={(e) => {
          e.stopPropagation()
          onImageClick()
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  )
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}
