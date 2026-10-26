import type { Card, Transaction, BillingCycle } from '../types';
import { formatINR } from './format';
import { daysBetween } from './dates';

/**
 * Calculates total outstanding balance for a card across all time.
 * outstanding = sum(expenses) - sum(refunds) - sum(payments)
 * Overpayment results in a negative outstanding balance (credit balance).
 */
export function calculateOutstanding(transactions: Transaction[], cardId?: string): number {
  const cardTxns = cardId ? transactions.filter((t) => t.cardId === cardId) : transactions;
  return cardTxns.reduce((acc, t) => {
    if (t.type === 'expense') {
      return acc + t.amount;
    } else if (t.type === 'refund') {
      return acc - t.amount;
    } else if (t.type === 'payment') {
      return acc - t.amount;
    }
    return acc;
  }, 0);
}

/**
 * Calculates available limit.
 * availableLimit = card.limit - outstanding
 */
export function calculateAvailableLimit(cardLimit: number, outstanding: number): number {
  return cardLimit - outstanding;
}

/**
 * Calculates card utilization ratio (0 to 1+).
 * utilization = max(0, outstanding) / card.limit
 */
export function calculateUtilization(cardLimit: number, outstanding: number): number {
  if (cardLimit <= 0) return 0;
  const nonNegativeOutstanding = Math.max(0, outstanding);
  return nonNegativeOutstanding / cardLimit;
}

/**
 * Helper to clamp day of month to maximum days available in that month.
 * e.g. Day 31 in Feb 2026 -> 28, Feb 2024 -> 29.
 */
export function getClampedDay(year: number, monthIndex: number, targetDay: number): number {
  // Day 0 of next month returns last day of current month
  const maxDays = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(Math.max(1, targetDay), maxDays);
}

/**
 * Formats date components into YYYY-MM-DD.
 */
function toISODateString(year: number, monthIndex: number, day: number): string {
  const clampedDay = getClampedDay(year, monthIndex, day);
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(clampedDay).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Helper to compute the statement date in a specific year and month.
 */
function getStatementDateForMonth(card: Card, year: number, monthIndex: number): string {
  return toISODateString(year, monthIndex, card.statementDay);
}

/**
 * Helper to compute the due date for a given statement date.
 * Due date is the first occurrence of dueDay AFTER the statement date.
 * (e.g. statement 15th, due 5th -> 5th of next month; statement 5th, due 25th -> 25th of same month).
 */
export function calculateDueDate(card: Card, statementDateISO: string): string {
  const [sYear, sMonth, sDay] = statementDateISO.split('-').map(Number);
  const statementMonthIdx = sMonth - 1;

  // If dueDay is greater than the actual statement day of this month,
  // it occurs later in the same month.
  if (card.dueDay > sDay) {
    return toISODateString(sYear, statementMonthIdx, card.dueDay);
  }

  // Otherwise, it falls in the following month (or next year if Dec)
  const nextMonthIdx = (statementMonthIdx + 1) % 12;
  const nextYear = statementMonthIdx === 11 ? sYear + 1 : sYear;
  return toISODateString(nextYear, nextMonthIdx, card.dueDay);
}

/**
 * Computes the billing cycle that contains the specified date.
 * A cycle ends on the statement date and starts the day after the previous statement date.
 * A transaction dated on the statement day belongs to the cycle that ends on that day.
 */
export function getCycle(card: Card, dateInput: string | Date): BillingCycle {
  let dateISO: string;
  if (typeof dateInput === 'string') {
    dateISO = dateInput;
  } else {
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    dateISO = `${y}-${m}-${d}`;
  }

  const [year, month, day] = dateISO.split('-').map(Number);
  const monthIdx = month - 1;

  // Statement date in the current month
  const currentMonthStatementISO = getStatementDateForMonth(card, year, monthIdx);
  const currentMonthStatementDay = Number(currentMonthStatementISO.split('-')[2]);

  let cycleYear: number;
  let cycleMonthIdx: number;

  if (day <= currentMonthStatementDay) {
    // Falls on or before this month's statement date -> ends in this month
    cycleYear = year;
    cycleMonthIdx = monthIdx;
  } else {
    // Falls after this month's statement date -> belongs to the next month's cycle
    cycleMonthIdx = (monthIdx + 1) % 12;
    cycleYear = monthIdx === 11 ? year + 1 : year;
  }

  // Statement date (cycle end date)
  const statementDate = getStatementDateForMonth(card, cycleYear, cycleMonthIdx);
  const endDate = statementDate;

  // Previous statement date to determine cycle start
  const prevMonthIdx = (cycleMonthIdx + 11) % 12;
  const prevYear = cycleMonthIdx === 0 ? cycleYear - 1 : cycleYear;
  const prevStatementDate = getStatementDateForMonth(card, prevYear, prevMonthIdx);

  // Cycle starts the day after previous statement date
  const [pY, pM, pD] = prevStatementDate.split('-').map(Number);
  const prevDateObj = new Date(pY, pM - 1, pD);
  prevDateObj.setDate(prevDateObj.getDate() + 1);

  const startYear = prevDateObj.getFullYear();
  const startMonthIdx = prevDateObj.getMonth();
  const startDay = prevDateObj.getDate();
  const startDate = toISODateString(startYear, startMonthIdx, startDay);

  // Due date
  const dueDate = calculateDueDate(card, statementDate);

  return {
    start: startDate,
    end: endDate,
    statementDate,
    dueDate,
  };
}

/**
 * Returns the last N billing cycles for a card, ordered newest first (most recent at index 0).
 */
export function getCycles(card: Card, count: number = 6, referenceDateISO?: string): BillingCycle[] {
  const ref = referenceDateISO || new Date().toISOString().slice(0, 10);
  const currentCycle = getCycle(card, ref);
  const cycles: BillingCycle[] = [currentCycle];

  let currentEnd = currentCycle.end;
  for (let i = 1; i < count; i++) {
    const [y, m, d] = currentEnd.split('-').map(Number);
    // Find date prior to previous cycle start
    const prevDateObj = new Date(y, m - 1, d);
    prevDateObj.setMonth(prevDateObj.getMonth() - 1);
    const prevCycle = getCycle(card, prevDateObj);
    cycles.push(prevCycle);
    currentEnd = prevCycle.end;
  }

  return cycles;
}

/**
 * Calendar days left in the current billing cycle from today (0 if past end date).
 */
export function daysLeftInCycle(card: Card, todayISO: string): number {
  const cycle = getCycle(card, todayISO);
  const diff = daysBetween(todayISO, cycle.end);
  return Math.max(0, diff);
}

/**
 * Calendar days until the due date from today.
 * Positive = days left, 0 = due today, Negative = overdue.
 */
export function daysUntilDue(card: Card, todayISO: string): number {
  const cycle = getCycle(card, todayISO);
  return daysBetween(todayISO, cycle.dueDate);
}

/**
 * Calculates total spending within a billing cycle: sum(expenses) - sum(refunds).
 * Bill payments are not expenses and are excluded.
 */
export function cycleSpend(transactions: Transaction[], cycle: BillingCycle, cardId?: string): number {
  const filtered = transactions.filter((t) => {
    const matchCard = cardId ? t.cardId === cardId : true;
    const inCycle = t.date >= cycle.start && t.date <= cycle.end;
    return matchCard && inCycle;
  });

  return filtered.reduce((total, t) => {
    if (t.type === 'expense') return total + t.amount;
    if (t.type === 'refund') return total - t.amount;
    return total;
  }, 0);
}

/**
 * Calculates spending breakdown by category in a billing cycle.
 */
export function categoryTotals(
  transactions: Transaction[],
  cycle: BillingCycle,
  cardId?: string
): Record<string, number> {
  const filtered = transactions.filter((t) => {
    const matchCard = cardId ? t.cardId === cardId : true;
    const inCycle = t.date >= cycle.start && t.date <= cycle.end;
    return matchCard && inCycle && (t.type === 'expense' || t.type === 'refund');
  });

  const totals: Record<string, number> = {};
  for (const t of filtered) {
    const catId = t.categoryId || 'uncategorized';
    const delta = t.type === 'expense' ? t.amount : -t.amount;
    totals[catId] = (totals[catId] || 0) + delta;
  }
  return totals;
}

/**
 * Calculates monthly spending totals for the past N calendar months (calendar month YYYY-MM).
 */
export function monthlyTotals(
  transactions: Transaction[],
  monthsBack: number = 6,
  referenceDate?: Date
): { month: string; label: string; spend: number }[] {
  const ref = referenceDate || new Date();
  const results: { month: string; label: string; spend: number }[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const monthKey = `${y}-${m}`;
    const label = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });

    const monthTxns = transactions.filter(
      (t) => t.date.startsWith(monthKey) && (t.type === 'expense' || t.type === 'refund')
    );
    const spend = monthTxns.reduce((acc, t) => {
      return acc + (t.type === 'expense' ? t.amount : -t.amount);
    }, 0);

    results.push({ month: monthKey, label, spend });
  }

  return results;
}

/**
 * Returns budget status and percent for a given spent amount and budget.
 */
export function budgetStatus(
  spent: number,
  budget: number,
  alertPercent: number = 80
): { status: 'ok' | 'warning' | 'over'; percent: number } {
  if (budget <= 0) {
    return { status: 'ok', percent: 0 };
  }

  const percent = Math.round((spent / budget) * 100);
  if (percent >= 100) {
    return { status: 'over', percent };
  } else if (percent >= alertPercent) {
    return { status: 'warning', percent };
  }
  return { status: 'ok', percent };
}

/**
 * Compares logged cycle spend with the actual statement total from the bank bill.
 */
export function billMatch(
  loggedCycleSpend: number,
  statementTotal: number
): {
  diff: number;
  status: 'matches' | 'under' | 'over';
  message: string;
} {
  const diff = loggedCycleSpend - statementTotal;
  if (diff === 0) {
    return { diff: 0, status: 'matches', message: 'Matches' };
  } else if (diff < 0) {
    const absDiff = Math.abs(diff);
    return {
      diff,
      status: 'under',
      message: `You may have forgotten ${formatINR(absDiff)} of spending`,
    };
  } else {
    return {
      diff,
      status: 'over',
      message: `Logged more than the bill by ${formatINR(diff)}`,
    };
  }
}
