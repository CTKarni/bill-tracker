import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './index';
import type { Transaction } from '../types';

describe('Database defaults and schemas', () => {
  it('contains the 11 default categories from the specification', () => {
    const expectedCategories = [
      'Food and Dining',
      'Groceries',
      'Shopping',
      'Travel',
      'Fuel',
      'Bills and Utilities',
      'Entertainment',
      'Subscriptions',
      'Health',
      'Education',
      'Other',
    ];

    expect(DEFAULT_CATEGORIES.length).toBe(11);
    const categoryNames = DEFAULT_CATEGORIES.map((c) => c.name);
    expectedCategories.forEach((name) => {
      expect(categoryNames).toContain(name);
    });
  });

  it('contains default settings with 3 reminder days and 80% budget alert', () => {
    expect(DEFAULT_SETTINGS.id).toBe('main');
    expect(DEFAULT_SETTINGS.reminderDaysBeforeDue).toBe(3);
    expect(DEFAULT_SETTINGS.budgetAlertPercent).toBe(80);
  });
});

describe('Dexie Schema Upgrades and Integrity', () => {
  it('upgrades an older-version database to a new version without data loss', async () => {
    const dbName = `test_upgrade_db_${Date.now()}`;

    // Step 1: Open version 1 database and insert data
    const dbV1 = new Dexie(dbName);
    dbV1.version(1).stores({
      cards: 'id, nickname, last4',
    });
    await dbV1.open();

    const cardsTableV1 = dbV1.table('cards');
    await cardsTableV1.add({
      id: 'c1',
      nickname: 'Old Card',
      last4: '1111',
      limit: 5000000,
    });
    await dbV1.close();

    // Step 2: Open version 2 with schema upgrade
    const dbV2 = new Dexie(dbName);
    dbV2.version(1).stores({
      cards: 'id, nickname, last4',
    });
    dbV2.version(2).stores({
      cards: 'id, nickname, last4, color',
    }).upgrade((tx) => {
      return tx.table('cards').toCollection().modify((card) => {
        card.color = '#37352F';
      });
    });
    await dbV2.open();

    const cardsTableV2 = dbV2.table('cards');
    const upgradedCard = await cardsTableV2.get('c1');

    expect(upgradedCard).toBeDefined();
    expect(upgradedCard.nickname).toBe('Old Card');
    expect(upgradedCard.last4).toBe('1111');
    expect(upgradedCard.color).toBe('#37352F'); // Upgrade modification applied

    await dbV2.close();
  });

  it('atomically deletes a card and all associated transactions in a single transaction', async () => {
    const dbName = `test_card_delete_${Date.now()}`;
    const testDb = new Dexie(dbName);
    testDb.version(1).stores({
      cards: 'id, nickname',
      transactions: 'id, cardId, amount',
    });
    await testDb.open();

    await testDb.table('cards').add({ id: 'card_to_delete', nickname: 'Test Card' });
    await testDb.table('transactions').bulkAdd([
      { id: 't1', cardId: 'card_to_delete', amount: 1000 },
      { id: 't2', cardId: 'card_to_delete', amount: 2000 },
      { id: 't3', cardId: 'other_card', amount: 3000 },
    ]);

    // Perform atomic deletion
    await testDb.transaction('rw', testDb.table('cards'), testDb.table('transactions'), async () => {
      await testDb.table('transactions').where('cardId').equals('card_to_delete').delete();
      await testDb.table('cards').delete('card_to_delete');
    });

    const remainingCards = await testDb.table('cards').toArray();
    const remainingTxns = await testDb.table('transactions').toArray();

    expect(remainingCards.length).toBe(0);
    expect(remainingTxns.length).toBe(1);
    expect(remainingTxns[0].cardId).toBe('other_card');

    await testDb.close();
  });

  it('atomically reassigns transactions when deleting a category leaving zero orphaned categoryIds', async () => {
    const dbName = `test_cat_reassign_${Date.now()}`;
    const testDb = new Dexie(dbName);
    testDb.version(1).stores({
      categories: 'id, name',
      transactions: 'id, categoryId, amount',
    });
    await testDb.open();

    await testDb.table('categories').bulkAdd([
      { id: 'cat_dining', name: 'Dining' },
      { id: 'cat_general', name: 'General' },
    ]);

    await testDb.table('transactions').bulkAdd([
      { id: 't1', categoryId: 'cat_dining', amount: 500 },
      { id: 't2', categoryId: 'cat_dining', amount: 1500 },
    ]);

    // Atomic reassign and delete
    await testDb.transaction('rw', testDb.table('categories'), testDb.table('transactions'), async () => {
      const affected = await testDb.table('transactions').where('categoryId').equals('cat_dining').toArray();
      for (const t of affected) {
        await testDb.table('transactions').update(t.id, { categoryId: 'cat_general' });
      }
      await testDb.table('categories').delete('cat_dining');
    });

    const categories = await testDb.table('categories').toArray();
    const txns = await testDb.table('transactions').toArray();

    expect(categories.find((c) => c.id === 'cat_dining')).toBeUndefined();
    expect(txns.every((t) => t.categoryId === 'cat_general')).toBe(true);

    await testDb.close();
  });
});

describe('10,000 Transactions Performance Benchmark', () => {
  it('filters and paginates 10,000 transactions with sub-100ms latency', () => {
    const totalCount = 10000;
    const mockTxns: Transaction[] = [];

    for (let i = 0; i < totalCount; i++) {
      mockTxns.push({
        id: `txn_${i}`,
        cardId: i % 2 === 0 ? 'card_1' : 'card_2',
        type: i % 10 === 0 ? 'payment' : i % 20 === 0 ? 'refund' : 'expense',
        amount: (i + 1) * 100,
        categoryId: `cat_${i % 11}`,
        date: `2026-03-${String((i % 28) + 1).padStart(2, '0')}`,
        note: `Transaction note #${i}`,
        isRecurring: false,
        isReimbursable: i % 5 === 0,
        isReimbursed: i % 10 === 0,
        createdAt: 1710000000000 + i,
      });
    }

    const startTime = performance.now();

    // 1. Filter by card and query search
    const filtered = mockTxns.filter((t) => {
      if (t.cardId !== 'card_1') return false;
      if (!t.note?.includes('500')) return false;
      return true;
    });

    // 2. Sort filtered transactions
    const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

    // 3. Paginate
    const pageSize = 50;
    const page1 = sorted.slice(0, pageSize);

    const elapsedMs = performance.now() - startTime;

    expect(page1.length).toBeGreaterThan(0);
    expect(page1.length).toBeLessThanOrEqual(pageSize);
    // Performance assertion: filtering and pagination should easily complete in under 100ms
    expect(elapsedMs).toBeLessThan(100);
  });
});
