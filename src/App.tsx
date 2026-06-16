import { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  getRedirectResult,
  getIdTokenResult,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'
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
  // To prevent the app from closing we seed a buffer of `guard` entries *below*
  // the root screen and rebuild it on every guard pop (see the diagram and the
  // rapid-click rationale on seedGuards() below). Back from any screen walks down
  // to the 'add' screen as normal; one more back lands on a guard entry, whose
  // popstate handler rebuilds the buffer and re-pins 'add' on top. Net effect:
  // the back press at the first screen is swallowed and the app stays open.
  //
  // Only armed when "installed" (launched without a URL bar). In a normal
  // browser tab the guard is skipped so back behaves normally. We test several
  // display modes because matchMedia('standalone') alone misses minimal-ui /
  // fullscreen installs and iOS home-screen (navigator.standalone) - missing any
  // of those would leave the guard unseeded and the app would close on back.
  useEffect(() => {
    if (!user) return
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    // A single guard sentinel can be OUTRUN by rapid back-presses: the browser
    // pops several history entries before our async popstate handler re-pins the
    // app, so mashing back from the first screen drops below the stack and exits.
    // Instead we keep a BUFFER of guard entries below the first screen and rebuild
    // the full buffer on every guard pop, so it self-heals faster than a human can
    // click. Stack while installed:
    //
    //   index 0..N-1: { guard: true }   <- buffer, never displayed
    //   index N:      { screen: 'add' } <- first visible screen
    const GUARD_DEPTH = 3
    const seedGuards = () => {
      // replaceState the current entry, then stack the rest. Called on mount and on
      // every guard pop, so wherever a rapid back-burst left us, we rebuild the full
      // buffer + first screen on top (pushState truncates any forward entries).
      window.history.replaceState({ screen: 'add', guard: true }, '')
      for (let i = 1; i < GUARD_DEPTH; i++) window.history.pushState({ screen: 'add', guard: true }, '')
      window.history.pushState({ screen: 'add' }, '')
    }
    if (installed) {
      seedGuards()
    } else {
      window.history.replaceState({ screen: 'add' }, '')
    }
    const onPop = (e: PopStateEvent) => {
      if (e.state?.guard) {
        // Back reached the guard buffer (i.e. went below the first screen): rebuild
        // the buffer and pin the first screen so the press is swallowed and the
        // installed PWA stays open instead of exiting.
        seedGuards()
        setScreen('add')
        return
      }
      const s = (e.state?.screen as Screen) ?? 'add'
      setScreen(s)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
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
