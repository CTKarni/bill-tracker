import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Transaction } from '../types';
import { formatINR } from '../lib/format';
import { todayISO, formatDisplayDate } from '../lib/dates';
import { TransactionModal } from '../components/TransactionModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  CalendarClock,
  Plus,
  Trash2,
  Calendar,
  Check,
  Sparkles,
} from 'lucide-react';

export const SubscriptionsPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmTxn, setDeleteConfirmTxn] = useState<Transaction | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  const transactions = useLiveQuery(() => db.transactions.toArray());
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

  // Filter recurring transactions
  const recurringTemplates = React.useMemo(() => {
    if (!transactions) return [];
    // Unique recurring items
    const map = new Map<string, Transaction>();
    transactions
      .filter((t) => t.isRecurring)
      .forEach((t) => {
        const key = `${t.cardId}_${t.categoryId || ''}_${t.note || ''}_${t.amount}_${t.recurringFrequency || 'monthly'}`;
        if (!map.has(key) || t.createdAt > map.get(key)!.createdAt) {
          map.set(key, t);
        }
      });
    return Array.from(map.values());
  }, [transactions]);

  // Aggregate monthly costs
  const monthlyTotals = React.useMemo(() => {
    let monthlyPaise = 0;
    recurringTemplates.forEach((sub) => {
      if (sub.recurringFrequency === 'yearly') {
        monthlyPaise += Math.round(sub.amount / 12);
      } else {
        monthlyPaise += sub.amount;
      }
    });

    const yearlyPaise = monthlyPaise * 12;
    return { monthlyPaise, yearlyPaise };
  }, [recurringTemplates]);

  // "Add this month's charge" action
  const handleAddThisMonth = async (template: Transaction) => {
    const newTxn: Transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      cardId: template.cardId,
      type: template.type,
      amount: template.amount,
      categoryId: template.categoryId,
      date: todayISO(),
      note: template.note ? `${template.note} (Auto-log)` : 'Subscription charge',
      isRecurring: false, // The logged charge itself is not the template
      isReimbursable: template.isReimbursable,
      reimbursableFrom: template.reimbursableFrom,
      isReimbursed: false,
      createdAt: Date.now(),
    };

    await db.transactions.add(newTxn);
    setRecentlyAddedId(template.id);
    setTimeout(() => setRecentlyAddedId(null), 2500);
  };

  const handleDeleteTemplate = async () => {
    if (!deleteConfirmTxn) return;
    await db.transactions.delete(deleteConfirmTxn.id);
    setDeleteConfirmTxn(null);
  };

  // Compute next expected billing date
  const getNextBillingDate = (sub: Transaction): string => {
    const [, m, d] = sub.date.split('-').map(Number);
    const today = new Date();

    if (sub.recurringFrequency === 'yearly') {
      let targetYear = today.getFullYear();
      const thisYearDate = new Date(targetYear, m - 1, d);
      if (thisYearDate < today) {
        targetYear++;
      }
      return `${targetYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    } else {
      // Monthly
      let targetMonth = today.getMonth();
      let targetYear = today.getFullYear();
      const thisMonthDate = new Date(targetYear, targetMonth, d);
      if (thisMonthDate < today) {
        targetMonth++;
        if (targetMonth > 11) {
          targetMonth = 0;
          targetYear++;
        }
      }
      return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#37352F]">Subscriptions & Recurring</h1>
          <p className="text-sm text-[#5F5E5B] mt-0.5">
            Monitor recurring monthly and annual credit card charges
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded bg-[#37352F] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#201F1D] active:scale-95 transition-all shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>New Subscription</span>
        </button>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded border border-[#E9E9E7] bg-white p-4">
          <span className="text-[11px] font-medium text-[#5F5E5B] uppercase tracking-wider block">
            Estimated Monthly Cost
          </span>
          <span className="text-2xl font-bold tracking-tight text-[#37352F] block mt-1">
            {formatINR(monthlyTotals.monthlyPaise)}
          </span>
          <span className="text-xs text-[#5F5E5B] mt-0.5 block">
            averaged across {recurringTemplates.length} recurring items
          </span>
        </div>

        <div className="rounded border border-[#E9E9E7] bg-white p-4">
          <span className="text-[11px] font-medium text-[#5F5E5B] uppercase tracking-wider block">
            Annual Commitment
          </span>
          <span className="text-2xl font-bold tracking-tight text-[#37352F] block mt-1">
            {formatINR(monthlyTotals.yearlyPaise)}
          </span>
          <span className="text-xs text-[#5F5E5B] mt-0.5 block">
            yearly projected spend
          </span>
        </div>

        <div className="rounded border border-[#E9E9E7] bg-white p-4">
          <span className="text-[11px] font-medium text-[#5F5E5B] uppercase tracking-wider block">
            Active Subscriptions
          </span>
          <span className="text-2xl font-bold tracking-tight text-[#37352F] block mt-1">
            {recurringTemplates.length}
          </span>
          <span className="text-xs text-[#5F5E5B] mt-0.5 block">
            services, utilities & memberships
          </span>
        </div>
      </div>

      {/* Subscriptions List */}
      <div>
        <h2 className="text-sm font-semibold text-[#37352F] tracking-tight mb-3">
          Tracked Subscriptions ({recurringTemplates.length})
        </h2>

        {recurringTemplates.length === 0 ? (
          <div className="rounded border border-[#E9E9E7] bg-white p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F6F3] text-[#5F5E5B] mb-3">
              <CalendarClock className="h-6 w-6" />
            </div>
            <h3 className="text-base font-medium text-[#37352F]">No recurring subscriptions</h3>
            <p className="text-sm text-[#5F5E5B] max-w-sm mx-auto mt-1 mb-5">
              Add recurring charges (like Netflix, Spotify, AWS, or gym memberships) to track monthly costs and quickly log recurring payments.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded bg-[#37352F] px-4 py-2 text-xs font-medium text-white hover:bg-[#201F1D] transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Recurring Item</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recurringTemplates.map((sub) => {
              const card = cardMap.get(sub.cardId);
              const category = sub.categoryId ? categoryMap.get(sub.categoryId) : undefined;
              const nextDate = getNextBillingDate(sub);
              const isAdded = recentlyAddedId === sub.id;

              return (
                <div
                  key={sub.id}
                  className="rounded border border-[#E9E9E7] bg-white p-4 flex flex-col justify-between transition-all hover:border-[#D3D2CE]"
                >
                  <div>
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm text-[#37352F] truncate">
                          {sub.note || category?.name || 'Recurring Subscription'}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-[#5F5E5B] mt-0.5">
                          {category && (
                            <span className="flex items-center gap-1">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: category.color }}
                              />
                              <span>{category.name}</span>
                            </span>
                          )}
                          {card && (
                            <span>
                              • {card.nickname} (•••• {card.last4})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-bold text-[#37352F] block">
                          {formatINR(sub.amount)}
                        </span>
                        <span className="text-[11px] text-[#5F5E5B] uppercase tracking-wider">
                          /{sub.recurringFrequency || 'monthly'}
                        </span>
                      </div>
                    </div>

                    {/* Next date badge */}
                    <div className="flex items-center gap-1.5 text-xs text-[#5F5E5B] mt-3 pt-3 border-t border-[#E9E9E7]">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Next expected charge: </span>
                      <strong className="text-[#37352F]">
                        {formatDisplayDate(nextDate, 'dd MMM yyyy')}
                      </strong>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-[#E9E9E7]">
                    <button
                      onClick={() => setDeleteConfirmTxn(sub)}
                      title="Delete subscription"
                      className="text-xs text-[#5F5E5B] hover:text-[#E03E3E] transition-colors p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => handleAddThisMonth(sub)}
                      disabled={isAdded}
                      className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                        isAdded
                          ? 'bg-[#EDF6F3] text-[#0F7B6C]'
                          : 'bg-[#37352F] text-white hover:bg-[#201F1D] active:scale-95 shadow-xs'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Added to Transactions!</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Add this month's charge</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Subscription Modal */}
      <TransactionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultRecurring={true}
      />

      {/* Delete Subscription Template Confirm */}
      <ConfirmDialog
        isOpen={!!deleteConfirmTxn}
        onClose={() => setDeleteConfirmTxn(null)}
        onConfirm={handleDeleteTemplate}
        title="Remove Subscription"
        message="Are you sure you want to remove this recurring subscription template? Past logged transactions will remain untouched."
        confirmLabel="Remove"
        cancelLabel="Keep"
        isDestructive={true}
      />
    </div>
  );
};
