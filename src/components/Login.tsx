import { useState } from 'react'
import { signInWithRedirect, signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

// On localhost the redirect flow breaks: it stashes state on the authDomain
// origin and Chrome's third-party storage partitioning blocks reading it back
// on localhost, so the sign-in silently never completes. Popup works on
// localhost (Google whitelists it, and no service worker runs in `vite dev`).
// Deployed, redirect is used per SPEC 6.1 (reliable on Android/PWA).
const isLocalhost =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'

// Official Google "G" mark (per Google branding guidelines).
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  )
}

// SPEC 6.1 - Google sign-in only via redirect (popup breaks under COOP and on
// Android/PWA). The member-claim gate and the result of the redirect are handled
// centrally in App.tsx; `error` carries any message back to this screen.
export default function Login({ error }: { error?: string }) {
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  async function handleSignIn() {
    setBusy(true)
    setLocalError('')
    try {
      if (isLocalhost) {
        // Popup resolves here; the member-claim gate runs in App.tsx via
        // onAuthStateChanged (fires for popup sign-ins too). Reset busy since
        // the page doesn't navigate away (a rejected non-member stays here).
        await signInWithPopup(auth, googleProvider)
        setBusy(false)
      } else {
        await signInWithRedirect(auth, googleProvider)
        // Page navigates to Google; result is picked up on return in App.tsx.
      }
    } catch (e) {
      // Ignore the user simply closing the popup.
      const code = (e as { code?: string })?.code
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setLocalError('Sign-in failed. Please try again.')
      }
      setBusy(false)
    }
  }

  const message = localError || error

  return (
    <div className="flex flex-col items-center gap-6 p-12">
      <h1 className="text-3xl font-bold text-accent">BoxBuddy</h1>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={busy}
        className="flex items-center gap-3 rounded-md border border-edge bg-white px-5 py-2.5 text-sm font-medium text-[#1f1f1f] shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
      >
        <GoogleLogo />
        {busy ? 'Redirecting…' : 'Sign in with Google'}
      </button>
      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
    </div>
  )
}
