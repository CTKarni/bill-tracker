import { z } from 'zod';

export const MAX_BACKUP_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const CardSchema = z.object({
  id: z.string().min(1),
  nickname: z.string().min(1),
  last4: z.string().regex(/^\d{4}$/, 'last4 must be exactly 4 digits'),
  limit: z.number().int().positive('limit must be a positive integer in paise'),
  statementDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  color: z.string().optional(),
  createdAt: z.number().int(),
});

const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  monthlyBudget: z.number().int().positive().optional(),
  isDefault: z.boolean().default(false),
});

const TransactionSchema = z.object({
  id: z.string().min(1),
  cardId: z.string().min(1),
  type: z.enum(['expense', 'payment', 'refund']),
  amount: z.number().int().positive('amount must be a positive integer in paise'),
  categoryId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be ISO YYYY-MM-DD'),
  note: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringFrequency: z.enum(['monthly', 'yearly']).optional(),
  isReimbursable: z.boolean().default(false),
  reimbursableFrom: z.string().optional(),
  isReimbursed: z.boolean().default(false),
  createdAt: z.number().int(),
});

const SettingsSchema = z.object({
  id: z.literal('main'),
  reminderDaysBeforeDue: z.number().int().min(1).max(30),
  budgetAlertPercent: z.number().int().min(1).max(100),
  lastBackupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const BackupPayloadSchema = z.object({
  version: z.number().int().optional(),
  cards: z.array(CardSchema),
  categories: z.array(CategorySchema),
  transactions: z.array(TransactionSchema),
  settings: SettingsSchema.optional(),
});

export type BackupPayload = z.infer<typeof BackupPayloadSchema>;

/**
 * Checks if an object or any nested property contains prototype pollution keys.
 */
export function hasPrototypePollution(data: unknown): boolean {
  if (data === null || typeof data !== 'object') {
    return false;
  }

  // Check if the object's prototype was overridden (e.g. via __proto__ in object literal or JSON)
  const proto = Object.getPrototypeOf(data);
  if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) {
    return true;
  }

  // Check own property names for explicit prototype pollution keys
  const keys = Object.getOwnPropertyNames(data);
  for (const key of keys) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }
    const val = (data as Record<string, unknown>)[key];
    if (typeof val === 'object' && val !== null) {
      if (hasPrototypePollution(val)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validates raw JSON string or object against strict schema and prototype pollution.
 * Rejects entire payload if any record is invalid.
 */
export function validateBackupJSON(rawText: string): {
  success: boolean;
  data?: BackupPayload;
  error?: string;
} {
  // Fast regex check on raw text for prototype pollution keys
  if (/"(?:__proto__|constructor|prototype)"\s*:/i.test(rawText)) {
    return {
      success: false,
      error: 'Security alert: Dangerous prototype pollution keys detected in backup file.',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      success: false,
      error: 'Malformed JSON syntax. Could not parse file.',
    };
  }

  if (hasPrototypePollution(parsed)) {
    return {
      success: false,
      error: 'Security alert: Prototype pollution keys detected.',
    };
  }

  const result = BackupPayloadSchema.safeParse(parsed);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const pathStr = firstIssue ? firstIssue.path.join('.') : 'root';
    const msg = firstIssue ? firstIssue.message : 'Invalid structure';
    return {
      success: false,
      error: `Validation error at "${pathStr}": ${msg}. The entire backup has been rejected.`,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
