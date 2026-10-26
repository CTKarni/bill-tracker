import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Category } from '../types';
import { Modal } from '../components/Modal';
import { formatINR, parseINRInput, paiseToInputString, validateAmount } from '../lib/format';
import { todayISO } from '../lib/dates';
import { getCycle, budgetStatus } from '../lib/finance';
import {
  PiggyBank,
  Pencil,
  Plus,
} from 'lucide-react';

export const BudgetsPage: React.FC = () => {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [budgetRupees, setBudgetRupees] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [saving, setSaving] = useState(false);

  const categories = useLiveQuery(() => db.categories.toArray());
  const cards = useLiveQuery(() => db.cards.toArray());
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const settings = useLiveQuery(() => db.settings.get('main'));

  const alertPercent = settings?.budgetAlertPercent ?? 80;
  const today = todayISO();

  // Compute spend per category in the current active billing cycle(s)
  // If user has cards, spending is matched against each card's current cycle
  const categorySpendMap = React.useMemo(() => {
    const map = new Map<string, number>();
    if (!transactions || !cards || cards.length === 0) {
      // Fallback: spending in the current calendar month
      const currentMonthPrefix = today.slice(0, 7);
      transactions?.forEach((t) => {
        if (t.categoryId && t.date.startsWith(currentMonthPrefix)) {
          const delta = t.type === 'expense' ? t.amount : t.type === 'refund' ? -t.amount : 0;
          map.set(t.categoryId, (map.get(t.categoryId) || 0) + delta);
        }
      });
      return map;
    }

    // For each card, get current cycle and sum category spend
    cards.forEach((card) => {
      const cycle = getCycle(card, today);
      const cardTxns = transactions.filter((t) => t.cardId === card.id && t.date >= cycle.start && t.date <= cycle.end);
      cardTxns.forEach((t) => {
        if (t.categoryId) {
          const delta = t.type === 'expense' ? t.amount : t.type === 'refund' ? -t.amount : 0;
          map.set(t.categoryId, (map.get(t.categoryId) || 0) + delta);
        }
      });
    });

    return map;
  }, [transactions, cards, today]);

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setBudgetRupees(category.monthlyBudget ? paiseToInputString(category.monthlyBudget) : '');
    setBudgetError('');
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    if (budgetRupees.trim()) {
      const check = validateAmount(budgetRupees, { allowZero: true });
      if (!check.valid) {
        setBudgetError(check.error || 'Please enter a valid amount');
        return;
      }
    }

    setSaving(true);
    try {
      const budgetPaise = parseINRInput(budgetRupees);
      await db.categories.update(editingCategory.id, {
        monthlyBudget: budgetPaise > 0 ? budgetPaise : undefined,
      });
      setEditingCategory(null);
    } catch (err) {
      console.error('Failed to update category budget:', err);
      setBudgetError('Failed to save budget.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearBudget = async () => {
    if (!editingCategory) return;
    setSaving(true);
    try {
      await db.categories.update(editingCategory.id, {
        monthlyBudget: undefined,
      });
      setEditingCategory(null);
    } catch (err) {
      console.error('Failed to clear budget:', err);
    } finally {
      setSaving(false);
    }
  };

  // Aggregates for categories with budgets set
  const budgetedCategories = React.useMemo(() => {
    return categories?.filter((c) => (c.monthlyBudget ?? 0) > 0) || [];
  }, [categories]);

  const unbudgetedCategories = React.useMemo(() => {
    return categories?.filter((c) => !c.monthlyBudget || c.monthlyBudget <= 0) || [];
  }, [categories]);

  const totals = React.useMemo(() => {
    let totalBudget = 0;
    let totalSpent = 0;

    budgetedCategories.forEach((c) => {
      const b = c.monthlyBudget || 0;
      const s = Math.max(0, categorySpendMap.get(c.id) || 0);
      totalBudget += b;
      totalSpent += s;
    });

    const overallStatus = budgetStatus(totalSpent, totalBudget, alertPercent);
    return { totalBudget, totalSpent, remaining: totalBudget - totalSpent, overallStatus };
  }, [budgetedCategories, categorySpendMap, alertPercent]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#37352F]">Category Budgets</h1>
          <p className="text-sm text-[#5F5E5B] mt-0.5">
            Set target spend per category per billing cycle. Alerts trigger at {alertPercent}%.
          </p>
        </div>
      </div>

      {/* Aggregate Stats */}
      {budgetedCategories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded border border-[#E9E9E7] bg-white p-4">
            <span className="text-[11px] font-medium text-[#5F5E5B] uppercase tracking-wider block">
              Total Monthly Budget
            </span>
            <span className="text-2xl font-bold tracking-tight text-[#37352F] block mt-1">
              {formatINR(totals.totalBudget)}
            </span>
            <span className="text-xs text-[#5F5E5B] mt-0.5 block">
              across {budgetedCategories.length} configured categories
            </span>
          </div>

          <div className="rounded border border-[#E9E9E7] bg-white p-4">
            <span className="text-[11px] font-medium text-[#5F5E5B] uppercase tracking-wider block">
              Total Spent in Cycle
            </span>
            <span className="text-2xl font-bold tracking-tight text-[#37352F] block mt-1">
              {formatINR(totals.totalSpent)}
            </span>
            <span className="text-xs text-[#5F5E5B] mt-0.5 block">
              {totals.overallStatus.percent}% of combined budget
            </span>
          </div>

          <div className="rounded border border-[#E9E9E7] bg-white p-4">
            <span className="text-[11px] font-medium text-[#5F5E5B] uppercase tracking-wider block">
              Remaining Budget
            </span>
            <span
              className={`text-2xl font-bold tracking-tight block mt-1 ${
                totals.remaining < 0 ? 'text-[#E03E3E]' : 'text-[#0F7B6C]'
              }`}
            >
              {totals.remaining < 0
                ? `-${formatINR(Math.abs(totals.remaining))} Over`
                : formatINR(totals.remaining)}
            </span>
            <span className="text-xs text-[#5F5E5B] mt-0.5 block">
              {totals.remaining < 0 ? 'Over budgeted limit' : 'Safe to spend'}
            </span>
          </div>
        </div>
      )}

      {/* Budgeted Categories Section */}
      <div>
        <h2 className="text-sm font-semibold text-[#37352F] tracking-tight mb-3">
          Active Category Budgets ({budgetedCategories.length})
        </h2>

        {budgetedCategories.length === 0 ? (
          <div className="rounded border border-[#E9E9E7] bg-white p-8 text-center">
            <PiggyBank className="h-8 w-8 text-[#5F5E5B] mx-auto mb-2" />
            <h3 className="text-sm font-medium text-[#37352F]">No category budgets set yet</h3>
            <p className="text-xs text-[#5F5E5B] max-w-sm mx-auto mt-1 mb-4">
              Set spending limits on Food & Dining, Shopping, or Groceries to monitor cycle expenses and receive threshold alerts.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgetedCategories.map((cat) => {
              const spent = Math.max(0, categorySpendMap.get(cat.id) || 0);
              const budget = cat.monthlyBudget || 0;
              const { status, percent } = budgetStatus(spent, budget, alertPercent);
              const remaining = budget - spent;

              let statusColor = '#0F7B6C'; // Green
              let statusBg = '#EDF6F3';
              let statusText = `${percent}% used`;

              if (status === 'over') {
                statusColor = '#E03E3E'; // Red
                statusBg = '#FBE4E4';
                statusText = `${percent}% (Over budget)`;
              } else if (status === 'warning') {
                statusColor = '#D9730D'; // Amber
                statusBg = '#FBF3DB';
                statusText = `${percent}% (Alert threshold)`;
              }

              return (
                <div
                  key={cat.id}
                  className="rounded border border-[#E9E9E7] bg-white p-4 transition-all hover:border-[#D3D2CE]"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-semibold text-sm text-[#37352F]">{cat.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded"
                        style={{ color: statusColor, backgroundColor: statusBg }}
                      >
                        {statusText}
                      </span>
                      <button
                        onClick={() => handleOpenEdit(cat)}
                        title="Edit Budget"
                        className="flex h-6 w-6 items-center justify-center rounded text-[#5F5E5B] hover:bg-[#F1F1EF] hover:text-[#37352F] transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-[#E9E9E7] overflow-hidden my-3">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, percent))}%`,
                        backgroundColor: statusColor,
                      }}
                    />
                  </div>

                  {/* Metrics */}
                  <div className="flex items-center justify-between text-xs text-[#5F5E5B]">
                    <div>
                      <span>Spent: </span>
                      <strong className="text-[#37352F]">{formatINR(spent)}</strong>
                      <span> of {formatINR(budget)}</span>
                    </div>
                    <div>
                      {remaining < 0 ? (
                        <span className="font-semibold text-[#E03E3E]">
                          Over by {formatINR(Math.abs(remaining))}
                        </span>
                      ) : (
                        <span className="text-[#0F7B6C] font-medium">
                          {formatINR(remaining)} left
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unbudgeted Categories */}
      {unbudgetedCategories.length > 0 && (
        <div className="rounded border border-[#E9E9E7] bg-white p-4">
          <h2 className="text-sm font-semibold text-[#37352F] tracking-tight mb-2">
            Categories Without a Budget
          </h2>
          <p className="text-xs text-[#5F5E5B] mb-3">
            Click any category to define a monthly spending target.
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            {unbudgetedCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleOpenEdit(cat)}
                className="inline-flex items-center gap-1.5 rounded border border-[#E9E9E7] bg-[#FBFBFA] px-2.5 py-1.5 text-xs text-[#37352F] hover:bg-[#F1F1EF] transition-colors cursor-pointer"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span>{cat.name}</span>
                <Plus className="h-3 w-3 text-[#5F5E5B]" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit Category Budget Modal */}
      <Modal
        isOpen={!!editingCategory}
        onClose={() => setEditingCategory(null)}
        title={`Set Budget for ${editingCategory?.name}`}
        description="Define a spending limit per billing cycle for this category."
        maxWidth="sm"
      >
        <form onSubmit={handleSaveBudget} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#37352F] mb-1">
              Monthly Budget (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-[#5F5E5B]">₹</span>
              <input
                type="text"
                autoFocus
                placeholder="10,000"
                value={budgetRupees}
                onChange={(e) => setBudgetRupees(e.target.value)}
                className="w-full rounded border border-[#E9E9E7] bg-white pl-7 pr-3 py-2 text-base font-semibold text-[#37352F] focus:border-[#37352F] focus:outline-hidden"
              />
            </div>
            <p className="text-[11px] text-[#5F5E5B] mt-1">
              Leave blank or 0 to remove budget for this category.
            </p>
            {budgetError && (
              <p className="text-[11px] text-[#E03E3E] mt-1">{budgetError}</p>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#E9E9E7]">
            {editingCategory?.monthlyBudget ? (
              <button
                type="button"
                onClick={handleClearBudget}
                disabled={saving}
                className="text-xs text-[#E03E3E] hover:underline"
              >
                Remove Budget
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="rounded border border-[#E9E9E7] bg-white px-3 py-1.5 text-xs font-medium text-[#37352F] hover:bg-[#F1F1EF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-[#37352F] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#201F1D] active:scale-95 transition-all shadow-xs"
              >
                {saving ? 'Saving...' : 'Save Budget'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
