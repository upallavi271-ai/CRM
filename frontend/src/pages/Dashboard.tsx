import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { money, moneyShort } from '../lib/format'
import type { DashboardSummary } from '../lib/types'

interface Stat {
  label: string
  value: string
  hint?: string
  title?: string
  link: string
}

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<DashboardSummary>('/dashboard/summary').then(setData).catch((e: Error) => setError(e.message))
  }, [])

  const stats: Stat[] = []
  const leads = data?.sales?.leads
  const deals = data?.sales?.deals
  if (leads) {
    stats.push({ label: 'Total leads', value: leads.total.toLocaleString('en-IN'), hint: `${leads.newThisMonth} this month`, link: '/leads' })
  }
  if (deals) {
    stats.push({ label: 'Open pipeline', value: moneyShort(deals.openValue), title: money(deals.openValue), hint: `${deals.openCount} deals · ${moneyShort(deals.weightedValue)} weighted`, link: '/deals' })
    stats.push({ label: 'Won this month', value: moneyShort(deals.wonThisMonthValue), title: money(deals.wonThisMonthValue), hint: `${deals.wonThisMonthCount} deals`, link: '/deals' })
  }
  if (leads) {
    stats.push({ label: 'Conversion rate', value: `${leads.conversionRate}%`, hint: 'Leads → converted', link: '/leads' })
  }
  if (data?.customers) {
    stats.push({ label: 'Customers', value: data.customers.total.toLocaleString('en-IN'), hint: `${data.customers.newThisMonth} new this month`, link: '/crm/customers' })
  }

  const funnel = data?.sales?.funnel ?? []
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value))

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold">Namaskaram, {user?.name} 👋</h1>
      <p className="mt-1 text-slate-500">Mee CRM lo ippudu em jarugutundo ikkada chudandi.</p>

      {error && <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(data ? stats.slice(0, 4) : Array.from({ length: 4 }, () => null)).map((s, i) => (
          <Link key={i} to={s?.link ?? '#'} className="card block p-5 transition hover:border-brand-500">
            <div className="text-sm text-slate-500">{s?.label ?? ' '}</div>
            <div className="mt-2 truncate text-2xl font-semibold tabular-nums" title={s?.title}>{s ? s.value : '…'}</div>
            <div className="mt-1 truncate text-xs text-slate-400">{s?.hint ?? ' '}</div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {funnel.length > 0 && (
          <div className="card p-6 lg:col-span-2">
            <h2 className="font-semibold">Sales funnel</h2>
            <div className="mt-5 space-y-3">
              {funnel.map((f, i) => (
                <div key={f.label} className="flex items-center gap-3">
                  <div className="w-20 text-sm text-slate-500">{f.label}</div>
                  <div className="h-8 flex-1 rounded-lg bg-slate-50">
                    <div
                      className="flex h-full items-center rounded-lg px-3 text-sm font-semibold text-white"
                      style={{ width: `${Math.max(8, (f.value / funnelMax) * 100)}%`, background: ['#3b82f6', '#8b5cf6', '#f59e0b', '#16a34a'][i] }}
                    >
                      {f.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card p-6">
          <h2 className="font-semibold">Build roadmap</h2>
          <ol className="mt-4 space-y-3 text-sm">
            {[
              ['Phase 0', 'Login, roles, audit log', true],
              ['Phase 1', 'CRM Fields + Customers', true],
              ['Phase 1', 'Leads, Deals pipeline', true],
              ['Phase 1', 'Activities, Tasks', false],
              ['Phase 2', 'Quotes, Invoices, Payments', false],
              ['Phase 3', 'Tickets, SLA, Renewals', false],
            ].map(([phase, label, done]) => (
              <li key={String(label)} className="flex items-center gap-3">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${done ? 'bg-brand-600 text-white' : 'border border-slate-300 text-slate-400'}`}>
                  {done ? '✓' : ''}
                </span>
                <span className="text-slate-400">{phase}</span>
                <span className={done ? '' : 'text-slate-500'}>{label}</span>
              </li>
            ))}
          </ol>
        </div>

        {data && data.recentActivity.length > 0 && (
          <div className="card p-6 lg:col-span-3">
            <h2 className="font-semibold">Recent activity</h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                  <span>
                    <span className="font-medium">{a.module}</span>{' '}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{a.action}</span>
                  </span>
                  <span className="text-slate-400">{new Date(a.createdAt).toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
