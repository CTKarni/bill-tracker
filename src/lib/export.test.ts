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

  it('neutralizes CSV/Excel formula injection for cells starting with =, +, -, @, tab, or CR', () => {
    const maliciousTransactions: Transaction[] = [
      {
        id: 'inj1',
        cardId: 'c1',
        type: 'expense',
        amount: 10000,
        date: '2026-03-01',
        note: '=cmd|"/C calc"!A0',
        reimbursableFrom: '+123456',
        isRecurring: false,
        isReimbursable: true,
        isReimbursed: false,
        createdAt: Date.now(),
      },
      {
        id: 'inj2',
        cardId: 'c1',
        type: 'expense',
        amount: 20000,
        date: '2026-03-02',
        note: '@SUM(1+1)',
        reimbursableFrom: '\tmalicious_tab',
        isRecurring: false,
        isReimbursable: true,
        isReimbursed: false,
        createdAt: Date.now(),
      },
      {
        id: 'inj3',
        cardId: 'c1',
        type: 'expense',
        amount: 30000,
        date: '2026-03-03',
        note: '-2+5+cmd|',
        reimbursableFrom: '\rcarriage_return',
        isRecurring: false,
        isReimbursable: true,
        isReimbursed: false,
        createdAt: Date.now(),
      },
    ];

    const data = prepareExportData(maliciousTransactions, cards, categories);
    expect(data[0].Note).toBe("'=cmd|\"/C calc\"!A0");
    expect(data[0]['Reimbursed From']).toBe("'+123456");

    expect(data[1].Note).toBe("'@SUM(1+1)");
    expect(data[1]['Reimbursed From']).toBe("'\tmalicious_tab");

    expect(data[2].Note).toBe("'-2+5+cmd|");
    expect(data[2]['Reimbursed From']).toBe("'\rcarriage_return");
  });

  it('escapes iCalendar special characters and prevents CRLF line injection', () => {
    const injectionCard: Card = {
      id: 'inj_card',
      nickname: 'Injected Card\nSUMMARY:Hacked Event\nDTSTART:20260101',
      last4: '0000',
      limit: 500000,
      statementDay: 10,
      dueDay: 25,
      createdAt: Date.now(),
    };

    const ics = generateICSCalendar([injectionCard], 2);
    // Should NOT contain a raw unescaped newline that creates a new line in .ics
    expect(ics).not.toMatch(/\r?\nSUMMARY:Hacked Event/);
    // Should have escaped newline literal \n
    expect(ics).toContain('Injected Card\\nSUMMARY:Hacked Event');
  });

  it('handles XSS payloads safely as plain text in export data', () => {
    const xssPayloads = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '"><svg onload=alert(1)>',
      'javascript:alert(1)',
    ];

    xssPayloads.forEach((payload, idx) => {
      const xssTxn: Transaction = {
        id: `xss_${idx}`,
        cardId: 'c1',
        type: 'expense',
        amount: 5000,
        date: '2026-03-01',
        note: payload,
        reimbursableFrom: payload,
        isRecurring: false,
        isReimbursable: true,
        isReimbursed: false,
        createdAt: Date.now(),
      };

      const data = prepareExportData([xssTxn], cards, categories);
      expect(data[0].Note).toBe(payload);
      expect(data[0]['Reimbursed From']).toBe(payload);
    });
  });
});

