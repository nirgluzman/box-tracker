import { useEffect, useState } from 'react'

// The beforeinstallprompt event isn't in the standard DOM lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// PWA install button. Captures Chrome's beforeinstallprompt and shows a header
// button that triggers the native install dialog. Self-hides when the app is
// already installed or the browser never fires the event (ineligible / iOS).
export function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault() // stop Chrome's mini-infobar; we show our own button
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setPromptEvent(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!promptEvent) return null

  async function install() {
    if (!promptEvent) return
    await promptEvent.prompt()
    await promptEvent.userChoice
    setPromptEvent(null) // Chrome only lets the captured event be used once
  }

  return (
    <button type="button" className="btn btn-primary" onClick={install}>
      Install
    </button>
  )
}
