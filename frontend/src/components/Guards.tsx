import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid h-screen place-items-center text-slate-500">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAuth()
  if (!can(permission)) {
    return (
      <div className="card p-10 text-center text-slate-500">
        Mee role ki ee page chudadaniki permission ledu ({permission}).
      </div>
    )
  }
  return children
}
