import { describe, it, expect } from 'vitest';
import type { Card, Transaction } from '../types';
import {
  calculateOutstanding,
  calculateAvailableLimit,
  calculateUtilization,
  getCycle,
  getCycles,
  daysLeftInCycle,
  daysUntilDue,
  cycleSpend,
  categoryTotals,
  monthlyTotals,
  budgetStatus,
  billMatch,
} from './finance';

describe('Finance Logic - Outstanding, Available Limit, Utilization', () => {
  const card: Card = {
    id: 'card_1',
    nickname: 'HDFC Regalia',
    last4: '4321',
    limit: 10000000, // ₹1,00,000 (10,000,000 paise)
    statementDay: 15,
    dueDay: 5,
    createdAt: Date.now(),
  };

  it('calculates available limit with expenses only', () => {
    const txns: Transaction[] = [
      {
        id: '1',
        cardId: 'card_1',
        type: 'expense',
        amount: 2500000, // ₹25,000
        date: '2026-03-01',
        isRecurring: false,
        isReimbursable: false,
        isReimbursed: false,
        createdAt: Date.now(),
      },
      {
        id: '2',
        cardId: 'card_1',
        type: 'expense',
        amount: 1500000, // ₹15,000
        date: '2026-03-02',
        isRecurring: false,
        isReimbursable: false,
        isReimbursed: false,
        createdAt: Date.now(),
      },
    ];

    const outstanding = calculateOutstanding(txns, 'card_1');
    expect(outstanding).toBe(4000000); // ₹40,000
    const available = calculateAvailableLimit(card.limit, outstanding);
    expect(available).toBe(6000000); // ₹60,000
    const utilization = calculateUtilization(card.limit, outstanding);
    expect(utilization).toBe(0.4); // 40%
  });

  it('calculates available limit with payments and refunds', () => {
    const txns: Transaction[] = [
      {
        id: '1',
        cardId: 'card_1',
        type: 'expense',
        amount: 5000000, // ₹50,000
        date: '2026-03-01',
        isRecurring: false,
        isReimbursable: false,
        isReimbursed: false,
        createdAt: Date.now(),
      },
      {
        id: '2',
        cardId: 'card_1',
        type: 'payment',
        amount: 3000000, // ₹30,000
        date: '2026-03-05',
        isRecurring: false,
        isReimbursable: false,
        isReimbursed: false,
        createdAt: Date.now(),
      },
      {
        id: '3',
        cardId: 'card_1',
        type: 'refund',
        amount: 500000, // ₹5,000
        date: '2026-03-10',
        isRecurring: false,
        isReimbursable: false,
        isReimbursed: false,
        createdAt: Date.now(),
      },
    ];

    const outstanding = calculateOutstanding(txns, 'card_1');
    // 50,000 - 30,000 - 5,000 = 15,000
    expect(outstanding).toBe(1500000);
    const available = calculateAvailableLimit(card.limit, outstanding);
    expect(available).toBe(8500000); // ₹85,000
    expect(calculateUtilization(card.limit, outstanding)).toBe(0.15);
  });

  it('handles overpayment (credit balance) gracefully without crashing', () => {
    const txns: Transaction[] = [
      {
        id: '1',
        cardId: 'card_1',
        type: 'payment',
        amount: 200000, // ₹2,000
        date: '2026-03-01',
        isRecurring: false,
        isReimbursable: false,
        isReimbursed: false,
        createdAt: Date.now(),
      },
    ];

    const outstanding = calculateOutstanding(txns, 'card_1');
    expect(outstanding).toBe(-200000); // -₹2,000 credit balance
    const available = calculateAvailableLimit(card.limit, outstanding);
    expect(available).toBe(10200000); // ₹1,02,000 limit + overpayment
    // Utilization cannot be negative, max(0, outstanding) / limit = 0
    expect(calculateUtilization(card.limit, outstanding)).toBe(0);
  });

  it('handles utilization over 100% when spending exceeds card limit', () => {
    const txns: Transaction[] = [
      {
        id: '1',
        cardId: 'card_1',
        type: 'expense',
        amount: 12000000, // ₹1,20,000 on a 1,00,000 limit card
        date: '2026-03-01',
        isRecurring: false,
        isReimbursable: false,
        isReimbursed: false,
        createdAt: Date.now(),
      },
    ];

    const outstanding = calculateOutstanding(txns, 'card_1');
    expect(outstanding).toBe(12000000);
    expect(calculateAvailableLimit(card.limit, outstanding)).toBe(-2000000);
    expect(calculateUtilization(card.limit, outstanding)).toBe(1.2);
  });
});

describe('Finance Logic - Billing Cycles and Due Dates', () => {
  const cardMidMonth: Card = {
    id: 'c1',
    nickname: 'ICICI Amazon Pay',
    last4: '1234',
    limit: 5000000,
    statementDay: 15,
    dueDay: 5,
    createdAt: Date.now(),
  };

  it('cycle for a date BEFORE the statement day', () => {
    const cycle = getCycle(cardMidMonth, '2026-03-10');
    expect(cycle.end).toBe('2026-03-15');
    expect(cycle.start).toBe('2026-02-16');
    expect(cycle.statementDate).toBe('2026-03-15');
    // statement 15th, due 5th -> 5th of next month
    expect(cycle.dueDate).toBe('2026-04-05');
  });

  it('cycle for a date ON the statement day belongs to that cycle', () => {
    const cycle = getCycle(cardMidMonth, '2026-03-15');
    expect(cycle.end).toBe('2026-03-15');
    expect(cycle.start).toBe('2026-02-16');
    expect(cycle.dueDate).toBe('2026-04-05');
  });

  it('cycle for a date AFTER the statement day belongs to the next cycle', () => {
    const cycle = getCycle(cardMidMonth, '2026-03-16');
    expect(cycle.end).toBe('2026-04-15');
    expect(cycle.start).toBe('2026-03-16');
    expect(cycle.dueDate).toBe('2026-05-05');
  });

  it('due date in the SAME month (statement 5th, due 25th)', () => {
    const earlyCard: Card = {
      id: 'c2',
      nickname: 'Axis Bank',
      last4: '9999',
      limit: 5000000,
      statementDay: 5,
      dueDay: 25,
      createdAt: Date.now(),
    };

    const cycle = getCycle(earlyCard, '2026-04-01');
    expect(cycle.statementDate).toBe('2026-04-05');
    expect(cycle.dueDate).toBe('2026-04-25');
  });

  it('due date in the NEXT month (statement 15th, due 5th)', () => {
    const cycle = getCycle(cardMidMonth, '2026-05-10');
    expect(cycle.statementDate).toBe('2026-05-15');
    expect(cycle.dueDate).toBe('2026-06-05');
  });

  it('handles year boundary (December to January)', () => {
    // Statement day 15. Date: 2026-01-05
    const cycle = getCycle(cardMidMonth, '2026-01-05');
    expect(cycle.end).toBe('2026-01-15');
    expect(cycle.start).toBe('2025-12-16');
    expect(cycle.dueDate).toBe('2026-02-05');

    // Date: 2025-12-20 (after Dec statement)
    const nextYearCycle = getCycle(cardMidMonth, '2025-12-20');
    expect(nextYearCycle.end).toBe('2026-01-15');
    expect(nextYearCycle.start).toBe('2025-12-16');
  });

  it('short months: statement day 31 in February (normal year 2026)', () => {
    const endOfMonthCard: Card = {
      id: 'c3',
      nickname: 'SBI Cashback',
      last4: '8888',
      limit: 5000000,
      statementDay: 31,
      dueDay: 20,
      createdAt: Date.now(),
    };

    // Date in Feb 2026 (non-leap year has 28 days)
    const cycle = getCycle(endOfMonthCard, '2026-02-10');
    expect(cycle.end).toBe('2026-02-28');
    expect(cycle.start).toBe('2026-02-01'); // previous statement was Jan 31 -> starts Feb 1
    // Statement 28th, due 20th -> next month March 20
    expect(cycle.dueDate).toBe('2026-03-20');
  });

  it('short months: statement day 31 in February (leap year 2024)', () => {
    const endOfMonthCard: Card = {
      id: 'c3',
      nickname: 'SBI Cashback',
      last4: '8888',
      limit: 5000000,
      statementDay: 31,
      dueDay: 15,
      createdAt: Date.now(),
    };

    const cycle = getCycle(endOfMonthCard, '2024-02-10');
    expect(cycle.end).toBe('2024-02-29');
    expect(cycle.start).toBe('2024-02-01');
    expect(cycle.dueDate).toBe('2024-03-15');
  });

  it('short months: statement day 31 in 30-day month (April)', () => {
    const endOfMonthCard: Card = {
      id: 'c3',
      nickname: 'SBI Cashback',
      last4: '8888',
      limit: 5000000,
      statementDay: 31,
      dueDay: 10,
      createdAt: Date.now(),
    };

    const cycle = getCycle(endOfMonthCard, '2026-04-15');
    expect(cycle.end).toBe('2026-04-30');
    expect(cycle.start).toBe('2026-04-01');
  });

  it('generates multiple historical cycles with getCycles', () => {
    const cycles = getCycles(cardMidMonth, 3, '2026-05-10');
    expect(cycles.length).toBe(3);
    expect(cycles[0].end).toBe('2026-05-15');
    expect(cycles[1].end).toBe('2026-04-15');
    expect(cycles[2].end).toBe('2026-03-15');
  });

  it('calculates daysLeftInCycle and daysUntilDue', () => {
    const daysLeft = daysLeftInCycle(cardMidMonth, '2026-03-10');
    expect(daysLeft).toBe(5); // 15 - 10 = 5

    const dueDays = daysUntilDue(cardMidMonth, '2026-03-10');
    // cycle due date is 2026-04-05. Days between March 10 and April 5 = 26
    expect(dueDays).toBe(26);
  });
});

describe('Finance Logic - Totals, Budgets, and Bill Match', () => {
  const cycle = {
    start: '2026-03-01',
    end: '2026-03-31',
    statementDate: '2026-03-31',
    dueDate: '2026-04-20',
  };

  const sampleTxns: Transaction[] = [
    {
      id: '1',
      cardId: 'c1',
      type: 'expense',
      amount: 400000, // ₹4,000
      categoryId: 'cat_food',
      date: '2026-03-05',
      isRecurring: false,
      isReimbursable: false,
      isReimbursed: false,
      createdAt: Date.now(),
    },
    {
      id: '2',
      cardId: 'c1',
      type: 'expense',
      amount: 600000, // ₹6,000
      categoryId: 'cat_groceries',
      date: '2026-03-15',
      isRecurring: false,
      isReimbursable: false,
      isReimbursed: false,
      createdAt: Date.now(),
    },
    {
      id: '3',
      cardId: 'c1',
      type: 'refund',
      amount: 50000, // ₹500
      categoryId: 'cat_food',
      date: '2026-03-20',
      isRecurring: false,
      isReimbursable: false,
      isReimbursed: false,
      createdAt: Date.now(),
    },
    {
      id: '4',
      cardId: 'c1',
      type: 'payment',
      amount: 1000000, // bill payment should NOT count towards cycle spend
      date: '2026-03-25',
      isRecurring: false,
      isReimbursable: false,
      isReimbursed: false,
      createdAt: Date.now(),
    },
    {
      id: '5',
      cardId: 'c1',
      type: 'expense',
      amount: 200000, // outside cycle
      categoryId: 'cat_food',
      date: '2026-04-02',
      isRecurring: false,
      isReimbursable: false,
      isReimbursed: false,
      createdAt: Date.now(),
    },
  ];

  it('calculates cycleSpend (expenses minus refunds inside the cycle)', () => {
    // ₹4000 (food) + ₹6000 (groceries) - ₹500 (refund) = ₹9,500 = 950000 paise
    expect(cycleSpend(sampleTxns, cycle)).toBe(950000);
  });

  it('calculates categoryTotals accurately in cycle', () => {
    const totals = categoryTotals(sampleTxns, cycle);
    expect(totals['cat_food']).toBe(350000); // 4000 - 500
    expect(totals['cat_groceries']).toBe(600000);
  });

  it('budget status at 79%, 80%, 100%, 101%', () => {
    const budget = 1000000; // ₹10,000

    const at79 = budgetStatus(790000, budget, 80);
    expect(at79.status).toBe('ok');
    expect(at79.percent).toBe(79);

    const at80 = budgetStatus(800000, budget, 80);
    expect(at80.status).toBe('warning');
    expect(at80.percent).toBe(80);

    const at100 = budgetStatus(1000000, budget, 80);
    expect(at100.status).toBe('over');
    expect(at100.percent).toBe(100);

    const at101 = budgetStatus(1010000, budget, 80);
    expect(at101.status).toBe('over');
    expect(at101.percent).toBe(101);
  });

  it('billMatch compares logged cycle spend with statement total', () => {
    const logged = 1000000; // ₹10,000

    const matches = billMatch(logged, 1000000);
    expect(matches.status).toBe('matches');
    expect(matches.message).toBe('Matches');
    expect(matches.diff).toBe(0);

    const under = billMatch(logged, 1200000); // statement ₹12,000, logged ₹10,000
    expect(under.status).toBe('under');
    expect(under.diff).toBe(-200000);
    expect(under.message).toContain('You may have forgotten ₹2,000 of spending');

    const over = billMatch(logged, 800000); // statement ₹8,000, logged ₹10,000
    expect(over.status).toBe('over');
    expect(over.diff).toBe(200000);
    expect(over.message).toContain('Logged more than the bill by ₹2,000');
  });

  it('calculates monthlyTotals for month-over-month charts', () => {
    const refDate = new Date(2026, 2, 20); // March 2026
    const totals = monthlyTotals(sampleTxns, 2, refDate);
    expect(totals.length).toBe(2);
    // March 2026 spend: 4000 + 6000 - 500 = 950000 paise
    const march = totals.find((t) => t.month === '2026-03');
    expect(march).toBeDefined();
    expect(march?.spend).toBe(950000);
  });

  it('handles refund larger than original expense (net negative cycle spend and negative outstanding)', () => {
    const refundHeavyTxns: Transaction[] = [
      {
        id: '1',
        cardId: 'c1',
        type: 'expense',
        amount: 200000, // ₹2,000 expense
        date: '2026-03-05',
        isRecurring: false,
        isReimbursable: false,
        isReimbursed: false,
        createdAt: Date.now(),
      },
      {
        id: '2',
        cardId: 'c1',
        type: 'refund',
        amount: 500000, // ₹5,000 refund (larger than expense)
        date: '2026-03-10',
        isRecurring: false,
        isReimbursable: false,
        isReimbursed: false,
        createdAt: Date.now(),
      },
    ];

    // Cycle spend: 2000 - 5000 = -3000 rupees (-300000 paise)
    const spend = cycleSpend(refundHeavyTxns, cycle);
    expect(spend).toBe(-300000);

    // Outstanding: -300000 paise
    const outstanding = calculateOutstanding(refundHeavyTxns, 'c1');
    expect(outstanding).toBe(-300000);
  });

  it('adding 10 paise + 20 paise repeatedly gives an exact integer total without float drift', () => {
    // In IEEE-754 float: 0.10 + 0.20 = 0.30000000000000004
    // With integer paise arithmetic: 10 + 20 = 30 exactly.
    let totalPaise = 0;
    const tenPaise = 10;
    const twentyPaise = 20;

    for (let i = 0; i < 1000; i++) {
      totalPaise += tenPaise + twentyPaise;
    }

    // 1000 iterations of 30 paise = 30,000 paise (₹300.00)
    expect(totalPaise).toBe(30000);
    expect(Number.isInteger(totalPaise)).toBe(true);
  });
});

