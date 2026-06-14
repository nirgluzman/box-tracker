import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from './firebase'
import Login from './components/Login'
import Nav, { type Screen } from './components/Nav'
import AddBox from './components/AddBox'
import Browse from './components/Browse'
import Unpack from './components/Unpack'
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
      Offline — changes will sync when reconnected
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [screen, setScreen] = useState<Screen>('add') // redirect to Add Box on sign-in

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthReady(true)
    })
  }, [])

  if (!authReady) return <div className="flex flex-col items-center gap-3 p-12">Loading…</div>
  if (!user) return <Login />

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <OfflineBanner />
      <header className="flex items-center justify-between gap-3 border-b border-edge bg-surface px-4 py-2.5">
        <span className="text-lg font-bold text-accent">BoxBuddy</span>
        <div className="flex items-center gap-3">
          <span className="max-w-[55vw] truncate text-sm text-muted" title={user.email ?? undefined}>
            {user.email}
          </span>
          <button type="button" className="btn" onClick={() => signOut(auth)}>
            Log out
          </button>
        </div>
      </header>
      <main>
        {screen === 'add' && <AddBox />}
        {screen === 'browse' && <Browse />}
        {screen === 'unpack' && <Unpack />}
        {screen === 'config' && <Config />}
      </main>
      <Nav active={screen} onChange={setScreen} />
    </div>
  )
}
