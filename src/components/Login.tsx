import { useState } from 'react'
import { signInWithRedirect, signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

// Sign-in method depends on the device. On desktop/laptop Chrome the redirect
// flow silently fails (it round-trips but Chrome's storage partitioning loses
// the result, leaving the user back on login with no error) - this hits both
// localhost dev and the shared-laptop case (SPEC 5). Popup is reliable there.
// On Android (the primary target) popups are unreliable in the standalone PWA,
// so redirect is used per SPEC 6.1. Result + member gate handled in App.tsx.
const useRedirect = /Android/i.test(navigator.userAgent)

// Packing illustration: a stack of taped moving boxes, the top one sealed with
// brand-accent tape and a shipping label. Inline SVG (like GoogleLogo) so it
// needs no asset/network and inherits the dark theme.
function PackingBoxes() {
  return (
    <svg
      viewBox="0 0 220 180"
      width="176"
      height="144"
      role="img"
      aria-label="A stack of packed moving boxes"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {/* bottom-left box */}
      <rect x="20" y="86" width="84" height="80" rx="6" fill="#d2a679" stroke="#8a6240" strokeWidth="3" />
      <path d="M20 104 H104" stroke="#8a6240" strokeWidth="3" />
      <path d="M62 86 V166" stroke="#b07a45" strokeWidth="4" />
      {/* bottom-right box */}
      <rect x="116" y="86" width="84" height="80" rx="6" fill="#c2925f" stroke="#8a6240" strokeWidth="3" />
      <path d="M116 104 H200" stroke="#8a6240" strokeWidth="3" />
      <path d="M158 86 V166" stroke="#9c6a3c" strokeWidth="4" />
      {/* top box, sealed with brand-accent tape + label */}
      <rect x="66" y="18" width="88" height="74" rx="6" fill="#e6bd8e" stroke="#8a6240" strokeWidth="3" />
      <path d="M66 36 H154" stroke="#8a6240" strokeWidth="3" />
      <path d="M110 18 V92" stroke="#2563eb" strokeWidth="5" />
      <rect x="84" y="50" width="52" height="26" rx="3" fill="#fdf6ec" stroke="#c9a06a" strokeWidth="2" />
      <path d="M92 60 H128 M92 67 H118" stroke="#b9a07f" strokeWidth="2.5" />
    </svg>
  )
}

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

// SPEC 6.1 - Google sign-in only. Popup on desktop/laptop, redirect on Android
// (see useRedirect above). The member-claim gate and the redirect result are
// handled centrally in App.tsx; `error` carries any message back to this screen.
export default function Login({ error }: { error?: string }) {
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  async function handleSignIn() {
    setBusy(true)
    setLocalError('')
    try {
      if (useRedirect) {
        await signInWithRedirect(auth, googleProvider)
        // Page navigates to Google; result is picked up on return in App.tsx.
      } else {
        // Popup resolves here; the member-claim gate runs in App.tsx via
        // onAuthStateChanged (fires for popup sign-ins too). Reset busy since
        // the page doesn't navigate away (a rejected non-member stays here).
        await signInWithPopup(auth, googleProvider)
        setBusy(false)
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
    // Boxes illustration on top, extra space (mt-10) before the title, then the
    // sign-in button. Starts a bit above the middle (pt-[10vh]).
    <div className="flex min-h-[100svh] flex-col items-center gap-7 p-8 pt-[10vh]">
      <PackingBoxes />
      <h1 className="mt-10 text-6xl font-extrabold tracking-tight text-accent">BoxBuddy</h1>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={busy}
        className="mt-6 flex items-center gap-3 rounded-md border border-edge bg-white px-5 py-2.5 text-sm font-medium text-[#1f1f1f] shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
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
