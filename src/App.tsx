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
          setAuthError("This account isn't authorized to use BoxBuddy.")
          void signOut(auth) // re-fires onAuthStateChanged(null)
          return
        }
        setAuthError('')
        setUser(u)
        setAuthReady(true)
      })
    })
  }, [])

  // Sync screen with browser history so the Android back button moves between
  // screens instead of leaving the app. The seed entry is set when auth becomes
  // ready (the app shell first renders); each nav pushes a new entry.
  useEffect(() => {
    if (!user) return
    window.history.replaceState({ screen: 'add' }, '')
    const onPop = (e: PopStateEvent) => {
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
        <span className="text-lg font-bold text-accent">BoxBuddy</span>
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
