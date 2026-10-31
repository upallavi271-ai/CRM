import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { LEAD_STATUS_META } from '../lib/types'
import type { Lead, LeadList, LeadStatus, Pipeline, UserRef } from '../lib/types'
import { dealCode, leadCode, money, shortDate } from '../lib/format'
import Icon from '../components/Icon'
import Modal from '../components/Modal'

const PAGE_SIZE = 20
const TABS: ('' | LeadStatus)[] = ['', 'NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED']
const EDITABLE_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED']

export default function Leads() {
  const { can } = useAuth()
  const [data, setData] = useState<LeadList | null>(null)
  const [sources, setSources] = useState<string[]>([])
  const [users, setUsers] = useState<UserRef[]>([])
  const [error, setError] = useState('')

  const [status, setStatus] = useState<'' | LeadStatus>('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [page, setPage] = useState(1)

  const [editing, setEditing] = useState<Lead | 'new' | null>(null)
  const [converting, setConverting] = useState<Lead | null>(null)
  const [deleting, setDeleting] = useState<Lead | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (status) p.set('status', status)
    if (search.trim()) p.set('search', search.trim())
    if (source) p.set('source', source)
    if (assignedTo) p.set('assignedTo', assignedTo)
    api
      .get<LeadList>(`/leads?${p}`)
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [page, status, search, source, assignedTo])

  useEffect(load, [load])
  useEffect(() => {
    api.get<string[]>('/leads/sources').then(setSources).catch(() => {})
    api.get<UserRef[]>('/users/lookup').then(setUsers).catch(() => {})
  }, [])

  const allCount = useMemo(
    () => Object.values(data?.statusCounts ?? {}).reduce((a, b) => a + (b ?? 0), 0),
    [data],
  )
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  const remove = async () => {
    if (!deleting) return
    try {
      await api.delete(`/leads/${deleting.id}`)
      setDeleting(null)
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="mt-1 text-slate-500">
            {can('Lead.ReadAll') ? 'Team lo anni leads' : 'Meeku assign chesina leads'} — qualify chesi, deal ga convert cheyyandi.
          </p>
        </div>
        {can('Lead.Create') && (
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Icon name="plus" /> Add lead
          </button>
        )}
      </div>

      {error && <ErrorBar message={error} onClose={() => setError('')} />}

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200 [scrollbar-width:none]">
        {TABS.map((t) => {
          const count = t ? (data?.statusCounts[t] ?? 0) : allCount
          const active = status === t
          return (
            <button
              key={t || 'all'}
              onClick={() => {
                setStatus(t)
                setPage(1)
              }}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm whitespace-nowrap transition ${
                active ? 'border-brand-600 font-medium text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t ? LEAD_STATUS_META[t].label : 'All'}
              <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-brand-50' : 'bg-slate-100'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      <div className="card mt-4 overflow-hidden">
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 md:grid-cols-[2fr_1fr_1fr]">
          <div className="relative">
            <Icon name="search" className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search name, phone, email, company..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <select className="input" value={source} onChange={(e) => { setSource(e.target.value); setPage(1) }}>
            <option value="">All sources</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {can('Lead.ReadAll') ? (
            <select className="input" value={assignedTo} onChange={(e) => { setAssignedTo(e.target.value); setPage(1) }}>
              <option value="">Everyone</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          ) : (
            <div />
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="th">Lead</th>
                <th className="th">Contact</th>
                <th className="th">Source</th>
                <th className="th">Status</th>
                <th className="th">Score</th>
                <th className="th text-right">Est. value</th>
                <th className="th">Assigned to</th>
                <th className="th">Created</th>
                <th className="th w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.length === 0 && (
                <tr>
                  <td className="td py-10 text-center text-slate-400" colSpan={9}>Leads dorakaledu.</td>
                </tr>
              )}
              {data?.items.map((l) => (
                <tr key={l.id} className="cursor-pointer hover:bg-slate-50/60" onClick={() => setEditing(l)}>
                  <td className="td">
                    <div className="font-medium whitespace-nowrap">{l.name}</div>
                    <div className="text-xs whitespace-nowrap text-slate-500">
                      <span className="font-mono">{leadCode(l.number)}</span>
                      {l.company && ` · ${l.company}`}
                    </div>
                  </td>
                  <td className="td text-slate-600">
                    <div className="whitespace-nowrap">{l.phone ?? '—'}</div>
                    <div className="text-xs text-slate-500">{l.email ?? ''}</div>
                  </td>
                  <td className="td text-slate-600">{l.source}</td>
                  <td className="td"><StatusBadge status={l.status} /></td>
                  <td className="td"><ScoreBar score={l.score} /></td>
                  <td className="td text-right whitespace-nowrap tabular-nums">{money(l.estimatedValue)}</td>
                  <td className="td whitespace-nowrap text-slate-600">{l.assignedTo?.name ?? <span className="text-amber-600">Unassigned</span>}</td>
                  <td className="td whitespace-nowrap text-slate-500">{shortDate(l.createdAt)}</td>
                  <td className="td" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1 text-slate-400">
                      {can('Lead.Convert') && (l.status === 'NEW' || l.status === 'CONTACTED' || l.status === 'QUALIFIED') && (
                        <button className="rounded-lg border border-brand-600 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50" onClick={() => setConverting(l)}>
                          Convert
                        </button>
                      )}
                      {can('Lead.Delete') && (
                        <button className="rounded p-1.5 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleting(l)} aria-label={`Delete ${l.name}`}>
                          <Icon name="trash" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <LeadForm
          lead={editing === 'new' ? null : editing}
          sources={sources}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
          onConvert={(l) => {
            setEditing(null)
            setConverting(l)
          }}
        />
      )}

      {converting && (
        <ConvertForm
          lead={converting}
          onClose={() => setConverting(null)}
          onDone={() => {
            setConverting(null)
            load()
          }}
        />
      )}

      {deleting && (
        <Modal
          title="Delete lead?"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDeleting(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={remove}>Delete</button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            <b>{deleting.name}</b> list nundi remove avtundi. Record database lo audit log tho untundi (soft delete).
          </p>
        </Modal>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const meta = LEAD_STATUS_META[status]
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${meta.className}`}>{meta.label}</span>
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-brand-600' : score >= 40 ? 'bg-amber-500' : 'bg-slate-300'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-slate-500 tabular-nums">{score}</span>
    </div>
  )
}

function ErrorBar({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="mt-4 flex justify-between rounded-lg bg-red-50 px-4 py-3 text-sm whitespace-pre-line text-red-700">
      {message}
      <button onClick={onClose} aria-label="Dismiss"><Icon name="x" /></button>
    </div>
  )
}

function LeadForm({
  lead,
  sources,
  users,
  onClose,
  onSaved,
  onConvert,
}: {
  lead: Lead | null
  sources: string[]
  users: UserRef[]
  onClose: () => void
  onSaved: () => void
  onConvert: (lead: Lead) => void
}) {
  const { user, can } = useAuth()
  const converted = lead?.status === 'CONVERTED'
  const readOnly = !!lead && !can('Lead.Update')
  const [form, setForm] = useState({
    name: lead?.name ?? '',
    email: lead?.email ?? '',
    phone: lead?.phone ?? '',
    company: lead?.company ?? '',
    source: lead?.source ?? 'Website',
    status: (lead?.status ?? 'NEW') as LeadStatus,
    disqualifyReason: lead?.disqualifyReason ?? '',
    score: lead?.score ?? 0,
    estimatedValue: lead?.estimatedValue ?? '',
    requirement: lead?.requirement ?? '',
    assignedToId: lead ? (lead.assignedToId ?? '') : can('Lead.Assign') ? '' : (user?.id ?? ''),
  })
  const [detail, setDetail] = useState<Lead | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Converted leads: fetch links to the customer and deal
  useEffect(() => {
    if (lead && converted) api.get<Lead>(`/leads/${lead.id}`).then(setDetail).catch(() => {})
  }, [lead, converted])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const body: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      company: form.company,
      source: form.source,
      score: Number(form.score),
      estimatedValue: form.estimatedValue === '' ? null : Number(form.estimatedValue),
      requirement: form.requirement,
    }
    if (!converted) {
      body.status = form.status
      if (form.status === 'DISQUALIFIED') body.disqualifyReason = form.disqualifyReason
    }
    if (can('Lead.Assign')) body.assignedToId = form.assignedToId || null
    try {
      if (lead) await api.patch(`/leads/${lead.id}`, body)
      else await api.post('/leads', body)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={lead ? `${leadCode(lead.number)} · ${lead.name}` : 'Add lead'}
      onClose={onClose}
      footer={
        <>
          {lead && !converted && lead.status !== 'DISQUALIFIED' && can('Lead.Convert') && (
            <button type="button" className="btn btn-secondary mr-auto" onClick={() => onConvert(lead)}>Convert to deal</button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</button>
          {!readOnly && (
            <button type="submit" form="lead-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          )}
        </>
      }
    >
      {converted && (
        <div className="mb-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">
          ✓ {shortDate(lead?.convertedAt)} na convert ayyindi.
          {detail?.convertedCustomer && <> Customer: <Link className="font-medium underline" to="/crm/customers">{detail.convertedCustomer.name}</Link>.</>}
          {detail?.deals?.map((d) => (
            <span key={d.id}> Deal: <Link className="font-medium underline" to="/deals">{dealCode(d.number)} {d.title}</Link>.</span>
          ))}
        </div>
      )}
      <form id="lead-form" onSubmit={submit} className="space-y-4">
        <fieldset disabled={readOnly} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name *" id="l-name">
              <input id="l-name" className="input" required maxLength={200} value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Company" id="l-company">
              <input id="l-company" className="input" maxLength={200} value={form.company} onChange={(e) => set('company', e.target.value)} />
            </Field>
            <Field label="Phone" id="l-phone">
              <input id="l-phone" type="tel" className="input" maxLength={30} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Email" id="l-email">
              <input id="l-email" type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Source" id="l-source">
              <select id="l-source" className="input" value={form.source} onChange={(e) => set('source', e.target.value)}>
                {sources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Status" id="l-status">
              <select id="l-status" className="input" value={form.status} disabled={converted} onChange={(e) => set('status', e.target.value as LeadStatus)}>
                {(converted ? (['CONVERTED'] as LeadStatus[]) : EDITABLE_STATUSES).map((s) => (
                  <option key={s} value={s}>{LEAD_STATUS_META[s].label}</option>
                ))}
              </select>
            </Field>
          </div>
          {form.status === 'DISQUALIFIED' && (
            <Field label="Disqualify reason *" id="l-reason">
              <input id="l-reason" className="input" required maxLength={500} placeholder="e.g. Budget too low" value={form.disqualifyReason} onChange={(e) => set('disqualifyReason', e.target.value)} />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Lead score: ${form.score}`} id="l-score">
              <input id="l-score" type="range" min={0} max={100} step={5} className="w-full accent-brand-600" value={form.score} onChange={(e) => set('score', Number(e.target.value))} />
            </Field>
            <Field label="Estimated value (₹)" id="l-value">
              <input id="l-value" type="number" min={0} step="0.01" className="input" value={form.estimatedValue} onChange={(e) => set('estimatedValue', e.target.value)} />
            </Field>
          </div>
          <Field label="Assigned to" id="l-assignee">
            <select id="l-assignee" className="input" value={form.assignedToId} disabled={!can('Lead.Assign')} onChange={(e) => set('assignedToId', e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Requirement / notes" id="l-req">
            <textarea id="l-req" className="input min-h-20" maxLength={2000} value={form.requirement} onChange={(e) => set('requirement', e.target.value)} placeholder="Customer em adigaru, budget, timeline..." />
          </Field>
        </fieldset>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm whitespace-pre-line text-red-700">{error}</div>}
      </form>
    </Modal>
  )
}

function ConvertForm({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const [stages, setStages] = useState<Pipeline['stages']>([])
  const [createDeal, setCreateDeal] = useState(true)
  const [dealTitle, setDealTitle] = useState(lead.requirement ? `${lead.name} – ${lead.requirement}`.slice(0, 200) : `${lead.name} deal`)
  const [dealValue, setDealValue] = useState(lead.estimatedValue ?? '')
  const [stageId, setStageId] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ customer: { name: string }; deal: { number: number; title: string } | null; reusedCustomer: boolean } | null>(null)

  useEffect(() => {
    api
      .get<Pipeline[]>('/pipelines')
      .then((ps) => {
        const open = (ps[0]?.stages ?? []).filter((s) => s.type === 'OPEN')
        setStages(open)
        setStageId(open[0]?.id ?? '')
      })
      .catch(() => setCreateDeal(false))
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = createDeal
        ? { createDeal, dealTitle, dealValue: Number(dealValue || 0), stageId: stageId || undefined, expectedCloseDate: closeDate || undefined }
        : { createDeal }
      setResult(await api.post(`/leads/${lead.id}/convert`, body))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <Modal title="Lead converted 🎉" onClose={onDone} footer={<button className="btn btn-primary" onClick={onDone}>Done</button>}>
        <ul className="space-y-2 text-sm">
          <li>✓ Customer {result.reusedCustomer ? 'already undi, link chesam' : 'create ayyindi'}: <b>{result.customer.name}</b></li>
          {result.deal && <li>✓ Deal create ayyindi: <b>{dealCode(result.deal.number)} {result.deal.title}</b> — <Link to="/deals" className="text-brand-700 underline">Deals board lo chudandi</Link></li>}
          <li>✓ Lead status: Converted</li>
        </ul>
      </Modal>
    )
  }

  return (
    <Modal
      title={`Convert ${lead.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="convert-form" className="btn btn-primary" disabled={busy}>{busy ? 'Converting…' : 'Convert'}</button>
        </>
      }
    >
      <form id="convert-form" onSubmit={submit} className="space-y-4">
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Ee lead nundi <b>Customer</b> create avutundi. Same email/phone tho customer already unte, kotha duplicate create cheyyakunda adhe customer ki link chestam.
        </p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={createDeal} onChange={(e) => setCreateDeal(e.target.checked)} />
          Deal kuda create cheyyi
        </label>
        {createDeal && (
          <div className="space-y-4">
            <Field label="Deal title *" id="cv-title">
              <input id="cv-title" className="input" required maxLength={200} value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Value (₹) *" id="cv-value">
                <input id="cv-value" type="number" min={0} step="0.01" required className="input" value={dealValue} onChange={(e) => setDealValue(e.target.value)} />
              </Field>
              <Field label="Starting stage" id="cv-stage">
                <select id="cv-stage" className="input" value={stageId} onChange={(e) => setStageId(e.target.value)}>
                  {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Expected close date" id="cv-date">
              <input id="cv-date" type="date" className="input" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
            </Field>
          </div>
        )}
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm whitespace-pre-line text-red-700">{error}</div>}
      </form>
    </Modal>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium" htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}
