import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatINR } from '../lib/format';
import { todayISO, formatDisplayDate } from '../lib/dates';
import {
  calculateOutstanding,
  calculateAvailableLimit,
  calculateUtilization,
  getCycle,
  daysLeftInCycle,
  daysUntilDue,
  cycleSpend,
} from '../lib/finance';
import {
  CreditCard,
  Plus,
  ArrowRight,
  AlertTriangle,
  Clock,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
} from 'lucide-react';
import { TransactionModal } from '../components/TransactionModal';

export const DashboardPage: React.FC = () => {
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const cards = useLiveQuery(() => db.cards.orderBy('createdAt').reverse().toArray());
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const settings = useLiveQuery(() => db.settings.get('main'));
  const categories = useLiveQuery(() => db.categories.toArray());

  const categoryMap = React.useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    categories?.forEach((c) => map.set(c.id, { name: c.name, color: c.color }));
    return map;
  }, [categories]);

  const cardMap = React.useMemo(() => {
    const map = new Map<string, { nickname: string; last4: string; color?: string }>();
    cards?.forEach((c) => map.set(c.id, { nickname: c.nickname, last4: c.last4, color: c.color }));
    return map;
  }, [cards]);

  const today = todayISO();
  const reminderDays = settings?.reminderDaysBeforeDue ?? 3;

  // Aggregate stats across all cards
  const stats = React.useMemo(() => {
    if (!cards || cards.length === 0) {
      return { totalLimit: 0, totalOutstanding: 0, totalAvailable: 0, totalCycleSpend: 0 };
    }

    let totalLimit = 0;
    let totalOutstanding = 0;
    let totalCycleSpend = 0;

    cards.forEach((card) => {
      totalLimit += card.limit;
      const outstanding = calculateOutstanding(transactions || [], card.id);
      totalOutstanding += outstanding;

      const cycle = getCycle(card, today);
      const spend = cycleSpend(transactions || [], cycle, card.id);
      totalCycleSpend += spend;
    });

    const totalAvailable = totalLimit - totalOutstanding;
    return { totalLimit, totalOutstanding, totalAvailable, totalCycleSpend };
  }, [cards, transactions, today]);

  // Due date alerts (cards with due date within reminderDaysBeforeDue or overdue)
  const dueAlerts = React.useMemo(() => {
    if (!cards || cards.length === 0) return [];

    return cards
      .map((card) => {
        const cycle = getCycle(card, today);
        const dueDays = daysUntilDue(card, today);
        const outstanding = calculateOutstanding(transactions || [], card.id);
        return { card, cycle, dueDays, outstanding };
      })
      .filter((item) => item.dueDays <= reminderDays && item.outstanding > 0);
  }, [cards, transactions, today, reminderDays]);

  // Recent 5 transactions
  const recentTransactions = React.useMemo(() => {
    if (!transactions) return [];
    return [...transactions]
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.createdAt - a.createdAt;
      })
      .slice(0, 5);
  }, [transactions]);

  const hasCards = cards && cards.length > 0;

  return (
    <div className="space-y-6">
      {/* Due Date Alert Banners */}
      {dueAlerts.length > 0 && (
        <div className="space-y-2">
          {dueAlerts.map(({ card, cycle, dueDays, outstanding }) => {
            const isOverdue = dueDays < 0;
            return (
              <div
                key={card.id}
                className={`flex items-center justify-between gap-3 rounded border p-3.5 text-xs ${
                  isOverdue
                    ? 'border-[#E03E3E] bg-[#FBE4E4] text-[#E03E3E]'
                    : 'border-[#D9730D] bg-[#FBF3DB] text-[#8C4600]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <div>
                    <span className="font-semibold">
                      {isOverdue ? 'Payment Overdue: ' : 'Payment Due Soon: '}
                    </span>
                    <span>
                      {card.nickname} (•••• {card.last4}) bill of{' '}
                      <strong>{formatINR(outstanding)}</strong> is{' '}
                      {isOverdue
                        ? `${Math.abs(dueDays)} days overdue (was due ${formatDisplayDate(
                            cycle.dueDate,
                            'dd MMM'
                          )})`
                        : dueDays === 0
                        ? `due TODAY (${formatDisplayDate(cycle.dueDate, 'dd MMM')})`
                        : `due on ${formatDisplayDate(cycle.dueDate, 'dd MMM')} (in ${dueDays} days)`}
                      .
                    </span>
                  </div>
                </div>

                <Link
                  to="/transactions"
                  className="shrink-0 rounded bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-[#37352F] hover:bg-white transition-colors"
                >
                  Pay Now
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#37352F]">Dashboard</h1>
          <p className="text-sm text-[#787774] mt-0.5">
            Credit card limits, current cycle spending, and upcoming payments
          </p>
        </div>

        {hasCards && (
          <button
            onClick={() => setQuickAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded bg-[#37352F] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#201F1D] active:scale-95 transition-all shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Quick Add (N)</span>
          </button>
        )}
      </div>

      {!hasCards ? (
        <div className="rounded border border-[#E9E9E7] bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F6F3] text-[#787774] mb-3">
            <CreditCard className="h-6 w-6" />
          </div>
          <h3 className="text-base font-medium text-[#37352F]">No credit cards configured</h3>
          <p className="text-sm text-[#787774] max-w-sm mx-auto mt-1 mb-5">
            Start by adding your credit cards to track available limits and match spending to your billing cycle.
          </p>
          <Link
            to="/cards"
            className="inline-flex items-center gap-1.5 rounded bg-[#37352F] px-4 py-2 text-xs font-medium text-white hover:bg-[#201F1D] transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add Credit Card</span>
          </Link>
        </div>
      ) : (
        <>
          {/* Overview Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Available Limit */}
            <div className="rounded border border-[#E9E9E7] bg-white p-4">
              <span className="text-[11px] font-medium text-[#787774] uppercase tracking-wider block">
                Total Available Credit
              </span>
              <span
                className={`text-2xl font-bold tracking-tight block mt-1 ${
                  stats.totalAvailable < 0 ? 'text-[#E03E3E]' : 'text-[#37352F]'
                }`}
              >
                {formatINR(stats.totalAvailable)}
              </span>
              <span className="text-xs text-[#787774] mt-0.5 block">
                across {cards.length} card{cards.length > 1 ? 's' : ''} (Limit: {formatINR(stats.totalLimit)})
              </span>
            </div>

            {/* Total Outstanding */}
            <div className="rounded border border-[#E9E9E7] bg-white p-4">
              <span className="text-[11px] font-medium text-[#787774] uppercase tracking-wider block">
                Total Outstanding
              </span>
              <span
                className={`text-2xl font-bold tracking-tight block mt-1 ${
                  stats.totalOutstanding < 0 ? 'text-[#0F7B6C]' : 'text-[#37352F]'
                }`}
              >
                {stats.totalOutstanding < 0
                  ? `+${formatINR(Math.abs(stats.totalOutstanding))} (Credit)`
                  : formatINR(stats.totalOutstanding)}
              </span>
              <span className="text-xs text-[#787774] mt-0.5 block">
                {stats.totalOutstanding < 0 ? 'Overpaid balance' : 'Total dues & unbilled balance'}
              </span>
            </div>

            {/* Current Cycle Spend */}
            <div className="rounded border border-[#E9E9E7] bg-white p-4">
              <span className="text-[11px] font-medium text-[#787774] uppercase tracking-wider block">
                Current Cycle Spend
              </span>
              <span className="text-2xl font-bold tracking-tight text-[#37352F] block mt-1">
                {formatINR(stats.totalCycleSpend)}
              </span>
              <span className="text-xs text-[#787774] mt-0.5 block">
                Net expenses in active statement cycles
              </span>
            </div>
          </div>

          {/* Cards Breakdown List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#37352F] tracking-tight">Your Cards</h2>
              <Link
                to="/cards"
                className="inline-flex items-center gap-1 text-xs text-[#787774] hover:text-[#37352F] transition-colors"
              >
                <span>Manage cards</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cards.map((card) => {
                const outstanding = calculateOutstanding(transactions || [], card.id);
                const availableLimit = calculateAvailableLimit(card.limit, outstanding);
                const utilization = calculateUtilization(card.limit, outstanding);
                const cycle = getCycle(card, today);
                const daysLeft = daysLeftInCycle(card, today);
                const dueDays = daysUntilDue(card, today);
                const spend = cycleSpend(transactions || [], cycle, card.id);

                let statusColor = '#0F7B6C';
                let statusBg = '#EDF6F3';
                let statusLabel = `${Math.round(utilization * 100)}% utilization`;

                if (utilization > 1) {
                  statusColor = '#E03E3E';
                  statusBg = '#FBE4E4';
                  statusLabel = `${Math.round(utilization * 100)}% (Over Limit)`;
                } else if (utilization > 0.7) {
                  statusColor = '#E03E3E';
                  statusBg = '#FBE4E4';
                } else if (utilization >= 0.3) {
                  statusColor = '#D9730D';
                  statusBg = '#FBF3DB';
                }

                return (
                  <div
                    key={card.id}
                    className="rounded border border-[#E9E9E7] bg-white p-4 transition-all hover:border-[#D3D2CE]"
                  >
                    {/* Card Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: card.color || '#37352F' }}
                        />
                        <span className="font-semibold text-sm text-[#37352F]">
                          {card.nickname}
                        </span>
                        <span className="font-mono text-xs text-[#787774]">•••• {card.last4}</span>
                      </div>

                      <span
                        className="px-2 py-0.5 rounded text-[11px] font-medium"
                        style={{ color: statusColor, backgroundColor: statusBg }}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-[#E9E9E7] overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(0, utilization * 100))}%`,
                          backgroundColor: statusColor,
                        }}
                      />
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs py-2 border-t border-b border-[#E9E9E7] my-3">
                      <div>
                        <span className="text-[#787774] block text-[11px]">Available Limit</span>
                        <span
                          className={`font-semibold block ${
                            availableLimit < 0 ? 'text-[#E03E3E]' : 'text-[#37352F]'
                          }`}
                        >
                          {formatINR(availableLimit)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#787774] block text-[11px]">Current Cycle Spend</span>
                        <span className="font-semibold text-[#37352F] block">
                          {formatINR(spend)}
                        </span>
                      </div>
                    </div>

                    {/* Statement and Due Date countdown */}
                    <div className="flex items-center justify-between text-[11px] text-[#787774] pt-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Cycle closes: {formatDisplayDate(cycle.end, 'dd MMM')} ({daysLeft}d left)</span>
                      </div>

                      <div className="flex items-center gap-1 font-medium">
                        <Clock className="h-3 w-3" />
                        <span
                          className={
                            dueDays < 0
                              ? 'text-[#E03E3E]'
                              : dueDays <= 3
                              ? 'text-[#D9730D]'
                              : 'text-[#37352F]'
                          }
                        >
                          Pay by {formatDisplayDate(cycle.dueDate, 'dd MMM')} (
                          {dueDays < 0 ? `${Math.abs(dueDays)}d overdue` : dueDays === 0 ? 'Today' : `${dueDays}d`})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Transactions Section */}
          <div className="rounded border border-[#E9E9E7] bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#37352F] tracking-tight">
                Recent Transactions
              </h2>
              <Link
                to="/transactions"
                className="inline-flex items-center gap-1 text-xs text-[#787774] hover:text-[#37352F] transition-colors"
              >
                <span>View all</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#787774]">
                No transactions recorded yet. Click "Quick Add (N)" to record an expense or payment.
              </div>
            ) : (
              <div className="divide-y divide-[#E9E9E7]">
                {recentTransactions.map((txn) => {
                  const card = cardMap.get(txn.cardId);
                  const category = txn.categoryId ? categoryMap.get(txn.categoryId) : undefined;

                  return (
                    <div
                      key={txn.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Type Icon */}
                        <div className="h-7 w-7 rounded flex items-center justify-center shrink-0 bg-[#F7F6F3]">
                          {txn.type === 'expense' && <ArrowDownLeft className="h-3.5 w-3.5 text-[#E03E3E]" />}
                          {txn.type === 'payment' && <ArrowUpRight className="h-3.5 w-3.5 text-[#0F7B6C]" />}
                          {txn.type === 'refund' && <RotateCcw className="h-3.5 w-3.5 text-[#0B6E99]" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-medium text-[#37352F]">
                              {txn.type === 'payment'
                                ? 'Bill Payment'
                                : category?.name || 'Uncategorized'}
                            </span>
                            {txn.note && (
                              <span className="text-[#787774] truncate max-w-xs">
                                • {txn.note}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#787774] flex items-center gap-2 mt-0.5">
                            <span>{formatDisplayDate(txn.date, 'dd MMM yyyy')}</span>
                            {card && <span>• {card.nickname} (•••• {card.last4})</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-semibold">
                        {txn.type === 'expense' && (
                          <span className="text-[#37352F]">-{formatINR(txn.amount)}</span>
                        )}
                        {txn.type === 'payment' && (
                          <span className="text-[#0F7B6C]">+{formatINR(txn.amount)}</span>
                        )}
                        {txn.type === 'refund' && (
                          <span className="text-[#0B6E99]">+{formatINR(txn.amount)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Quick Add Modal */}
      <TransactionModal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />
    </div>
  );
};
