import type { CustomField, CustomValue } from './types'

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

/** ₹5,00,000 */
export const money = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === '' ? '—' : inr.format(Number(value))

/** ₹5L, ₹1.2Cr: for tight spaces like column headers */
export function moneyShort(value: number | string) {
  const n = Number(value)
  if (n >= 1e7) return `₹${+(n / 1e7).toFixed(2)}Cr`
  if (n >= 1e5) return `₹${+(n / 1e5).toFixed(1)}L`
  if (n >= 1e3) return `₹${+(n / 1e3).toFixed(1)}K`
  return `₹${n}`
}

export const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

/** "2026-12-15T00:00:00.000Z" -> "2026-12-15" for <input type="date"> */
export const dateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '')

export const leadCode = (n: number) => `L-${String(n).padStart(4, '0')}`
export const dealCode = (n: number) => `D-${String(n).padStart(4, '0')}`

export function formatValue(field: CustomField, value: CustomValue | undefined) {
  if (value === null || value === undefined || value === '') return '—'
  if (field.type === 'BOOLEAN') return value ? 'Yes' : 'No'
  if (field.type === 'NUMBER' && typeof value === 'number') return value.toLocaleString('en-IN')
  return String(value)
}
