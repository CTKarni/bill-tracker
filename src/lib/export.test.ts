import { describe, it, expect } from 'vitest';
import type { Transaction, Card, Category } from '../types';
import { prepareExportData } from './export';
import { generateICSCalendar } from './calendar';

describe('Export and Calendar generation', () => {
  const cards: Card[] = [
    {
      id: 'c1',
      nickname: 'HDFC Regalia',
      last4: '4321',
      limit: 10000000,
      statementDay: 15,
      dueDay: 5,
      createdAt: Date.now(),
    },
  ];

  const categories: Category[] = [
    {
      id: 'cat_dining',
      name: 'Food and Dining',
      color: '#E03E3E',
      isDefault: true,
    },
  ];

  const transactions: Transaction[] = [
    {
      id: 't1',
      cardId: 'c1',
      type: 'expense',
      amount: 455000, // ₹4,550.00
      categoryId: 'cat_dining',
      date: '2026-03-12',
      note: 'Team lunch',
      isRecurring: false,
      isReimbursable: true,
      reimbursableFrom: 'Acme Corp',
      isReimbursed: false,
      createdAt: Date.now(),
    },
    {
      id: 't2',
      cardId: 'c1',
      type: 'payment',
      amount: 200000, // ₹2,000.00
      date: '2026-03-15',
      note: 'Bill payment',
      isRecurring: false,
      isReimbursable: false,
      isReimbursed: false,
      createdAt: Date.now(),
    },
  ];

  it('prepares export data with correct column headers and formatted values', () => {
    const data = prepareExportData(transactions, cards, categories);
    expect(data.length).toBe(2);

    expect(data[0].Date).toBe('2026-03-12');
    expect(data[0].Card).toBe('HDFC Regalia (•••• 4321)');
    expect(data[0].Type).toBe('Expense');
    expect(data[0].Category).toBe('Food and Dining');
    expect(data[0]['Amount (₹)']).toBe(4550);
    expect(data[0].Note).toBe('Team lunch');
    expect(data[0].Reimbursable).toBe('Yes');
    expect(data[0]['Reimbursed From']).toBe('Acme Corp');
    expect(data[0]['Reimbursement Status']).toBe('Owed');

    expect(data[1].Type).toBe('Payment');
    expect(data[1].Category).toBe('Bill Payment');
    expect(data[1]['Amount (₹)']).toBe(2000);
  });

  it('generates valid iCalendar (.ics) string with VEVENT and VALARM', () => {
    const ics = generateICSCalendar(cards, 3);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Pay HDFC Regalia (•••• 4321) Bill');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-P3D');
  });
});
