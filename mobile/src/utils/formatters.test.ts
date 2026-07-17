import {
  formatCurrency,
  formatCedula,
  formatDate,
  formatDateShort,
  formatCurrencyCompact,
  formatFullCurrency,
  formatTimeAgo,
  getTodayISO,
  getMonthStart,
  dateToISO,
  formatPhone,
  unformatPhone,
  unformatCedula,
  formatIngresosInput,
  unformatIngresosInput,
  formatDateTime,
} from '@/utils/formatters';

describe('formatCurrency', () => {
  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('RD$ 0.00');
  });

  it('formats positive amounts', () => {
    expect(formatCurrency(1000)).toBe('RD$ 1,000.00');
  });

  it('formats negative amounts', () => {
    expect(formatCurrency(-5000)).toBe('RD$ -5,000.00');
  });

  it('formats large numbers', () => {
    expect(formatCurrency(1234567.89)).toBe('RD$ 1,234,567.89');
  });

  it('handles null', () => {
    expect(formatCurrency(null)).toBe('RD$ 0.00');
  });

  it('handles undefined', () => {
    expect(formatCurrency(undefined)).toBe('RD$ 0.00');
  });
});

describe('formatCedula', () => {
  it('formats short input', () => {
    expect(formatCedula('123')).toBe('123');
  });

  it('formats standard cedula', () => {
    expect(formatCedula('00112345678')).toBe('001-1234567-8');
  });

  it('formats 10-digit input without final check digit', () => {
    expect(formatCedula('0011234567')).toBe('001-1234567');
  });

  it('strips non-digit characters', () => {
    expect(formatCedula('001-123-45678')).toBe('001-1234567-8');
  });

  it('truncates to 11 digits', () => {
    expect(formatCedula('00112345678901')).toBe('001-1234567-8');
  });
});

describe('formatDate', () => {
  it('returns No disponible for null', () => {
    expect(formatDate(null)).toBe('No disponible');
  });

  it('formats ISO date string with time', () => {
    const result = formatDate('2024-03-15T12:00:00');
    expect(result).toContain('2024');
    expect(result).toContain('15');
  });

  it('formats plain date string without time', () => {
    const result = formatDate('2024-03-15');
    expect(result).toContain('2024');
    expect(result).toContain('15');
  });
});

describe('formatDateShort', () => {
  it('returns empty for null', () => {
    expect(formatDateShort(null)).toBe('');
  });

  it('formats ISO date string', () => {
    const result = formatDateShort('2024-03-15T12:00:00');
    expect(result).toContain('2024');
  });

  it('formats plain date string', () => {
    const result = formatDateShort('2024-03-15');
    expect(result).toContain('2024');
  });
});

describe('formatDateTime', () => {
  it('returns No disponible for null', () => {
    expect(formatDateTime(null)).toBe('No disponible');
  });

  it('includes time components for ISO string', () => {
    const result = formatDateTime('2024-03-15T14:30:00');
    expect(result).toContain('2024');
    expect(result).toContain('15');
  });
});

describe('formatCurrencyCompact', () => {
  it('formats millions', () => {
    expect(formatCurrencyCompact(1500000)).toBe('$1.50M');
  });

  it('formats thousands', () => {
    expect(formatCurrencyCompact(25000)).toBe('$25.0K');
  });

  it('formats small numbers', () => {
    expect(formatCurrencyCompact(500)).toBe('$500');
  });

  it('formats zero', () => {
    expect(formatCurrencyCompact(0)).toBe('$0');
  });
});

describe('formatFullCurrency', () => {
  it('formats with two decimal places', () => {
    expect(formatFullCurrency(1234.5)).toBe('$1,234.50');
  });

  it('formats whole numbers', () => {
    expect(formatFullCurrency(1000)).toBe('$1,000.00');
  });

  it('formats zero', () => {
    expect(formatFullCurrency(0)).toBe('$0.00');
  });
});

describe('formatTimeAgo', () => {
  it('returns recién for very recent dates', () => {
    const now = new Date().toISOString();
    expect(formatTimeAgo(now)).toBe('recién');
  });

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(formatTimeAgo(fiveMinAgo)).toBe('hace 5min');
  });

  it('returns hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(formatTimeAgo(threeHoursAgo)).toBe('hace 3h');
  });

  it('returns days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(formatTimeAgo(twoDaysAgo)).toBe('hace 2d');
  });
});

describe('getTodayISO', () => {
  it('returns today in YYYY-MM-DD format', () => {
    const result = getTodayISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe(new Date().toISOString().split('T')[0]);
  });
});

describe('getMonthStart', () => {
  it('returns first day of current month', () => {
    const result = getMonthStart();
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    expect(result).toBe(expected);
  });

  it('has YYYY-MM-DD format', () => {
    expect(getMonthStart()).toMatch(/^\d{4}-\d{2}-01$/);
  });
});

describe('dateToISO', () => {
  it('converts Date to ISO string', () => {
    const date = new Date(2024, 2, 15);
    expect(dateToISO(date)).toBe('2024-03-15');
  });

  it('pads single-digit months and days', () => {
    const date = new Date(2024, 0, 5);
    expect(dateToISO(date)).toBe('2024-01-05');
  });
});

describe('formatPhone', () => {
  it('formats valid 10-digit DR phone number', () => {
    expect(formatPhone('8091234567')).toBe('(809) 123-4567');
  });

  it('formats 829 prefix', () => {
    expect(formatPhone('8291234567')).toBe('(829) 123-4567');
  });

  it('strips non-digits from non-DR numbers', () => {
    expect(formatPhone('123-456')).toBe('123456');
  });
});

describe('unformatPhone', () => {
  it('strips all non-digit characters', () => {
    expect(unformatPhone('(809) 123-4567')).toBe('8091234567');
  });
});

describe('unformatCedula', () => {
  it('strips all non-digit characters', () => {
    expect(unformatCedula('001-1234567-8')).toBe('00112345678');
  });
});

describe('formatIngresosInput', () => {
  it('adds thousand separators', () => {
    expect(formatIngresosInput('1000000')).toBe('1,000,000');
  });

  it('preserves decimal part', () => {
    expect(formatIngresosInput('1000000.50')).toBe('1,000,000.50');
  });

  it('strips non-numeric characters', () => {
    expect(formatIngresosInput('abc123')).toBe('123');
  });

  it('handles multiple dots by collapsing into one', () => {
    expect(formatIngresosInput('1000.50.25')).toBe('1000.5025');
  });
});

describe('unformatIngresosInput', () => {
  it('removes commas', () => {
    expect(unformatIngresosInput('1,000,000')).toBe('1000000');
  });
});
