export type Card = {
  id: string;
  nickname: string;          // e.g. "HDFC Regalia"
  last4: string;             // exactly 4 digits
  limit: number;             // paise
  statementDay: number;      // 1 to 31
  dueDay: number;            // 1 to 31
  color?: string;
  createdAt: number;
};

export type Category = {
  id: string;
  name: string;
  color: string;
  monthlyBudget?: number;    // paise, optional (budget per billing cycle)
  isDefault: boolean;
};

export type TransactionType = 'expense' | 'payment' | 'refund';

export type Transaction = {
  id: string;
  cardId: string;
  type: TransactionType;
  amount: number;            // paise, always positive
  categoryId?: string;       // required for expense and refund, not used for payment
  date: string;              // ISO date YYYY-MM-DD
  note?: string;
  isRecurring: boolean;
  recurringFrequency?: 'monthly' | 'yearly';
  isReimbursable: boolean;
  reimbursableFrom?: string; // person name, optional
  isReimbursed: boolean;
  createdAt: number;
};

export type Settings = {
  id: 'main';
  reminderDaysBeforeDue: number;   // default 3
  budgetAlertPercent: number;      // default 80
};

export type BillingCycle = {
  start: string;         // YYYY-MM-DD (day after previous statement date)
  end: string;           // YYYY-MM-DD (statement date)
  statementDate: string; // YYYY-MM-DD
  dueDate: string;       // YYYY-MM-DD
};
