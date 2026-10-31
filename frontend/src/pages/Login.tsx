import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-sidebar to-emerald-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-lg font-bold text-white">C</div>
          <div>
            <h1 className="text-xl font-semibold">Welcome back</h1>
            <p className="text-sm text-slate-500">Mee CRM account lo login avvandi</p>
          </div>
        </div>

        <label className="mb-1 block text-sm font-medium" htmlFor="email">Email</label>
        <input id="email" type="email" required autoComplete="username" className="input mb-4" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className="mb-1 block text-sm font-medium" htmlFor="password">Password</label>
        <input id="password" type="password" required autoComplete="current-password" className="input mb-4" value={password} onChange={(e) => setPassword(e.target.value)} />

        {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <button type="submit" disabled={busy} className="btn btn-primary w-full py-2.5">
          {busy ? 'Logging in…' : 'Login'}
        </button>
        <p className="mt-4 text-center text-xs text-slate-400">Demo login details: backend/.env lo SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD</p>
      </form>
    </div>
  )
}
