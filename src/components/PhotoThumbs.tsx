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

  // Android back button closes the viewer instead of changing screens.
  useBackDismiss(true, onClose)

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
      const [a, b] = [...pointers.current.values()]
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.current.scale }
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
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      view.current.scale = clamp(pinchStart.current.scale * (dist / pinchStart.current.dist), 1, 5)
      apply()
    } else if (pointers.current.size === 1 && view.current.scale > 1) {
      view.current.tx += dx
      view.current.ty += dy
      apply()
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLImageElement>) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
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
    setI((prev) => (prev + delta + photos.length) % photos.length)
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
            className="absolute left-2 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white"
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
            className="absolute right-2 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white"
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
