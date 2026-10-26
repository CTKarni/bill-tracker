import { describe, it, expect } from 'vitest';
import { validateBackupJSON, hasPrototypePollution } from './backup';
import type { Card, Category, Transaction, Settings } from '../types';

describe('Backup and Restore Safety', () => {
  const sampleCards: Card[] = [
    {
      id: 'c1',
      nickname: 'HDFC Regalia',
      last4: '4321',
      limit: 10000000,
      statementDay: 15,
      dueDay: 5,
      createdAt: 1710000000000,
    },
  ];

  const sampleCategories: Category[] = [
    {
      id: 'cat_1',
      name: 'Food',
      color: '#E03E3E',
      isDefault: true,
      monthlyBudget: 2000000,
    },
  ];

  const sampleTransactions: Transaction[] = [
    {
      id: 't1',
      cardId: 'c1',
      type: 'expense',
      amount: 450000,
      categoryId: 'cat_1',
      date: '2026-03-12',
      isRecurring: false,
      isReimbursable: false,
      isReimbursed: false,
      createdAt: 1710000000000,
    },
  ];

  const sampleSettings: Settings = {
    id: 'main',
    reminderDaysBeforeDue: 3,
    budgetAlertPercent: 80,
    lastBackupDate: '2026-03-01',
  };

  it('validates a correct backup and restores identical data (Export -> Restore roundtrip)', () => {
    const originalBackup = {
      version: 1,
      cards: sampleCards,
      categories: sampleCategories,
      transactions: sampleTransactions,
      settings: sampleSettings,
    };

    const jsonString = JSON.stringify(originalBackup);
    const result = validateBackupJSON(jsonString);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(originalBackup);
  });

  it('rejects prototype pollution attempts via __proto__, constructor, or prototype', () => {
    expect(hasPrototypePollution({ __proto__: { admin: true } })).toBe(true);
    expect(hasPrototypePollution({ nested: { constructor: 'fake' } })).toBe(true);

    const maliciousJson1 = '{"cards":[],"categories":[],"transactions":[],"__proto__":{"isAdmin":true}}';
    const result1 = validateBackupJSON(maliciousJson1);
    expect(result1.success).toBe(false);
    expect(result1.error).toContain('prototype pollution');

    const maliciousJson2 = '{"cards":[],"categories":[],"transactions":[],"settings":{"id":"main","reminderDaysBeforeDue":3,"budgetAlertPercent":80,"constructor":{"evil":1}}}';
    const result2 = validateBackupJSON(maliciousJson2);
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('prototype pollution');
  });

  it('strictly rejects non-numeric or invalid last4', () => {
    const badCardBackup = {
      cards: [
        {
          ...sampleCards[0],
          last4: '123', // only 3 digits
        },
      ],
      categories: sampleCategories,
      transactions: sampleTransactions,
    };

    const res = validateBackupJSON(JSON.stringify(badCardBackup));
    expect(res.success).toBe(false);
    expect(res.error).toContain('last4');
  });

  it('strictly rejects negative amounts or floats in amounts', () => {
    const badTxnBackup = {
      cards: sampleCards,
      categories: sampleCategories,
      transactions: [
        {
          ...sampleTransactions[0],
          amount: -500,
        },
      ],
    };

    const res = validateBackupJSON(JSON.stringify(badTxnBackup));
    expect(res.success).toBe(false);
    expect(res.error).toContain('amount');
  });

  it('strictly rejects unknown transaction types', () => {
    const badTypeBackup = {
      cards: sampleCards,
      categories: sampleCategories,
      transactions: [
        {
          ...sampleTransactions[0],
          type: 'hack',
        },
      ],
    };

    const res = validateBackupJSON(JSON.stringify(badTypeBackup));
    expect(res.success).toBe(false);
    expect(res.error).toContain('type');
  });

  it('strictly rejects invalid date formats (must be YYYY-MM-DD)', () => {
    const badDateBackup = {
      cards: sampleCards,
      categories: sampleCategories,
      transactions: [
        {
          ...sampleTransactions[0],
          date: '12/03/2026',
        },
      ],
    };

    const res = validateBackupJSON(JSON.stringify(badDateBackup));
    expect(res.success).toBe(false);
    expect(res.error).toContain('date');
  });

  it('strictly rejects malformed JSON', () => {
    const res = validateBackupJSON('{ "invalid json": ');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Malformed JSON');
  });
});
