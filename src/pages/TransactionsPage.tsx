import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Transaction } from '../types';
import { TransactionModal } from '../components/TransactionModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatINR } from '../lib/format';
import { formatDisplayDate } from '../lib/dates';
import {
  ArrowLeftRight,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  UserCheck,
} from 'lucide-react';

export const TransactionsPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteConfirmTxn, setDeleteConfirmTxn] = useState<Transaction | null>(null);

  const transactions = useLiveQuery(() =>
    db.transactions.orderBy('date').reverse().toArray()
  );
  const cards = useLiveQuery(() => db.cards.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());

  const cardMap = React.useMemo(() => {
    const map = new Map<string, { nickname: string; last4: string; color?: string }>();
    cards?.forEach((c) => map.set(c.id, { nickname: c.nickname, last4: c.last4, color: c.color }));
    return map;
  }, [cards]);

  const categoryMap = React.useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    categories?.forEach((c) => map.set(c.id, { name: c.name, color: c.color }));
    return map;
  }, [categories]);

  const handleOpenAdd = () => {
    setEditingTransaction(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (txn: Transaction) => {
    setEditingTransaction(txn);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirmTxn) return;
    await db.transactions.delete(deleteConfirmTxn.id);
    setDeleteConfirmTxn(null);
  };

  const handleToggleReimbursed = async (txn: Transaction) => {
    await db.transactions.update(txn.id, {
      isReimbursed: !txn.isReimbursed,
    });
  };

  // Sort by date desc, then by createdAt desc
  const sortedTransactions = React.useMemo(() => {
    if (!transactions) return [];
    return [...transactions].sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return b.createdAt - a.createdAt;
    });
  }, [transactions]);

  // Overall totals
  const totals = React.useMemo(() => {
    let expenseSum = 0;
    let paymentSum = 0;
    let refundSum = 0;

    sortedTransactions.forEach((t) => {
      if (t.type === 'expense') expenseSum += t.amount;
      else if (t.type === 'payment') paymentSum += t.amount;
      else if (t.type === 'refund') refundSum += t.amount;
    });

    return { expenseSum, paymentSum, refundSum };
  }, [sortedTransactions]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#37352F]">Transactions</h1>
          <p className="text-sm text-[#787774] mt-0.5">
            Log, track, and reconcile all credit card spending, payments, and refunds
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 rounded bg-[#37352F] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#201F1D] active:scale-95 transition-all shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Transaction</span>
        </button>
      </div>

      {/* Summary Chips */}
      {sortedTransactions.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap text-xs text-[#787774]">
          <div className="rounded border border-[#E9E9E7] bg-white px-3 py-1.5 flex items-center gap-2">
            <span>Total Expenses:</span>
            <span className="font-semibold text-[#37352F]">{formatINR(totals.expenseSum)}</span>
          </div>
          <div className="rounded border border-[#E9E9E7] bg-white px-3 py-1.5 flex items-center gap-2">
            <span>Bill Payments:</span>
            <span className="font-semibold text-[#0F7B6C]">{formatINR(totals.paymentSum)}</span>
          </div>
          {totals.refundSum > 0 && (
            <div className="rounded border border-[#E9E9E7] bg-white px-3 py-1.5 flex items-center gap-2">
              <span>Refunds / Cashbacks:</span>
              <span className="font-semibold text-[#0B6E99]">{formatINR(totals.refundSum)}</span>
            </div>
          )}
          <div className="text-[11px] text-[#787774] ml-auto">
            {sortedTransactions.length} total entries
          </div>
        </div>
      )}

      {/* Transactions Table or Empty State */}
      {sortedTransactions.length === 0 ? (
        <div className="rounded border border-[#E9E9E7] bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F6F3] text-[#787774] mb-3">
            <ArrowLeftRight className="h-6 w-6" />
          </div>
          <h3 className="text-base font-medium text-[#37352F]">No transactions logged yet</h3>
          <p className="text-sm text-[#787774] max-w-sm mx-auto mt-1 mb-5">
            Log your daily card spending, bill payments, or refunds to keep your available credit in sync.
          </p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded bg-[#37352F] px-4 py-2 text-xs font-medium text-white hover:bg-[#201F1D] transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Log Your First Transaction</span>
          </button>
        </div>
      ) : (
        <div className="rounded border border-[#E9E9E7] bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E9E9E7] bg-[#F7F6F3] text-[#787774] font-medium uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Card</th>
                  <th className="py-3 px-4">Note</th>
                  <th className="py-3 px-4">Reimbursable</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right w-16">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9E9E7] text-[#37352F]">
                {sortedTransactions.map((txn) => {
                  const card = cardMap.get(txn.cardId);
                  const category = txn.categoryId ? categoryMap.get(txn.categoryId) : undefined;

                  return (
                    <tr
                      key={txn.id}
                      className="hover:bg-[#FBFBFA] transition-colors group"
                    >
                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-[#37352F]">
                        {formatDisplayDate(txn.date, 'dd MMM yyyy')}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {txn.type === 'expense' && (
                          <span className="inline-flex items-center gap-1 rounded bg-[#F1F1EF] px-2 py-0.5 text-[11px] font-medium text-[#37352F]">
                            <ArrowDownLeft className="h-3 w-3 text-[#E03E3E]" />
                            <span>Expense</span>
                          </span>
                        )}
                        {txn.type === 'payment' && (
                          <span className="inline-flex items-center gap-1 rounded bg-[#EDF6F3] px-2 py-0.5 text-[11px] font-medium text-[#0F7B6C]">
                            <ArrowUpRight className="h-3 w-3 text-[#0F7B6C]" />
                            <span>Payment</span>
                          </span>
                        )}
                        {txn.type === 'refund' && (
                          <span className="inline-flex items-center gap-1 rounded bg-[#EBF3F5] px-2 py-0.5 text-[11px] font-medium text-[#0B6E99]">
                            <RotateCcw className="h-3 w-3 text-[#0B6E99]" />
                            <span>Refund</span>
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {txn.type === 'payment' ? (
                          <span className="text-[#787774] italic">Bill payment</span>
                        ) : category ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#37352F]">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: category.color }}
                            />
                            <span>{category.name}</span>
                          </span>
                        ) : (
                          <span className="text-[#787774]">Uncategorized</span>
                        )}
                      </td>

                      {/* Card */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {card ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#37352F]">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: card.color || '#37352F' }}
                            />
                            <span className="font-medium">{card.nickname}</span>
                            <span className="font-mono text-[#787774]">•••• {card.last4}</span>
                          </span>
                        ) : (
                          <span className="text-[#787774] italic">Deleted Card</span>
                        )}
                      </td>

                      {/* Note */}
                      <td className="py-3 px-4 max-w-xs truncate text-[#787774]">
                        {txn.note || '—'}
                      </td>

                      {/* Reimbursable */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {txn.isReimbursable ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleReimbursed(txn)}
                              title={
                                txn.isReimbursed
                                  ? 'Mark as not reimbursed'
                                  : 'Click to mark as reimbursed'
                              }
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                                txn.isReimbursed
                                  ? 'bg-[#EDF6F3] text-[#0F7B6C] hover:bg-[#D7EFE7]'
                                  : 'bg-[#FBF3DB] text-[#D9730D] hover:bg-[#F9E8B8]'
                              }`}
                            >
                              {txn.isReimbursed ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>Reimbursed</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3 w-3" />
                                  <span>
                                    {txn.reimbursableFrom
                                      ? `Owed from ${txn.reimbursableFrom}`
                                      : 'Owed'}
                                  </span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[#A2A09A]">—</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 whitespace-nowrap text-right font-semibold">
                        {txn.type === 'expense' && (
                          <span className="text-[#37352F]">-{formatINR(txn.amount)}</span>
                        )}
                        {txn.type === 'payment' && (
                          <span className="text-[#0F7B6C]">+{formatINR(txn.amount)}</span>
                        )}
                        {txn.type === 'refund' && (
                          <span className="text-[#0B6E99]">+{formatINR(txn.amount)}</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenEdit(txn)}
                            title="Edit Transaction"
                            className="flex h-6 w-6 items-center justify-center rounded text-[#787774] hover:bg-[#EFEFEF] hover:text-[#37352F] transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmTxn(txn)}
                            title="Delete Transaction"
                            className="flex h-6 w-6 items-center justify-center rounded text-[#787774] hover:bg-[#FBE4E4] hover:text-[#E03E3E] transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      <TransactionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        transactionToEdit={editingTransaction}
      />

      {/* Delete Transaction Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirmTxn}
        onClose={() => setDeleteConfirmTxn(null)}
        onConfirm={handleDelete}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This will automatically update your card outstanding and available limit."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDestructive={true}
      />
    </div>
  );
};
