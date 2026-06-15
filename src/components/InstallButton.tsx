import { useEffect, useState } from 'react'

// The beforeinstallprompt event isn't in the standard DOM lib types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// PWA install button. Always visible (until the app is installed). If Chrome has
// fired beforeinstallprompt, the button triggers the native install dialog;
// otherwise — Chrome throttles that event on Android behind an engagement
// heuristic — it shows manual "⋮ → Add to Home screen" instructions.
export function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches,
  )
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault() // stop Chrome's mini-infobar; we drive install ourselves
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
      setShowHelp(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  async function handleClick() {
    if (promptEvent) {
      await promptEvent.prompt()
      await promptEvent.userChoice
      setPromptEvent(null) // Chrome only lets the captured event be used once
    } else {
      setShowHelp(true) // no native prompt available — show manual steps
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={handleClick}>
        Install
      </button>

      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-edge bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 font-semibold">Install BoxBuddy</h3>
            <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm">
              <li>
                Tap the <strong>⋮</strong> menu (top-right of Chrome).
              </li>
              <li>
                Choose <strong>Add to Home screen</strong> (or <strong>Install app</strong>).
              </li>
              <li>
                Confirm <strong>Install</strong> — BoxBuddy opens full-screen from your home
                screen.
              </li>
            </ol>
            <button type="button" className="btn w-full" onClick={() => setShowHelp(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
