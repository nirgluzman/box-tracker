import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from './firebase'
import Login from './components/Login'
import Nav, { type Screen } from './components/Nav'
import AddBox from './components/AddBox'
import Browse from './components/Browse'
import Unpack from './components/Unpack'
import Config from './components/Config'
import './App.css'

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
    <div className="offline-banner" role="status">
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

  if (!authReady) return <div className="loading">Loading…</div>
  if (!user) return <Login />

  return (
    <div className="app">
      <OfflineBanner />
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
