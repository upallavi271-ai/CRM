import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Customer, CustomField, CustomValue, Paged } from '../lib/types'
import Icon from '../components/Icon'
import Modal from '../components/Modal'
import FieldInput from '../components/FieldInput'
import { formatValue } from '../lib/format'

const PAGE_SIZE = 20

export default function Customers() {
  const { can } = useAuth()
  const [fields, setFields] = useState<CustomField[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [data, setData] = useState<Paged<Customer> | null>(null)
  const [error, setError] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [tag, setTag] = useState('')
  const [cfKey, setCfKey] = useState('')
  const [cfValue, setCfValue] = useState('')
  const [page, setPage] = useState(1)

  const [editing, setEditing] = useState<Customer | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Customer | null>(null)

  // Debounce typing in the search box
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const filterParams = useMemo(() => {
    const p = new URLSearchParams()
    if (search.trim()) p.set('search', search.trim())
    if (status) p.set('status', status)
    if (tag) p.set('tag', tag)
    if (cfKey && cfValue.trim()) p.set(`cf_${cfKey}`, cfValue.trim())
    return p
  }, [search, status, tag, cfKey, cfValue])

  const load = useCallback(() => {
    const p = new URLSearchParams(filterParams)
    p.set('page', String(page))
    p.set('pageSize', String(PAGE_SIZE))
    api
      .get<Paged<Customer>>(`/customers?${p}`)
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [filterParams, page])

  const loadMeta = useCallback(() => {
    api.get<CustomField[]>('/custom-fields').then(setFields).catch((e: Error) => setError(e.message))
    api.get<string[]>('/customers/tags').then(setTags).catch(() => {})
  }, [])

  useEffect(loadMeta, [loadMeta])
  useEffect(load, [load])

  const filterField = fields.find((f) => f.key === cfKey)
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  const exportCsv = () =>
    api.download(`/customers/export?${filterParams}`, 'customers.csv').catch((e: Error) => setError(e.message))

  const remove = async () => {
    if (!deleting) return
    try {
      await api.delete(`/customers/${deleting.id}`)
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
          <h1 className="text-2xl font-semibold">All Customers</h1>
          <p className="mt-1 text-slate-500">{data ? `${data.total.toLocaleString('en-IN')} customers` : 'Loading…'}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={exportCsv}>
            <Icon name="download" /> Export CSV
          </button>
          {can('Customer.Create') && (
            <button className="btn btn-primary" onClick={() => setEditing('new')}>
              <Icon name="plus" /> Add customer
            </button>
          )}
        </div>
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
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="relative">
            <Icon name="search" className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search name, email, phone..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </div>
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select className="input" value={tag} onChange={(e) => { setTag(e.target.value); setPage(1) }}>
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select className="input" value={cfKey} onChange={(e) => { setCfKey(e.target.value); setCfValue(''); setPage(1) }}>
            <option value="">Filter by field…</option>
            {fields.map((f) => (
              <option key={f.key} value={f.key}>{f.name}</option>
            ))}
          </select>
          {filterField ? (
            <FilterValueInput field={filterField} value={cfValue} onChange={(v) => { setCfValue(v); setPage(1) }} />
          ) : (
            <input className="input" disabled placeholder="Value" />
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="th">Name</th>
                <th className="th">Phone</th>
                <th className="th">Status</th>
                <th className="th">Tags</th>
                {fields.map((f) => (
                  <th key={f.id} className="th whitespace-nowrap">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: f.color }} />
                    {f.name}
                  </th>
                ))}
                <th className="th w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.length === 0 && (
                <tr>
                  <td className="td py-10 text-center text-slate-400" colSpan={5 + fields.length}>
                    Customers dorakaledu.
                  </td>
                </tr>
              )}
              {data?.items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="td">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.email ?? '—'}</div>
                  </td>
                  <td className="td whitespace-nowrap text-slate-600">{c.phone ?? '—'}</td>
                  <td className="td">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.status === 'ACTIVE' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <span key={t} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t}</span>
                      ))}
                    </div>
                  </td>
                  {fields.map((f) => (
                    <td key={f.id} className="td whitespace-nowrap text-slate-600">{formatValue(f, c.customFields[f.key])}</td>
                  ))}
                  <td className="td">
                    <div className="flex justify-end gap-1 text-slate-400">
                      {can('Customer.Update') && (
                        <button className="rounded p-1.5 hover:bg-slate-100 hover:text-slate-700" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                          <Icon name="edit" />
                        </button>
                      )}
                      {can('Customer.Delete') && (
                        <button className="rounded p-1.5 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`}>
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
        <CustomerForm
          customer={editing === 'new' ? null : editing}
          fields={fields}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
            loadMeta()
          }}
        />
      )}

      {deleting && (
        <Modal
          title="Delete customer?"
          onClose={() => setDeleting(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDeleting(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={remove}>Delete</button>
            </>
          }
        >
          <p className="text-sm text-slate-600">
            <b>{deleting.name}</b> list nundi remove avtaru. Record audit log tho database lo untundi (soft delete).
          </p>
        </Modal>
      )}
    </div>
  )
}

function FilterValueInput({ field, value, onChange }: { field: CustomField; value: string; onChange: (v: string) => void }) {
  if (field.type === 'SELECT' || field.type === 'BOOLEAN') {
    const options = field.type === 'BOOLEAN' ? [['true', 'Yes'], ['false', 'No']] : field.options.map((o) => [o, o])
    return (
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Any</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    )
  }
  return (
    <input
      className="input"
      type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'}
      placeholder={field.type === 'NUMBER' ? 'Exact value' : 'Contains…'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function CustomerForm({
  customer,
  fields,
  onClose,
  onSaved,
}: {
  customer: Customer | null
  fields: CustomField[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(customer?.name ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [status, setStatus] = useState(customer?.status ?? 'ACTIVE')
  const [tags, setTags] = useState((customer?.tags ?? []).join(', '))
  const [values, setValues] = useState<Record<string, CustomValue>>(() => {
    const v: Record<string, CustomValue> = {}
    for (const f of fields) v[f.key] = customer?.customFields[f.key] ?? null
    return v
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const body = {
      name,
      email,
      phone,
      status,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      customFields: values,
    }
    try {
      if (customer) await api.patch(`/customers/${customer.id}`, body)
      else await api.post('/customers', body)
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={customer ? 'Edit customer' : 'Add customer'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="customer-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="customer-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="c-name">Name *</label>
          <input id="c-name" className="input" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="c-email">Email</label>
            <input id="c-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="c-phone">Phone</label>
            <input id="c-phone" type="tel" className="input" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="c-status">Status</label>
            <select id="c-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as Customer['status'])}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="c-tags">Tags</label>
            <input id="c-tags" className="input" placeholder="VIP, Referral" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
        </div>

        {fields.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <div className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">CRM Fields</div>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.id}>
                  <label className="mb-1 block text-sm font-medium" htmlFor={`cf-${f.key}`}>
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: f.color }} />
                    {f.name}
                    {f.required && ' *'}
                  </label>
                  <FieldInput field={f} value={values[f.key]} onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))} />
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm whitespace-pre-line text-red-700">{error}</div>}
      </form>
    </Modal>
  )
}
