import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { Transaction, Card, Category } from '../types';

export interface ExportRow {
  Date: string;
  Card: string;
  Type: string;
  Category: string;
  'Amount (₹)': number;
  Note: string;
  Recurring: string;
  Frequency: string;
  Reimbursable: string;
  'Reimbursed From': string;
  'Reimbursement Status': string;
}

export function prepareExportData(
  transactions: Transaction[],
  cards: Card[],
  categories: Category[]
): ExportRow[] {
  const cardMap = new Map<string, string>();
  cards.forEach((c) => cardMap.set(c.id, `${c.nickname} (•••• ${c.last4})`));

  const categoryMap = new Map<string, string>();
  categories.forEach((c) => categoryMap.set(c.id, c.name));

  return transactions.map((t) => {
    const cardName = cardMap.get(t.cardId) || 'Unknown Card';
    const catName = t.type === 'payment' ? 'Bill Payment' : t.categoryId ? (categoryMap.get(t.categoryId) || 'Uncategorized') : 'Uncategorized';
    const amountRupees = Number((t.amount / 100).toFixed(2));

    return {
      Date: t.date,
      Card: cardName,
      Type: t.type.charAt(0).toUpperCase() + t.type.slice(1),
      Category: catName,
      'Amount (₹)': amountRupees,
      Note: t.note || '',
      Recurring: t.isRecurring ? 'Yes' : 'No',
      Frequency: t.isRecurring ? t.recurringFrequency || 'Monthly' : '—',
      Reimbursable: t.isReimbursable ? 'Yes' : 'No',
      'Reimbursed From': t.reimbursableFrom || '—',
      'Reimbursement Status': !t.isReimbursable
        ? '—'
        : t.isReimbursed
        ? 'Reimbursed'
        : 'Owed',
    };
  });
}

export function downloadCSV(
  transactions: Transaction[],
  cards: Card[],
  categories: Category[],
  filename: string = 'credit_card_transactions.csv'
): void {
  const data = prepareExportData(transactions, cards, categories);
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadExcel(
  transactions: Transaction[],
  cards: Card[],
  categories: Category[],
  filename: string = 'credit_card_transactions.xlsx'
): void {
  const data = prepareExportData(transactions, cards, categories);
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
  XLSX.writeFile(workbook, filename);
}
