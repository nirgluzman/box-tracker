import { useEffect, useRef } from 'react'

// Make the Android back button dismiss an open overlay (modal, dialog, lightbox)
// instead of navigating to the previous screen. While `open`, push a throwaway
// history entry; back pops it and triggers `onDismiss`. Closing via UI sets
// open=false, and the cleanup pops the entry we pushed so the stack stays
// balanced. Pairs with the screen<->history sync in App.tsx.
export function useBackDismiss(open: boolean, onDismiss: () => void) {
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss
  useEffect(() => {
    if (!open) return
    let closedByPop = false
    window.history.pushState({ ...window.history.state, modal: true }, '')
    const onPop = () => {
      closedByPop = true
      dismiss.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (!closedByPop) window.history.back()
    }
  }, [open])
}
