import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import Icon from './Icon'

interface NavItem {
  to: string
  label: string
  icon: string
  permission?: string
  soon?: boolean
}

const NAV: { section: string; items: NavItem[] }[] = [
  { section: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: 'dashboard' }] },
  {
    section: 'Sales',
    items: [
      { to: '/leads', label: 'Leads', icon: 'funnel', permission: 'Lead.Read' },
      { to: '/deals', label: 'Deals', icon: 'briefcase', permission: 'Deal.Read' },
    ],
  },
  {
    section: 'CRM',
    items: [
      { to: '/crm/fields', label: 'CRM Fields', icon: 'tag', permission: 'CustomField.Read' },
      { to: '/crm/customers', label: 'All Customers', icon: 'users', permission: 'Customer.Read' },
    ],
  },
  {
    section: 'Coming next',
    items: [
      { to: '/tickets', label: 'Tickets', icon: 'ticket', permission: 'Ticket.Read', soon: true },
    ],
  },
]

export default function Layout() {
  const { user, can, logout } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-slate-200 transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 font-bold text-white">C</div>
          <div>
            <div className="font-semibold text-white">CRM</div>
            <div className="text-xs text-emerald-300/80">Customer management</div>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
          {NAV.map((group) => {
            const items = group.items.filter((i) => !i.permission || can(i.permission))
            if (!items.length) return null
            return (
              <div key={group.section}>
                <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-200/50">
                  {group.section}
                </div>
                <div className="space-y-1">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition ${
                          isActive ? 'bg-brand-600 font-medium text-white' : 'hover:bg-sidebar-hover'
                        }`
                      }
                    >
                      <Icon name={item.icon} className="h-[18px] w-[18px]" />
                      <span className="flex-1">{item.label}</span>
                      {item.soon && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-emerald-100/70">soon</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white">
              {user?.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{user?.name}</div>
              <div className="truncate text-xs text-emerald-200/60">{user?.role}</div>
            </div>
            <button onClick={logout} className="rounded-lg p-2 hover:bg-sidebar-hover" title="Logout">
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Open menu">
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <span className="font-semibold">CRM</span>
        </header>
        <main className="flex-1 p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
