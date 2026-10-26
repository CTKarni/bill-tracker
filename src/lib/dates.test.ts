import { describe, it, expect } from 'vitest';
import { todayISO, formatDisplayDate, parseISODate, formatISODate, addDaysISO, daysBetween } from './dates';

describe('dates utilities', () => {
  it('returns valid today ISO date string', () => {
    const today = todayISO();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('formats display date correctly', () => {
    expect(formatDisplayDate('2026-10-15')).toBe('15 Oct 2026');
    expect(formatDisplayDate('2026-10-15', 'dd MMM')).toBe('15 Oct');
  });

  it('parses and formats ISO dates symmetrically', () => {
    const iso = '2026-03-25';
    const parsed = parseISODate(iso);
    expect(formatISODate(parsed)).toBe(iso);
  });

  it('adds days correctly without timezone drift', () => {
    expect(addDaysISO('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysISO('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('calculates calendar days difference accurately', () => {
    expect(daysBetween('2026-10-01', '2026-10-15')).toBe(14);
    expect(daysBetween('2026-10-15', '2026-10-01')).toBe(-14);
    expect(daysBetween('2026-10-15', '2026-10-15')).toBe(0);
  });
});
