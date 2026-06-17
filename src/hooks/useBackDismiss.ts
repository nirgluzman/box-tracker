import { useEffect, useRef } from 'react'

// Make the Android back button dismiss an open overlay (modal, dialog, lightbox)
// instead of navigating to the previous screen. While `open`, push a throwaway
// history entry; back pops it and triggers `onDismiss`. Closing via UI sets
// open=false, and the cleanup pops the entry we pushed so the stack stays
// balanced. Pairs with the screen<->history sync in App.tsx.
//
// StrictMode-safe: in dev, effects run mount -> cleanup -> mount. A naive
// history.back() in cleanup would fire popstate and self-dismiss the overlay the
// instant it opens (a visible blink on desktop). So the cleanup defers back() by
// a tick; an immediate re-mount cancels it, and `pushed` dedupes the pushState so
// the entry isn't added twice. A real unmount lets the deferred back() run.
export function useBackDismiss(open: boolean, onDismiss: () => void) {
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss
  const pushed = useRef(false)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!open) return
    // A pending self-undo means this is a StrictMode re-mount - cancel it and
    // reuse the entry already on the stack instead of pushing a second one.
    if (undoTimer.current) {
      clearTimeout(undoTimer.current)
      undoTimer.current = null
    }
    if (!pushed.current) {
      window.history.pushState({ ...window.history.state, modal: true }, '')
      pushed.current = true
    }
    let closedByPop = false
    const onPop = () => {
      closedByPop = true
      pushed.current = false
      dismiss.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (closedByPop) return
      // Defer: a StrictMode re-mount runs the effect again synchronously and
      // cancels this; a real unmount keeps it, popping our entry.
      undoTimer.current = setTimeout(() => {
        undoTimer.current = null
        pushed.current = false
        window.history.back()
      }, 0)
    }
  }, [open])
}
