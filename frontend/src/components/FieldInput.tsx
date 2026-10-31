import type { CustomField, CustomValue } from '../lib/types'

/** Renders the right input for a CRM field type. */
export default function FieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomField
  value: CustomValue | undefined
  onChange: (value: CustomValue) => void
}) {
  const id = `cf-${field.key}`
  switch (field.type) {
    case 'BOOLEAN':
      return (
        <select id={id} className="input" value={value === true ? 'true' : value === false ? 'false' : ''} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'true')}>
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      )
    case 'SELECT':
      return (
        <select id={id} className="input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">— Select —</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    default:
      return (
        <input
          id={id}
          className="input"
          type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : field.type === 'EMAIL' ? 'email' : field.type === 'PHONE' ? 'tel' : 'text'}
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}
