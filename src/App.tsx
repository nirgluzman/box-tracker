import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  getRedirectResult,
  getIdTokenResult,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'
import { registerMember } from './data/members'
import Login from './components/Login'
import Nav, { type Screen } from './components/Nav'
import AddBox from './components/AddBox'
import Browse from './components/Browse'
import Config from './components/Config'

function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (online) return null
  return (
    <div
      className="bg-accent py-2 text-center text-sm font-semibold text-on-accent"
      role="status"
    >
      Offline - changes will sync when reconnected
    </div>
  )
}

// Google profile photo in a circle (SPEC 5). Falls back to the first letter of
// the name/email if there's no photo. `title` keeps the email discoverable for
// reference; box change-tracking still records it via addedBy.
function Avatar({ user }: { user: User }) {
  const label = user.email ?? user.displayName ?? undefined
  const [broken, setBroken] = useState(false)
  if (user.photoURL && !broken) {
    return (
      <img
        src={user.photoURL}
        alt={label ?? 'Profile'}
        title={label}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="size-8 rounded-full object-cover"
      />
    )
  }
  const initial = (user.displayName ?? user.email ?? '?').charAt(0).toUpperCase()
  return (
    <span
      title={label}
      className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent"
    >
      {initial}
    </span>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')
  const [screen, setScreen] = useState<Screen>('add') // redirect to Add Box on sign-in

  useEffect(() => {
    // Surface failures from the redirect sign-in flow (SPEC 6.1).
    getRedirectResult(auth).catch(() => setAuthError('Sign-in failed. Please try again.'))
    // Access is gated by the `member` custom claim (SPEC 5/10): a signed-in
    // account without it is rejected and signed back out.
    return onAuthStateChanged(auth, (u) => {
      if (!u) {
        setUser(null)
        setAuthReady(true)
        return
      }
      getIdTokenResult(u).then(({ claims }) => {
        if (claims.member !== true) {
          setAuthError("This account isn't authorized to use BoxIndex.")
          void signOut(auth) // re-fires onAuthStateChanged(null)
          return
        }
        setAuthError('')
        setUser(u)
        setAuthReady(true)
        // Record/refresh this user's profile so the admin's Config panel can
        // list everyone with their photo (SPEC 5). Profile fields only - the
        // permission flags are admin-only (firestore.rules). The admin marker
        // mirrors the `admin` claim and is written only for the admin.
        void registerMember(u, claims.admin === true)
      })
    })
  }, [])

  // Mirror the current screen into window.history so the Android back button
  // moves between screens (each navigate() pushes an entry) instead of leaving
  // the app on the first press.
  //
  // BACK-BUTTON TRAP (installed PWA only):
  // In an installed PWA there is no URL bar, so once back reaches the very first
  // history entry the next press EXITS the app, tearing down auth + Firestore
  // sync and forcing a re-auth/re-sync on relaunch (bad UX, reported by users).
  // To prevent the app from closing we seed a `guard` entry *below* the first
  // screen and re-pin the first screen whenever back reaches it.
  //
  //   index 0: { guard: true }   <- sentinel, never displayed
  //   index 1: { screen: 'add' } <- first visible screen
  //
  // CRITICAL - user-activation gating: Chrome's "history manipulation
  // intervention" SKIPS history entries that were pushed without a user gesture
  // when the user presses back (anti back-trap heuristic). The guard must
  // therefore be seeded only after the document has had a user gesture, otherwise
  // back jumps straight past it and exits anyway. On Android the sign-in uses
  // signInWithRedirect, which reloads into a FRESH document with no activation, so
  // a guard seeded on load is always skippable - which is why earlier attempts
  // failed on the phone. Once any tap happens, sticky activation persists for the
  // document's lifetime and every later pushState (incl. the popstate re-pin) is
  // exempt. So: seed now if the document is already active, else on first gesture.
  //
  // Only armed when "installed" (launched without a URL bar). In a normal browser
  // tab the guard is skipped so back behaves normally. We test several display
  // modes because matchMedia('standalone') alone misses minimal-ui / fullscreen
  // installs and iOS home-screen (navigator.standalone).
  useEffect(() => {
    if (!user) return
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    if (!installed) {
      window.history.replaceState({ screen: 'add' }, '')
      const onPopTab = (e: PopStateEvent) => setScreen((e.state?.screen as Screen) ?? 'add')
      window.addEventListener('popstate', onPopTab)
      return () => window.removeEventListener('popstate', onPopTab)
    }

    const seedGuard = () => {
      window.history.replaceState({ screen: 'add', guard: true }, '')
      window.history.pushState({ screen: 'add' }, '')
    }
    // Seed immediately if the document already carries (sticky) user activation;
    // otherwise wait for the first gesture so the pushed entry isn't skipped.
    const ua = (navigator as { userActivation?: { hasBeenActive: boolean } }).userActivation
    let seeded = false
    const armSeed = () => {
      if (seeded) return
      seeded = true
      seedGuard()
      window.removeEventListener('pointerdown', armSeed)
      window.removeEventListener('keydown', armSeed)
    }
    if (ua?.hasBeenActive) {
      armSeed()
    } else {
      window.addEventListener('pointerdown', armSeed)
      window.addEventListener('keydown', armSeed)
    }

    const onPop = (e: PopStateEvent) => {
      if (e.state?.guard) {
        // Back reached the guard sentinel (went below the first screen): re-pin the
        // first screen so the press is swallowed and the installed PWA stays open.
        window.history.pushState({ screen: 'add' }, '')
        setScreen('add')
        return
      }
      setScreen((e.state?.screen as Screen) ?? 'add')
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('pointerdown', armSeed)
      window.removeEventListener('keydown', armSeed)
    }
  }, [user])

  const navigate = (s: Screen) => {
    if (s === screen) return
    window.history.pushState({ screen: s }, '')
    setScreen(s)
  }

  if (!authReady) return <div className="flex flex-col items-center gap-3 p-12">Loading…</div>
  if (!user) return <Login error={authError} />

  return (
    <div className="flex h-dvh flex-col">
      <OfflineBanner />
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-edge bg-surface px-4 py-2.5">
        <span className="text-lg font-bold text-accent">BoxIndex</span>
        <div className="flex items-center gap-3">
          <Avatar user={user} />
          <button type="button" className="btn" onClick={() => signOut(auth)}>
            Log out
          </button>
        </div>
      </header>
      {/* Top bar on desktop (in-flow, fixed height); pinned to the bottom on
          mobile via position:fixed. Only <main> scrolls. */}
      <Nav active={screen} onChange={navigate} />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {screen === 'add' && <AddBox />}
        {screen === 'browse' && <Browse />}
        {screen === 'config' && <Config />}
      </main>
    </div>
  )
}
