import { describe, expect, it } from 'vitest';
import { formatLocalDueDate, getLocalTodayIso } from '@/lib/date';

describe('date helpers', () => {
  it('formats local YYYY-MM-DD from provided Date', () => {
    expect(getLocalTodayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(getLocalTodayIso(new Date(2026, 10, 26, 0, 1))).toBe('2026-11-26');
  });

  it('formats valid YYYY-MM-DD due dates in pt-BR and falls back for invalid inputs', () => {
    const formatted = formatLocalDueDate('2026-11-05');
    expect(formatted).toMatch(/05/);
    expect(formatted.toLowerCase()).toMatch(/nov/);

    expect(formatLocalDueDate('invalid-date')).toBe('invalid-date');
    expect(formatLocalDueDate('2026-02-31')).toBe('2026-02-31');
    expect(formatLocalDueDate('')).toBe('');
  });
});
