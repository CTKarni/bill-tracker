import { format, addDays, differenceInCalendarDays, isValid } from 'date-fns';

/**
 * Returns today's date in local time as YYYY-MM-DD.
 */
export function todayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format an ISO YYYY-MM-DD string to a readable format (e.g. "15 Oct 2026" or "15 Oct").
 */
export function formatDisplayDate(isoDate: string, formatStr: string = 'dd MMM yyyy'): string {
  if (!isoDate) return '';
  try {
    const parts = isoDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return isoDate;
    // Construct local date without UTC offset issues
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (!isValid(date)) return isoDate;
    return format(date, formatStr);
  } catch {
    return isoDate;
  }
}

/**
 * Parses a YYYY-MM-DD string into a local Date instance at midnight.
 */
export function parseISODate(isoDate: string): Date {
  const parts = isoDate.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
}

/**
 * Formats a Date instance into a YYYY-MM-DD string in local time.
 */
export function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add or subtract calendar days to a YYYY-MM-DD string.
 */
export function addDaysISO(isoDate: string, days: number): string {
  const date = parseISODate(isoDate);
  return formatISODate(addDays(date, days));
}

/**
 * Calculate difference in calendar days between two YYYY-MM-DD strings (end - start).
 */
export function daysBetween(startISO: string, endISO: string): number {
  return differenceInCalendarDays(parseISODate(endISO), parseISODate(startISO));
}
