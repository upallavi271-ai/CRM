import {
  FieldDef,
  toFieldKey,
  validateCustomFieldValues,
} from './validate-custom-fields';

const defs: FieldDef[] = [
  { key: 'city', name: 'City', type: 'TEXT', required: true, options: [] },
  {
    key: 'ltv',
    name: 'Lifetime Value',
    type: 'NUMBER',
    required: false,
    options: [],
  },
  {
    key: 'source',
    name: 'Source',
    type: 'SELECT',
    required: false,
    options: ['Website', 'Referral'],
  },
  { key: 'vip', name: 'VIP', type: 'BOOLEAN', required: false, options: [] },
  { key: 'dob', name: 'Birthday', type: 'DATE', required: false, options: [] },
];

describe('validateCustomFieldValues', () => {
  it('accepts and converts valid values', () => {
    const { values, errors } = validateCustomFieldValues(
      defs,
      {
        city: ' Hyderabad ',
        ltv: '50000',
        source: 'Referral',
        vip: 'true',
        dob: '1990-05-01',
      },
      false,
    );
    expect(errors).toEqual([]);
    expect(values).toEqual({
      city: 'Hyderabad',
      ltv: 50000,
      source: 'Referral',
      vip: true,
      dob: '1990-05-01',
    });
  });

  it('requires required fields on create but not on partial update', () => {
    expect(validateCustomFieldValues(defs, {}, false).errors).toEqual([
      'City is required',
    ]);
    expect(validateCustomFieldValues(defs, {}, true).errors).toEqual([]);
  });

  it('does not allow clearing a required field', () => {
    expect(validateCustomFieldValues(defs, { city: '' }, true).errors).toEqual([
      'City is required',
    ]);
  });

  it('stores null when an optional field is cleared', () => {
    expect(
      validateCustomFieldValues(defs, { city: 'X', ltv: '' }, false).values.ltv,
    ).toBeNull();
  });

  it('rejects bad types, options and unknown keys', () => {
    const { errors } = validateCustomFieldValues(
      defs,
      { city: 'X', ltv: 'abc', source: 'Facebook', dob: '01-05-1990', foo: 1 },
      false,
    );
    expect(errors).toEqual([
      'Unknown field "foo"',
      'Lifetime Value must be a number',
      'Source must be one of: Website, Referral',
      'Birthday must be a date (YYYY-MM-DD)',
    ]);
  });
});

describe('toFieldKey', () => {
  it('makes snake_case keys', () => {
    expect(toFieldKey('Lifetime Value')).toBe('lifetime_value');
    expect(toFieldKey('  GST No. ')).toBe('gst_no');
    expect(toFieldKey('2nd Phone')).toBe('f_2nd_phone');
  });
});
