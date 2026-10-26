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

  it('guarantees dates never shift by one day (immune to UTC midnight timezone bugs)', () => {
    // Test end of month, leap days, and year boundary
    const testDates = [
      '2026-01-01',
      '2026-02-28',
      '2024-02-29', // leap day
      '2026-03-31',
      '2026-04-30',
      '2026-12-31',
    ];

    testDates.forEach((iso) => {
      const parsed = parseISODate(iso);
      // Day, month, and year in local time must strictly match parts
      const [y, m, d] = iso.split('-').map(Number);
      expect(parsed.getFullYear()).toBe(y);
      expect(parsed.getMonth()).toBe(m - 1);
      expect(parsed.getDate()).toBe(d);

      // Re-formatting must be identical
      expect(formatISODate(parsed)).toBe(iso);

      // Display formatting must retain the exact day
      const display = formatDisplayDate(iso, 'yyyy-MM-dd');
      expect(display).toBe(iso);
    });
  });
});

