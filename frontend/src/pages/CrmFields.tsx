import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { FIELD_TYPE_LABELS } from '../lib/types'
import type { CustomField, CustomFieldType } from '../lib/types'
import Icon from '../components/Icon'
import Modal from '../components/Modal'

const COLORS = ['#3b82f6', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b']

const toKey = (name: string) => {
  const k = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return k && !/^[a-z]/.test(k) ? `f_${k}` : k
}

export default function CrmFields() {
  const { can } = useAuth()
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | CustomFieldType>('')
  const [sort, setSort] = useState<'order' | 'name'>('order')
  const [editing, setEditing] = useState<CustomField | 'new' | null>(null)
  const [deleting, setDeleting] = useState<CustomField | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    api
      .get<CustomField[]>('/custom-fields')
      .then(setFields)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = fields.filter(
      (f) => (!typeFilter || f.type === typeFilter) && (!q || f.name.toLowerCase().includes(q) || f.key.includes(q)),
    )
    return sort === 'name' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list
  }, [fields, search, typeFilter, sort])

  const canReorder = can('CustomField.Update') && sort === 'order' && !search && !typeFilter

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...fields]
    const [item] = next.splice(index, 1)
    next.splice(index + dir, 0, item)
    setFields(next)
    try {
      setFields(await api.post<CustomField[]>('/custom-fields/reorder', { ids: next.map((f) => f.id) }))
    } catch (e) {
      setError((e as Error).message)
      load()
    }
  }

  const remove = async () => {
    if (!deleting) return
    try {
      await api.delete(`/custom-fields/${deleting.id}`)
      setDeleting(null)
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">CRM Fields</h1>
          <p className="mt-1 text-slate-500">
            Custom fields on your customer records — shown in the customer form, table, filters and exports.
          </p>
        </div>
        {can('CustomField.Create') && (
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Icon name="plus" /> New field
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 flex justify-between rounded-lg bg-red-50 px-4 py-3 text-sm whitespace-pre-line text-red-700">
          {error}
          <button onClick={() => setError('')} aria-label="Dismiss">
            <Icon name="x" />
          </button>
        </div>
      )}

      <div className="card mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Icon name="search" className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search fields..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input sm:w-52" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as CustomFieldType | '')}>
            <option value="">All types</option>
            {Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select className="input sm:w-48" value={sort} onChange={(e) => setSort(e.target.value as 'order' | 'name')}>
            <option value="order">Display order</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="th w-24">Order</th>
                <th className="th">Name</th>
                <th className="th">Key</th>
                <th className="th">Type</th>
                <th className="th">Required</th>
                <th className="th w-24 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td className="td text-slate-400" colSpan={6}>Loading…</td>
                </tr>
              )}
              {!loading && visible.length === 0 && (
                <tr>
                  <td className="td py-10 text-center text-slate-400" colSpan={6}>
                    {fields.length === 0 ? 'Inka fields levu. "New field" click cheyyandi.' : 'Ee filter ki fields levu.'}
                  </td>
                </tr>
              )}
              {visible.map((f) => {
                const index = fields.indexOf(f)
                return (
                  <tr key={f.id} className="hover:bg-slate-50/60">
                    <td className="td">
                      <div className="flex gap-1 text-slate-400">
                        <button className="rounded p-1 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent" disabled={!canReorder || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${f.name} up`}>
                          <Icon name="up" />
                        </button>
                        <button className="rounded p-1 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent" disabled={!canReorder || index === fields.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${f.name} down`}>
                          <Icon name="down" />
                        </button>
                      </div>
                    </td>
                    <td className="td font-medium">
                      <span className="mr-2.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: f.color }} />
                      {f.name}
                    </td>
                    <td className="td font-mono text-[13px] text-slate-600">{f.key}</td>
                    <td className="td">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">{FIELD_TYPE_LABELS[f.type]}</span>
                    </td>
                    <td className="td text-slate-500">{f.required ? 'Yes' : 'No'}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1 text-slate-400">
                        {can('CustomField.Update') && (
                          <button className="rounded p-1.5 hover:bg-slate-100 hover:text-slate-700" onClick={() => setEditing(f)} aria-label={`Edit ${f.name}`}>
                            <Icon name="edit" />
                          </button>
                        )}
                        {can('CustomField.Delete') && (
                          <button className="rounded p-1.5 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleting(f)} aria-label={`Delete ${f.name}`}>
                            <Icon name="trash" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <FieldForm
          field={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}

      {deleting && (
        <Modal
          title="Delete field?"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDeleting(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={remove}>Delete</button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            <b>{deleting.name}</b> field customer form, table nundi remove avtundi. Already save chesina values database lo safe ga untayi (soft delete).
          </p>
        </Modal>
      )}
    </div>
  )
}

function FieldForm({ field, onClose, onSaved }: { field: CustomField | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(field?.name ?? '')
  const [key, setKey] = useState(field?.key ?? '')
  const [keyTouched, setKeyTouched] = useState(false)
  const [type, setType] = useState<CustomFieldType>(field?.type ?? 'TEXT')
  const [options, setOptions] = useState((field?.options ?? []).join('\n'))
  const [required, setRequired] = useState(field?.required ?? false)
  const [color, setColor] = useState(field?.color ?? COLORS[0])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const body = {
      name,
      type,
      required,
      color,
      options: type === 'SELECT' ? options.split('\n').map((o) => o.trim()).filter(Boolean) : [],
    }
    try {
      if (field) await api.patch(`/custom-fields/${field.id}`, body)
      else await api.post('/custom-fields', { ...body, key: key || undefined })
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={field ? 'Edit field' : 'New field'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="field-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="field-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="f-name">Name</label>
          <input
            id="f-name"
            className="input"
            required
            maxLength={80}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (!field && !keyTouched) setKey(toKey(e.target.value))
            }}
            placeholder="e.g. Lifetime Value"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="f-key">Key</label>
          <input
            id="f-key"
            className="input font-mono"
            value={key}
            disabled={!!field}
            pattern="[a-z][a-z0-9_]*"
            onChange={(e) => {
              setKeyTouched(true)
              setKey(e.target.value)
            }}
          />
          <p className="mt-1 text-xs text-slate-500">
            {field ? 'Key create chesaka marchalemu (imports, API lo vadutham).' : 'Lowercase letters, numbers, _ matrame. Imports, exports, API lo ide vadutham.'}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="f-type">Type</label>
          <select id="f-type" className="input" value={type} disabled={!!field} onChange={(e) => setType(e.target.value as CustomFieldType)}>
            {Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        {type === 'SELECT' && (
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="f-options">Options (okko line ki okati)</label>
            <textarea id="f-options" className="input min-h-24" value={options} onChange={(e) => setOptions(e.target.value)} placeholder={'Website\nGoogle Ads\nReferral'} />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required field (customer save chesetappudu tappanisari)
        </label>
        <div>
          <div className="mb-2 text-sm font-medium">Color</div>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full ring-offset-2 ${color === c ? 'ring-2 ring-slate-400' : ''}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm whitespace-pre-line text-red-700">{error}</div>}
      </form>
    </Modal>
  )
}
