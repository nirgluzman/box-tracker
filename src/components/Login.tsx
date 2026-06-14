import { useState, type FormEvent } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'

// SPEC 6.1 — email/password sign-in, disabled Google button, inline errors.
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // On success, App routing redirects to Add Box.
    } catch {
      setError('Sign-in failed. Check your email and password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 p-12">
      <h1 className="text-3xl font-bold text-accent">BoxBuddy</h1>
      <form onSubmit={handleSubmit} className="flex w-full max-w-80 flex-col gap-3">
        <input
          type="email"
          placeholder="Email"
          autoComplete="username"
          className="field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          className="field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
