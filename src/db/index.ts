import Dexie, { type EntityTable } from 'dexie';
import type { Card, Category, Transaction, Settings } from '../types';

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Food and Dining', color: '#E03E3E', isDefault: true },
  { name: 'Groceries', color: '#0F7B6C', isDefault: true },
  { name: 'Shopping', color: '#6940A5', isDefault: true },
  { name: 'Travel', color: '#0B6E99', isDefault: true },
  { name: 'Fuel', color: '#D9730D', isDefault: true },
  { name: 'Bills and Utilities', color: '#4D6461', isDefault: true },
  { name: 'Entertainment', color: '#AD1A72', isDefault: true },
  { name: 'Subscriptions', color: '#5C3882', isDefault: true },
  { name: 'Health', color: '#DF5452', isDefault: true },
  { name: 'Education', color: '#337EA9', isDefault: true },
  { name: 'Other', color: '#5F5E5B', isDefault: true },
];

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  reminderDaysBeforeDue: 3,
  budgetAlertPercent: 80,
};

export class ExpenseTrackerDB extends Dexie {
  cards!: EntityTable<Card, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor() {
    super('CreditCardTrackerDB');
    this.version(1).stores({
      cards: 'id, nickname, last4, createdAt',
      categories: 'id, name, isDefault',
      transactions: 'id, cardId, type, categoryId, date, isRecurring, isReimbursable, isReimbursed, createdAt',
      settings: 'id',
    });
  }
}

export const db = new ExpenseTrackerDB();

export async function initializeDatabase(): Promise<void> {
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.put(DEFAULT_SETTINGS);
  }

  const categoriesCount = await db.categories.count();
  if (categoriesCount === 0) {
    const categoriesWithId: Category[] = DEFAULT_CATEGORIES.map((cat, idx) => ({
      ...cat,
      id: `cat_default_${idx + 1}`,
    }));
    await db.categories.bulkPut(categoriesWithId);
  }
}
