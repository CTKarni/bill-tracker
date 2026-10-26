import { describe, it, expect } from 'vitest';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './index';

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
