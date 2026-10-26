import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Transaction, BillingCycle } from '../types';
import { TransactionModal } from '../components/TransactionModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatINR, parseINRInput } from '../lib/format';
import { formatDisplayDate, todayISO } from '../lib/dates';
import { getCycles, cycleSpend, billMatch } from '../lib/finance';
import { downloadCSV, downloadExcel } from '../lib/export';
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
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  AlertCircle,
  Download,
  FileSpreadsheet,
} from 'lucide-react';

export const TransactionsPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteConfirmTxn, setDeleteConfirmTxn] = useState<Transaction | null>(null);

  // View mode: 'all' or 'cycle'
  const [viewMode, setViewMode] = useState<'all' | 'cycle'>('all');

  // Selected card and cycle index for Cycle View
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [selectedCycleIndex, setSelectedCycleIndex] = useState<number>(0);

  // Bill match statement total input
  const [statementTotalInput, setStatementTotalInput] = useState<string>('');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCardId, setFilterCardId] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterReimbursable, setFilterReimbursable] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const transactions = useLiveQuery(() => db.transactions.toArray());
  const cards = useLiveQuery(() => db.cards.orderBy('createdAt').reverse().toArray());
  const categories = useLiveQuery(() => db.categories.toArray());

  const today = todayISO();

  // If cards load and no card is selected for Cycle View, select first card
  React.useEffect(() => {
    if (!selectedCardId && cards && cards.length > 0) {
      setSelectedCardId(cards[0].id);
    }
  }, [cards, selectedCardId]);

  const selectedCard = useMemo(() => {
    return cards?.find((c) => c.id === selectedCardId) || null;
  }, [cards, selectedCardId]);

  // Cycles for selected card (up to 12 cycles)
  const availableCycles = useMemo(() => {
    if (!selectedCard) return [];
    return getCycles(selectedCard, 12, today);
  }, [selectedCard, today]);

  const activeCycle: BillingCycle | null = useMemo(() => {
    if (availableCycles.length === 0) return null;
    return availableCycles[selectedCycleIndex] || availableCycles[0];
  }, [availableCycles, selectedCycleIndex]);

  const cardMap = useMemo(() => {
    const map = new Map<string, { nickname: string; last4: string; color?: string }>();
    cards?.forEach((c) => map.set(c.id, { nickname: c.nickname, last4: c.last4, color: c.color }));
    return map;
  }, [cards]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    categories?.forEach((c) => map.set(c.id, { name: c.name, color: c.color }));
    return map;
  }, [categories]);

  // Reimbursables grouped by person
  const reimbursableSummary = useMemo(() => {
    if (!transactions) return [];
    const unreimbursed = transactions.filter((t) => t.isReimbursable && !t.isReimbursed);
    const map = new Map<string, { total: number; count: number }>();

    unreimbursed.forEach((t) => {
      const person = t.reimbursableFrom?.trim() || 'Unspecified';
      const current = map.get(person) || { total: 0, count: 0 };
      map.set(person, {
        total: current.total + t.amount,
        count: current.count + 1,
      });
    });

    return Array.from(map.entries()).map(([person, data]) => ({
      person,
      total: data.total,
      count: data.count,
    }));
  }, [transactions]);

  // Filtering transactions
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];

    return transactions.filter((t) => {
      // If in cycle view, strictly limit to selected card and cycle date range
      if (viewMode === 'cycle') {
        if (!selectedCard || !activeCycle) return false;
        if (t.cardId !== selectedCard.id) return false;
        if (t.date < activeCycle.start || t.date > activeCycle.end) return false;
      }

      // Search query (matches note, category name, or amount)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const noteMatch = (t.note || '').toLowerCase().includes(q);
        const catName = t.categoryId ? (categoryMap.get(t.categoryId)?.name || '').toLowerCase() : '';
        const catMatch = catName.includes(q);
        const amountMatch = (t.amount / 100).toString().includes(q);
        if (!noteMatch && !catMatch && !amountMatch) return false;
      }

      // Card filter
      if (filterCardId && t.cardId !== filterCardId) return false;

      // Category filter
      if (filterCategoryId && t.categoryId !== filterCategoryId) return false;

      // Type filter
      if (filterType && t.type !== filterType) return false;

      // Reimbursable filter
      if (filterReimbursable === 'reimbursable' && !t.isReimbursable) return false;
      if (filterReimbursable === 'unreimbursed' && (!t.isReimbursable || t.isReimbursed)) return false;
      if (filterReimbursable === 'reimbursed' && (!t.isReimbursable || !t.isReimbursed)) return false;

      // Date range filter
      if (filterStartDate && t.date < filterStartDate) return false;
      if (filterEndDate && t.date > filterEndDate) return false;

      // Amount range filter
      if (filterMinAmount) {
        const minPaise = parseINRInput(filterMinAmount);
        if (minPaise > 0 && t.amount < minPaise) return false;
      }
      if (filterMaxAmount) {
        const maxPaise = parseINRInput(filterMaxAmount);
        if (maxPaise > 0 && t.amount > maxPaise) return false;
      }

      return true;
    });
  }, [
    transactions,
    viewMode,
    selectedCard,
    activeCycle,
    searchQuery,
    filterCardId,
    filterCategoryId,
    filterType,
    filterReimbursable,
    filterStartDate,
    filterEndDate,
    filterMinAmount,
    filterMaxAmount,
    categoryMap,
  ]);

  // Sort by date desc, then by createdAt desc
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return b.createdAt - a.createdAt;
    });
  }, [filteredTransactions]);

  // Filtered Totals
  const filteredTotals = useMemo(() => {
    let expenseSum = 0;
    let paymentSum = 0;
    let refundSum = 0;

    sortedTransactions.forEach((t) => {
      if (t.type === 'expense') expenseSum += t.amount;
      else if (t.type === 'payment') paymentSum += t.amount;
      else if (t.type === 'refund') refundSum += t.amount;
    });

    const netCycleSpend = expenseSum - refundSum;
    return { expenseSum, paymentSum, refundSum, netCycleSpend };
  }, [sortedTransactions]);

  // Cycle Spend for Bill Match
  const loggedCycleSpend = useMemo(() => {
    if (!transactions || !selectedCard || !activeCycle) return 0;
    return cycleSpend(transactions, activeCycle, selectedCard.id);
  }, [transactions, selectedCard, activeCycle]);

  // Bill Match calculation
  const billMatchResult = useMemo(() => {
    const statementPaise = parseINRInput(statementTotalInput);
    if (statementPaise <= 0) return null;
    return billMatch(loggedCycleSpend, statementPaise);
  }, [loggedCycleSpend, statementTotalInput]);

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

  const hasActiveFilters =
    searchQuery ||
    filterCardId ||
    filterCategoryId ||
    filterType ||
    filterReimbursable ||
    filterStartDate ||
    filterEndDate ||
    filterMinAmount ||
    filterMaxAmount;

  const resetFilters = () => {
    setSearchQuery('');
    setFilterCardId('');
    setFilterCategoryId('');
    setFilterType('');
    setFilterReimbursable('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterMinAmount('');
    setFilterMaxAmount('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#37352F]">Transactions</h1>
          <p className="text-sm text-[#787774] mt-0.5">
            Log, filter, and reconcile credit card transactions and billing cycles
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {sortedTransactions.length > 0 && (
            <>
              <button
                onClick={() => downloadCSV(sortedTransactions, cards || [], categories || [])}
                title="Export filtered transactions to CSV"
                className="inline-flex items-center gap-1.5 rounded border border-[#E9E9E7] bg-white px-3 py-2 text-xs font-medium text-[#37352F] hover:bg-[#F1F1EF] transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-[#787774]" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => downloadExcel(sortedTransactions, cards || [], categories || [])}
                title="Export filtered transactions to Excel"
                className="inline-flex items-center gap-1.5 rounded border border-[#E9E9E7] bg-white px-3 py-2 text-xs font-medium text-[#37352F] hover:bg-[#F1F1EF] transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#0F7B6C]" />
                <span>Export Excel</span>
              </button>
            </>
          )}

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded bg-[#37352F] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#201F1D] active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Transaction (N)</span>
          </button>
        </div>
      </div>

      {/* View Mode Tabs: All Transactions vs Billing Cycle View */}
      <div className="flex items-center justify-between border-b border-[#E9E9E7] pb-2 flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-[#F1F1EF] p-1 rounded border border-[#E9E9E7]">
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'all'
                ? 'bg-white text-[#37352F] shadow-xs'
                : 'text-[#787774] hover:text-[#37352F]'
            }`}
          >
            All Transactions
          </button>
          <button
            onClick={() => setViewMode('cycle')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'cycle'
                ? 'bg-white text-[#37352F] shadow-xs'
                : 'text-[#787774] hover:text-[#37352F]'
            }`}
          >
            Billing Cycle View
          </button>
        </div>

        {/* Toggle Filters Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-colors cursor-pointer ${
            showFilters || hasActiveFilters
              ? 'border-[#37352F] bg-[#F1F1EF] text-[#37352F]'
              : 'border-[#E9E9E7] bg-white text-[#787774] hover:text-[#37352F]'
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="h-2 w-2 rounded-full bg-[#0F7B6C]" />
          )}
        </button>
      </div>

      {/* Cycle View Toolbar (Only in Cycle Mode) */}
      {viewMode === 'cycle' && selectedCard && activeCycle && (
        <div className="rounded border border-[#E9E9E7] bg-white p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Card & Cycle Navigator */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Card selector */}
              <select
                value={selectedCardId}
                onChange={(e) => {
                  setSelectedCardId(e.target.value);
                  setSelectedCycleIndex(0);
                }}
                className="rounded border border-[#E9E9E7] bg-white px-2.5 py-1.5 text-xs font-medium text-[#37352F] focus:outline-hidden"
              >
                {cards?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nickname} (•••• {c.last4})
                  </option>
                ))}
              </select>

              {/* Cycle Pager */}
              <div className="flex items-center gap-1 border border-[#E9E9E7] rounded p-0.5 bg-[#FBFBFA]">
                <button
                  onClick={() => setSelectedCycleIndex((prev) => Math.min(availableCycles.length - 1, prev + 1))}
                  disabled={selectedCycleIndex >= availableCycles.length - 1}
                  title="Previous Billing Cycle"
                  className="flex h-7 w-7 items-center justify-center rounded text-[#787774] hover:bg-[#EFEFEF] hover:text-[#37352F] disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="px-3 text-xs text-[#37352F]">
                  <span className="font-semibold">
                    {formatDisplayDate(activeCycle.start, 'dd MMM yyyy')} – {formatDisplayDate(activeCycle.end, 'dd MMM yyyy')}
                  </span>
                  <span className="text-[11px] text-[#787774] ml-2">
                    {selectedCycleIndex === 0 ? '(Current Cycle)' : `(${selectedCycleIndex} cycles ago)`}
                  </span>
                </div>

                <button
                  onClick={() => setSelectedCycleIndex((prev) => Math.max(0, prev - 1))}
                  disabled={selectedCycleIndex <= 0}
                  title="Next Billing Cycle"
                  className="flex h-7 w-7 items-center justify-center rounded text-[#787774] hover:bg-[#EFEFEF] hover:text-[#37352F] disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Cycle Spend Metric */}
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-[#787774] block text-[11px]">Logged Cycle Spend</span>
                <span className="text-base font-bold text-[#37352F]">
                  {formatINR(loggedCycleSpend)}
                </span>
              </div>
              <div className="border-l border-[#E9E9E7] pl-4">
                <span className="text-[#787774] block text-[11px]">Statement Date</span>
                <span className="font-medium text-[#37352F]">
                  {formatDisplayDate(activeCycle.statementDate, 'dd MMM yyyy')}
                </span>
              </div>
              <div className="border-l border-[#E9E9E7] pl-4">
                <span className="text-[#787774] block text-[11px]">Payment Due Date</span>
                <span className="font-medium text-[#37352F]">
                  {formatDisplayDate(activeCycle.dueDate, 'dd MMM yyyy')}
                </span>
              </div>
            </div>
          </div>

          {/* Bill Match Check Section */}
          <div className="pt-3 border-t border-[#E9E9E7] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-[#FBFBFA] p-3 rounded">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-[#37352F] shrink-0" />
              <div>
                <span className="font-medium text-[#37352F]">Bill Match Check: </span>
                <span className="text-[#787774]">
                  Enter statement total from your credit card bill to check for missing expenses.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-xs text-[#787774]">₹</span>
                <input
                  type="text"
                  placeholder="Statement total"
                  value={statementTotalInput}
                  onChange={(e) => setStatementTotalInput(e.target.value)}
                  className="rounded border border-[#E9E9E7] bg-white pl-6 pr-2.5 py-1 text-xs text-[#37352F] focus:outline-hidden w-36"
                />
              </div>

              {billMatchResult && (
                <div
                  className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 ${
                    billMatchResult.status === 'matches'
                      ? 'bg-[#EDF6F3] text-[#0F7B6C]'
                      : billMatchResult.status === 'under'
                      ? 'bg-[#FBF3DB] text-[#8C4600]'
                      : 'bg-[#FBE4E4] text-[#E03E3E]'
                  }`}
                >
                  {billMatchResult.status === 'matches' && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {billMatchResult.status !== 'matches' && <AlertCircle className="h-3.5 w-3.5" />}
                  <span>{billMatchResult.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reimbursable Summary Bar (if any unreimbursed expenses) */}
      {reimbursableSummary.length > 0 && (
        <div className="rounded border border-[#E9E9E7] bg-white p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-[#D9730D] shrink-0" />
            <span className="font-semibold text-[#37352F]">Owed Reimbursements:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {reimbursableSummary.map((item) => (
                <button
                  key={item.person}
                  onClick={() => {
                    setFilterReimbursable('unreimbursed');
                    setShowFilters(true);
                  }}
                  className="inline-flex items-center gap-1 rounded bg-[#FBF3DB] px-2 py-0.5 text-[11px] font-medium text-[#8C4600] hover:bg-[#F9E8B8] transition-colors"
                >
                  <span>{item.person}:</span>
                  <strong>{formatINR(item.total)}</strong>
                  <span className="text-[10px] text-[#A67C00]">({item.count})</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              setFilterReimbursable('unreimbursed');
              setShowFilters(true);
            }}
            className="text-[11px] text-[#787774] hover:text-[#37352F] self-start sm:self-auto cursor-pointer"
          >
            Filter unreimbursed
          </button>
        </div>
      )}

      {/* Search & Combined Filter Bar */}
      <div className="space-y-3">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#787774]" />
          <input
            type="text"
            placeholder="Search transactions by note, category name, or amount..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded border border-[#E9E9E7] bg-white pl-9 pr-8 py-2 text-xs text-[#37352F] placeholder-[#787774] focus:border-[#37352F] focus:outline-hidden"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-[#787774] hover:text-[#37352F]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Collapsible Combined Filters Tray */}
        {showFilters && (
          <div className="rounded border border-[#E9E9E7] bg-white p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E9E9E7]">
              <span className="text-xs font-semibold text-[#37352F]">Filter Criteria</span>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-xs text-[#E03E3E] hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {/* Card Filter */}
              <div>
                <label className="block text-[11px] font-medium text-[#787774] mb-1">Card</label>
                <select
                  value={filterCardId}
                  onChange={(e) => setFilterCardId(e.target.value)}
                  className="w-full rounded border border-[#E9E9E7] bg-white p-1.5 text-xs text-[#37352F]"
                >
                  <option value="">All Cards</option>
                  {cards?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nickname} (•••• {c.last4})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-[11px] font-medium text-[#787774] mb-1">Category</label>
                <select
                  value={filterCategoryId}
                  onChange={(e) => setFilterCategoryId(e.target.value)}
                  className="w-full rounded border border-[#E9E9E7] bg-white p-1.5 text-xs text-[#37352F]"
                >
                  <option value="">All Categories</option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-[11px] font-medium text-[#787774] mb-1">Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full rounded border border-[#E9E9E7] bg-white p-1.5 text-xs text-[#37352F]"
                >
                  <option value="">All Types</option>
                  <option value="expense">Expense</option>
                  <option value="payment">Bill Payment</option>
                  <option value="refund">Refund</option>
                </select>
              </div>

              {/* Reimbursable Filter */}
              <div>
                <label className="block text-[11px] font-medium text-[#787774] mb-1">Reimbursable</label>
                <select
                  value={filterReimbursable}
                  onChange={(e) => setFilterReimbursable(e.target.value)}
                  className="w-full rounded border border-[#E9E9E7] bg-white p-1.5 text-xs text-[#37352F]"
                >
                  <option value="">All</option>
                  <option value="reimbursable">Reimbursable Only</option>
                  <option value="unreimbursed">Unreimbursed (Owed)</option>
                  <option value="reimbursed">Reimbursed</option>
                </select>
              </div>

              {/* Date Start */}
              <div>
                <label className="block text-[11px] font-medium text-[#787774] mb-1">Start Date</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full rounded border border-[#E9E9E7] bg-white p-1.5 text-xs text-[#37352F]"
                />
              </div>

              {/* Date End */}
              <div>
                <label className="block text-[11px] font-medium text-[#787774] mb-1">End Date</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full rounded border border-[#E9E9E7] bg-white p-1.5 text-xs text-[#37352F]"
                />
              </div>

              {/* Min Amount */}
              <div>
                <label className="block text-[11px] font-medium text-[#787774] mb-1">Min Amount (₹)</label>
                <input
                  type="text"
                  placeholder="0"
                  value={filterMinAmount}
                  onChange={(e) => setFilterMinAmount(e.target.value)}
                  className="w-full rounded border border-[#E9E9E7] bg-white p-1.5 text-xs text-[#37352F]"
                />
              </div>

              {/* Max Amount */}
              <div>
                <label className="block text-[11px] font-medium text-[#787774] mb-1">Max Amount (₹)</label>
                <input
                  type="text"
                  placeholder="No limit"
                  value={filterMaxAmount}
                  onChange={(e) => setFilterMaxAmount(e.target.value)}
                  className="w-full rounded border border-[#E9E9E7] bg-white p-1.5 text-xs text-[#37352F]"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Result Count and Combined Totals */}
      <div className="flex items-center justify-between text-xs text-[#787774] flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong>{sortedTransactions.length}</strong> transaction
            {sortedTransactions.length === 1 ? '' : 's'}
          </span>
          {hasActiveFilters && (
            <span className="rounded bg-[#F1F1EF] px-2 py-0.5 text-[11px] text-[#37352F]">
              Filtered
            </span>
          )}
        </div>

        {sortedTransactions.length > 0 && (
          <div className="flex items-center gap-4">
            <div>
              <span>Expenses: </span>
              <strong className="text-[#37352F]">{formatINR(filteredTotals.expenseSum)}</strong>
            </div>
            {filteredTotals.paymentSum > 0 && (
              <div>
                <span>Payments: </span>
                <strong className="text-[#0F7B6C]">{formatINR(filteredTotals.paymentSum)}</strong>
              </div>
            )}
            {filteredTotals.refundSum > 0 && (
              <div>
                <span>Refunds: </span>
                <strong className="text-[#0B6E99]">{formatINR(filteredTotals.refundSum)}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transactions Table or Empty State */}
      {sortedTransactions.length === 0 ? (
        <div className="rounded border border-[#E9E9E7] bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F6F3] text-[#787774] mb-3">
            <ArrowLeftRight className="h-6 w-6" />
          </div>
          <h3 className="text-base font-medium text-[#37352F]">No matching transactions</h3>
          <p className="text-sm text-[#787774] max-w-sm mx-auto mt-1 mb-5">
            {hasActiveFilters
              ? 'No transactions matched the current search query or filter combination.'
              : 'Log your daily card spending or bill payments to keep your available credit in sync.'}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded bg-[#37352F] px-4 py-2 text-xs font-medium text-white hover:bg-[#201F1D] cursor-pointer"
            >
              <span>Reset Filters</span>
            </button>
          ) : (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 rounded bg-[#37352F] px-4 py-2 text-xs font-medium text-white hover:bg-[#201F1D] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Log Your First Transaction</span>
            </button>
          )}
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
