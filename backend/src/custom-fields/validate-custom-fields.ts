import { CustomFieldType } from '@prisma/client';

export interface FieldDef {
  key: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
  options: string[];
}

export type CustomValues = Record<string, string | number | boolean | null>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s()-]{4,19}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks custom field values against the field definitions and converts them to the right type.
 * partial = true for updates: missing keys are left alone, but required fields still can't be cleared.
 */
export function validateCustomFieldValues(
  defs: FieldDef[],
  input: Record<string, unknown>,
  partial: boolean,
): { values: CustomValues; errors: string[] } {
  const values: CustomValues = {};
  const errors: string[] = [];
  const byKey = new Map(defs.map((d) => [d.key, d]));

  for (const key of Object.keys(input)) {
    if (!byKey.has(key)) errors.push(`Unknown field "${key}"`);
  }

  for (const def of defs) {
    const raw = input[def.key];
    if (raw === undefined) {
      if (def.required && !partial) errors.push(`${def.name} is required`);
      continue;
    }
    if (raw === null || raw === '') {
      if (def.required) errors.push(`${def.name} is required`);
      else values[def.key] = null;
      continue;
    }

    const result = coerce(def, raw);
    if (result.ok) values[def.key] = result.value;
    else errors.push(result.error);
  }

  return { values, errors };
}

type Coerced =
  { ok: true; value: string | number | boolean } | { ok: false; error: string };

const ok = (value: string | number | boolean): Coerced => ({ ok: true, value });
const fail = (error: string): Coerced => ({ ok: false, error });

function coerce(def: FieldDef, raw: unknown): Coerced {
  switch (def.type) {
    case 'TEXT':
      return typeof raw === 'string'
        ? ok(raw.trim())
        : fail(`${def.name} must be text`);
    case 'NUMBER': {
      const n =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string'
            ? Number(raw)
            : NaN;
      return Number.isFinite(n) ? ok(n) : fail(`${def.name} must be a number`);
    }
    case 'BOOLEAN':
      if (typeof raw === 'boolean') return ok(raw);
      if (raw === 'true' || raw === 'false') return ok(raw === 'true');
      return fail(`${def.name} must be true or false`);
    case 'DATE':
      return typeof raw === 'string' &&
        DATE_RE.test(raw) &&
        !Number.isNaN(Date.parse(raw))
        ? ok(raw)
        : fail(`${def.name} must be a date (YYYY-MM-DD)`);
    case 'SELECT':
      return typeof raw === 'string' && def.options.includes(raw)
        ? ok(raw)
        : fail(`${def.name} must be one of: ${def.options.join(', ')}`);
    case 'EMAIL':
      return typeof raw === 'string' && EMAIL_RE.test(raw.trim())
        ? ok(raw.trim().toLowerCase())
        : fail(`${def.name} must be a valid email`);
    case 'PHONE':
      return typeof raw === 'string' && PHONE_RE.test(raw.trim())
        ? ok(raw.trim())
        : fail(`${def.name} must be a valid phone number`);
  }
}

/** "Lifetime Value" -> "lifetime_value" */
export function toFieldKey(name: string): string {
  const key = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z]/.test(key) ? key : `f_${key}`;
}
