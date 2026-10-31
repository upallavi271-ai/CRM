import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Customer, Deal, Paged, Pipeline, Stage, UserRef } from '../lib/types'
import { dateInput, dealCode, leadCode, money, moneyShort, shortDate } from '../lib/format'
import Icon from '../components/Icon'
import Modal from '../components/Modal'

interface Board {
  pipeline: Pipeline
  deals: Deal[]
}

/** Card being dragged; x/y follow the pointer. */
interface DragState {
  deal: Deal
  x: number
  y: number
  offsetX: number
  offsetY: number
  width: number
}

export default function Deals() {
  const { can } = useAuth()
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [owner, setOwner] = useState('')
  const [editing, setEditing] = useState<Deal | { stageId: string } | null>(null)
  const [pendingLost, setPendingLost] = useState<{ deal: Deal; stage: Stage } | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(() => {
    const p = new URLSearchParams()
    if (search.trim()) p.set('search', search.trim())
    if (owner) p.set('ownerId', owner)
    api
      .get<Board>(`/deals/board?${p}`)
      .then(setBoard)
      .catch((e: Error) => setError(e.message))
  }, [search, owner])

  useEffect(load, [load])

  const byStage = useMemo(() => {
    const map = new Map<string, Deal[]>()
    board?.pipeline.stages.forEach((s) => map.set(s.id, []))
    board?.deals.forEach((d) => map.get(d.stageId)?.push(d))
    return map
  }, [board])

  const totals = useMemo(() => {
    const open = board?.deals.filter((d) => d.stage.type === 'OPEN') ?? []
    return {
      openValue: open.reduce((s, d) => s + Number(d.value), 0),
      weighted: open.reduce((s, d) => s + (Number(d.value) * d.stage.probability) / 100, 0),
      openCount: open.length,
    }
  }, [board])

  const moveDeal = async (deal: Deal, stage: Stage, lostReason?: string) => {
    if (deal.stageId === stage.id) return
    if (stage.type === 'LOST' && !lostReason) {
      setPendingLost({ deal, stage })
      return
    }
    // Optimistic: move the card right away, roll back on error
    setBoard((b) => b && { ...b, deals: b.deals.map((d) => (d.id === deal.id ? { ...d, stageId: stage.id, stage } : d)) })
    try {
      const updated = await api.patch<Deal>(`/deals/${deal.id}/stage`, { stageId: stage.id, lostReason })
      setBoard((b) => b && { ...b, deals: b.deals.map((d) => (d.id === deal.id ? updated : d)) })
    } catch (e) {
      setError((e as Error).message)
      load()
    }
  }

  // Pointer-based drag (works with mouse and pen; on touch the browser scrolls instead
  // and the drag is cancelled, so use the Stage field in the deal form there).
  const startDrag = (e: ReactPointerEvent, deal: Deal) => {
    if (e.button !== 0 || !can('Deal.Update') || !board) return
    const stages = board.pipeline.stages
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    let dragging = false
    let over: string | null = null

    const stageAt = (x: number, y: number) =>
      (document.elementFromPoint(x, y)?.closest('[data-stage-id]') as HTMLElement | null)?.dataset.stageId ?? null

    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return
      dragging = true
      ev.preventDefault()
      over = stageAt(ev.clientX, ev.clientY)
      setOverStage(over)
      setDrag({ deal, x: ev.clientX, y: ev.clientY, offsetX: startX - rect.left, offsetY: startY - rect.top, width: rect.width })
    }
    const finish = (drop: boolean) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      setDrag(null)
      setOverStage(null)
      if (!dragging) return
      // The click event that follows pointerup must not open the edit form
      suppressClick.current = true
      setTimeout(() => (suppressClick.current = false), 0)
      const stage = stages.find((s) => s.id === over)
      if (drop && stage) void moveDeal(deal, stage)
    }
    const onUp = () => finish(true)
    const onCancel = () => finish(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Deals</h1>
          <p className="mt-1 text-slate-500">
            {board ? (
              <>
                {totals.openCount} open · <b className="text-slate-700">{money(totals.openValue)}</b> pipeline · {money(Math.round(totals.weighted))} weighted
              </>
            ) : (
              'Loading…'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Icon name="search" className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input w-56 pl-9" placeholder="Search deal or customer..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          {can('Deal.ReadAll') && (
            <select className="input w-40" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">All deals</option>
              <option value="me">My deals</option>
            </select>
          )}
          {can('Deal.Create') && board && (
            <button className="btn btn-primary" onClick={() => setEditing({ stageId: board.pipeline.stages[0].id })}>
              <Icon name="plus" /> Add deal
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex justify-between rounded-lg bg-red-50 px-4 py-3 text-sm whitespace-pre-line text-red-700">
          {error}
          <button onClick={() => setError('')} aria-label="Dismiss"><Icon name="x" /></button>
        </div>
      )}

      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {board?.pipeline.stages.map((stage) => {
          const deals = byStage.get(stage.id) ?? []
          const total = deals.reduce((s, d) => s + Number(d.value), 0)
          return (
            <div
              key={stage.id}
              data-stage-id={stage.id}
              className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-slate-100/70 transition ${
                overStage === stage.id ? 'border-brand-500 bg-brand-50/60' : 'border-transparent'
              }`}
            >
              <div className="px-3 pt-3 pb-2">
                <div className="h-1 rounded-full" style={{ background: stage.color }} />
                <div className="mt-2.5 flex items-center justify-between">
                  <div className="font-semibold">
                    {stage.name} <span className="ml-1 text-sm font-normal text-slate-400">{deals.length}</span>
                  </div>
                  <div className="text-xs text-slate-500">{stage.type === 'OPEN' ? `${stage.probability}%` : ''}</div>
                </div>
                <div className="text-sm font-medium text-slate-600 tabular-nums">{moneyShort(total)}</div>
              </div>
              <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                {deals.map((d) => (
                  <DealCard
                    key={d.id}
                    deal={d}
                    dragging={drag?.deal.id === d.id}
                    onPointerDown={(e) => startDrag(e, d)}
                    onClick={() => !suppressClick.current && setEditing(d)}
                  />
                ))}
                {can('Deal.Create') && stage.type === 'OPEN' && (
                  <button className="rounded-xl py-2 text-sm text-slate-400 hover:bg-white hover:text-slate-600" onClick={() => setEditing({ stageId: stage.id })}>
                    + Add
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {drag && (
        <div
          className="pointer-events-none fixed z-50 rotate-2 shadow-xl"
          style={{ left: drag.x - drag.offsetX, top: drag.y - drag.offsetY, width: drag.width }}
        >
          <DealCard deal={drag.deal} dragging={false} />
        </div>
      )}

      {editing && board && (
        <DealForm
          deal={'id' in editing ? editing : null}
          initialStageId={editing.stageId}
          stages={board.pipeline.stages}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}

      {pendingLost && (
        <LostReasonModal
          deal={pendingLost.deal}
          onClose={() => setPendingLost(null)}
          onConfirm={(reason) => {
            const { deal, stage } = pendingLost
            setPendingLost(null)
            void moveDeal(deal, stage, reason)
          }}
        />
      )}
    </div>
  )
}

function DealCard({
  deal,
  dragging,
  onPointerDown,
  onClick,
}: {
  deal: Deal
  dragging: boolean
  onPointerDown?: (e: ReactPointerEvent) => void
  onClick?: () => void
}) {
  const overdue =
    deal.stage.type === 'OPEN' && deal.expectedCloseDate && new Date(deal.expectedCloseDate) < new Date(new Date().toDateString())
  return (
    <div
      onPointerDown={onPointerDown}
      onClick={onClick}
      className={`cursor-pointer rounded-xl select-none border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow ${
        dragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm leading-snug font-medium">{deal.title}</div>
        <span className="shrink-0 font-mono text-[10px] text-slate-400">{dealCode(deal.number)}</span>
      </div>
      {deal.customer && <div className="mt-0.5 text-xs text-slate-500">{deal.customer.name}</div>}
      <div className="mt-2 text-base font-semibold tabular-nums">{money(deal.value)}</div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={overdue ? 'font-medium text-red-600' : 'text-slate-500'}>
          {deal.stage.type === 'OPEN'
            ? deal.expectedCloseDate
              ? `${overdue ? 'Overdue · ' : ''}${shortDate(deal.expectedCloseDate)}`
              : 'No close date'
            : deal.stage.type === 'LOST'
              ? deal.lostReason
              : `Won ${shortDate(deal.closedAt)}`}
        </span>
        {deal.owner && (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600" title={deal.owner.name}>
            {deal.owner.name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  )
}

function LostReasonModal({ deal, onClose, onConfirm }: { deal: Deal; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  return (
    <Modal
      title="Deal lost — enduku?"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>Mark as lost</button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        <b>{deal.title}</b> lost ga mark chestunnam. Reason save chesthe, taruvata "enduku lose ayyam?" ani analyze cheyyochu.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {['Price too high', 'Chose a competitor', 'No budget', 'No response', 'Timeline not matching'].map((r) => (
          <button key={r} type="button" className="rounded-full border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50" onClick={() => setReason(r)}>
            {r}
          </button>
        ))}
      </div>
      <input className="input" autoFocus maxLength={500} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  )
}

function DealForm({
  deal,
  initialStageId,
  stages,
  onClose,
  onSaved,
}: {
  deal: Deal | null
  initialStageId: string
  stages: Stage[]
  onClose: () => void
  onSaved: () => void
}) {
  const { user, can } = useAuth()
  const readOnly = !!deal && !can('Deal.Update')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [users, setUsers] = useState<UserRef[]>([])
  const [form, setForm] = useState({
    title: deal?.title ?? '',
    value: deal?.value ?? '',
    stageId: deal?.stageId ?? initialStageId,
    customerId: deal?.customerId ?? '',
    ownerId: deal?.ownerId ?? user?.id ?? '',
    expectedCloseDate: dateInput(deal?.expectedCloseDate),
    notes: deal?.notes ?? '',
    lostReason: deal?.lostReason ?? '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const stage = stages.find((s) => s.id === form.stageId)

  useEffect(() => {
    if (can('Customer.Read')) {
      api.get<Paged<Customer>>('/customers?pageSize=100').then((r) => setCustomers(r.items)).catch(() => {})
    }
    api.get<UserRef[]>('/users/lookup').then(setUsers).catch(() => {})
  }, [can])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const body: Record<string, unknown> = {
      title: form.title,
      value: Number(form.value || 0),
      stageId: form.stageId,
      customerId: form.customerId || null,
      expectedCloseDate: form.expectedCloseDate || null,
      notes: form.notes,
    }
    if (stage?.type === 'LOST') body.lostReason = form.lostReason
    if (can('Deal.ReadAll')) body.ownerId = form.ownerId || null
    try {
      if (deal) await api.patch(`/deals/${deal.id}`, body)
      else await api.post('/deals', body)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!deal) return
    try {
      await api.delete(`/deals/${deal.id}`)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Modal
      title={deal ? `${dealCode(deal.number)} · ${deal.title}` : 'Add deal'}
      onClose={onClose}
      footer={
        confirmDelete ? (
          <>
            <span className="mr-auto self-center text-sm text-slate-600">Ee deal delete cheyyala?</span>
            <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>No</button>
            <button className="btn btn-danger" onClick={remove}>Yes, delete</button>
          </>
        ) : (
          <>
            {deal && can('Deal.Delete') && (
              <button type="button" className="btn mr-auto text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" /> Delete
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</button>
            {!readOnly && (
              <button type="submit" form="deal-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            )}
          </>
        )
      }
    >
      {deal?.lead && (
        <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Lead nundi convert ayyindi: {leadCode(deal.lead.number)} {deal.lead.name}
        </div>
      )}
      <form id="deal-form" onSubmit={submit}>
        <fieldset disabled={readOnly} className="space-y-4">
          <Field label="Title *" id="d-title">
            <input id="d-title" className="input" required maxLength={200} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Ramesh Home Interior" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Value (₹) *" id="d-value">
              <input id="d-value" type="number" min={0} step="0.01" required className="input" value={form.value} onChange={(e) => set('value', e.target.value)} />
            </Field>
            <Field label="Stage" id="d-stage">
              <select id="d-stage" className="input" value={form.stageId} onChange={(e) => set('stageId', e.target.value)}>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.type === 'OPEN' ? ` (${s.probability}%)` : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {stage?.type === 'LOST' && (
            <Field label="Lost reason *" id="d-lost">
              <input id="d-lost" className="input" required maxLength={500} value={form.lostReason} onChange={(e) => set('lostReason', e.target.value)} />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer" id="d-customer">
              <select id="d-customer" className="input" value={form.customerId} onChange={(e) => set('customerId', e.target.value)}>
                <option value="">— None —</option>
                {deal?.customer && !customers.some((c) => c.id === deal.customer?.id) && (
                  <option value={deal.customer.id}>{deal.customer.name}</option>
                )}
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Expected close date" id="d-date">
              <input id="d-date" type="date" className="input" value={form.expectedCloseDate} onChange={(e) => set('expectedCloseDate', e.target.value)} />
            </Field>
          </div>
          <Field label="Owner" id="d-owner">
            <select id="d-owner" className="input" value={form.ownerId} disabled={!can('Deal.ReadAll')} onChange={(e) => set('ownerId', e.target.value)}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Notes" id="d-notes">
            <textarea id="d-notes" className="input min-h-20" maxLength={2000} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </fieldset>
        {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm whitespace-pre-line text-red-700">{error}</div>}
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
