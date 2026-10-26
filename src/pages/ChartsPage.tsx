import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { BillingCycle } from '../types';
import { formatINR } from '../lib/format';
import { todayISO, formatDisplayDate } from '../lib/dates';
import { getCycles, categoryTotals, monthlyTotals } from '../lib/finance';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  PieChart as PieChartIcon,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const PALETTE = [
  '#0F7B6C', // teal/green
  '#2B6CB0', // blue
  '#D9730D', // amber
  '#9B2C2C', // red
  '#6B46C1', // purple
  '#4D6461', // sage
  '#AD1A72', // rose
  '#787774', // slate
  '#337EA9', // cyan
  '#DF5452', // coral
  '#C05621', // rust
];

export const ChartsPage: React.FC = () => {
  const [selectedCardId, setSelectedCardId] = useState<string>('all');
  const [selectedCycleIndex, setSelectedCycleIndex] = useState<number>(0);
  const [excludeReimbursable, setExcludeReimbursable] = useState<boolean>(false);

  const cards = useLiveQuery(() => db.cards.orderBy('createdAt').reverse().toArray());
  const transactions = useLiveQuery(() => db.transactions.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());

  const today = todayISO();

  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    categories?.forEach((c) => map.set(c.id, { name: c.name, color: c.color }));
    return map;
  }, [categories]);

  // Card reference for cycles
  const referenceCard = useMemo(() => {
    if (!cards || cards.length === 0) return null;
    if (selectedCardId !== 'all') {
      return cards.find((c) => c.id === selectedCardId) || cards[0];
    }
    return cards[0];
  }, [cards, selectedCardId]);

  const availableCycles = useMemo(() => {
    if (!referenceCard) return [];
    return getCycles(referenceCard, 6, today);
  }, [referenceCard, today]);

  const activeCycle: BillingCycle | null = useMemo(() => {
    if (availableCycles.length === 0) return null;
    return availableCycles[selectedCycleIndex] || availableCycles[0];
  }, [availableCycles, selectedCycleIndex]);

  // Filter transactions based on excludeReimbursable and selectedCard
  const eligibleTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((t) => {
      if (excludeReimbursable && t.isReimbursable) return false;
      if (selectedCardId !== 'all' && t.cardId !== selectedCardId) return false;
      return true;
    });
  }, [transactions, excludeReimbursable, selectedCardId]);

  // (1) Category Breakdown for Active Cycle
  const categoryChartData = useMemo(() => {
    if (!activeCycle || eligibleTransactions.length === 0) return [];
    const totals = categoryTotals(eligibleTransactions, activeCycle);

    const data: { name: string; value: number; color: string }[] = [];
    let paletteIdx = 0;

    Object.entries(totals).forEach(([catId, amountPaise]) => {
      if (amountPaise > 0) {
        const cat = categoryMap.get(catId);
        const name = cat?.name || 'Uncategorized';
        const color = cat?.color || PALETTE[paletteIdx % PALETTE.length];
        paletteIdx++;
        data.push({
          name,
          value: amountPaise / 100, // In Rupees for chart scale
          color,
        });
      }
    });

    return data.sort((a, b) => b.value - a.value);
  }, [eligibleTransactions, activeCycle, categoryMap]);

  const totalCycleSpendRupees = useMemo(() => {
    return categoryChartData.reduce((acc, curr) => acc + curr.value, 0);
  }, [categoryChartData]);

  // (2) Month-over-Month spend comparison (last 6 calendar months)
  const monthlyChartData = useMemo(() => {
    const rawMonthly = monthlyTotals(eligibleTransactions, 6);
    return rawMonthly.map((m) => ({
      name: m.label,
      spendRupees: Math.max(0, m.spend / 100),
      rawPaise: m.spend,
    }));
  }, [eligibleTransactions]);

  const hasData = eligibleTransactions.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#37352F]">Analytics & Trends</h1>
          <p className="text-sm text-[#787774] mt-0.5">
            Spending breakdowns and historical month-over-month comparisons
          </p>
        </div>

        {/* Global Filter Bar: Exclude Reimbursable & Card Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Reimbursable toggle */}
          <label className="flex items-center gap-2 text-xs font-medium text-[#37352F] cursor-pointer bg-white border border-[#E9E9E7] px-3 py-1.5 rounded hover:bg-[#FBFBFA]">
            <input
              type="checkbox"
              checked={excludeReimbursable}
              onChange={(e) => setExcludeReimbursable(e.target.checked)}
              className="rounded border-[#E9E9E7] text-[#37352F] focus:ring-0"
            />
            <span>Exclude reimbursable spending</span>
          </label>

          {/* Card filter */}
          {cards && cards.length > 1 && (
            <select
              value={selectedCardId}
              onChange={(e) => {
                setSelectedCardId(e.target.value);
                setSelectedCycleIndex(0);
              }}
              className="rounded border border-[#E9E9E7] bg-white px-3 py-1.5 text-xs text-[#37352F] font-medium focus:outline-hidden"
            >
              <option value="all">All Cards</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname} (•••• {c.last4})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="rounded border border-[#E9E9E7] bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F6F3] text-[#787774] mb-3">
            <PieChartIcon className="h-6 w-6" />
          </div>
          <h3 className="text-base font-medium text-[#37352F]">No spend analytics yet</h3>
          <p className="text-sm text-[#787774] max-w-sm mx-auto mt-1">
            Log transactions to visualize category breakdowns and compare spending trends across billing cycles.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Chart 1: Category Breakdown for Active Cycle */}
          <div className="rounded border border-[#E9E9E7] bg-white p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#E9E9E7]">
              <div>
                <h2 className="text-sm font-semibold text-[#37352F] tracking-tight">
                  Cycle Spending Breakdown
                </h2>
                {activeCycle && (
                  <p className="text-xs text-[#787774] mt-0.5">
                    Cycle: {formatDisplayDate(activeCycle.start, 'dd MMM yyyy')} –{' '}
                    {formatDisplayDate(activeCycle.end, 'dd MMM yyyy')}
                  </p>
                )}
              </div>

              {/* Cycle Paging */}
              {availableCycles.length > 1 && (
                <div className="flex items-center gap-1 border border-[#E9E9E7] rounded p-0.5 bg-[#FBFBFA]">
                  <button
                    onClick={() =>
                      setSelectedCycleIndex((prev) => Math.min(availableCycles.length - 1, prev + 1))
                    }
                    disabled={selectedCycleIndex >= availableCycles.length - 1}
                    title="Previous cycle"
                    className="flex h-6 w-6 items-center justify-center rounded text-[#787774] hover:bg-[#EFEFEF] disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[11px] text-[#37352F] px-2 font-medium">
                    {selectedCycleIndex === 0 ? 'Current Cycle' : `${selectedCycleIndex} cycles ago`}
                  </span>
                  <button
                    onClick={() => setSelectedCycleIndex((prev) => Math.max(0, prev - 1))}
                    disabled={selectedCycleIndex <= 0}
                    title="Next cycle"
                    className="flex h-6 w-6 items-center justify-center rounded text-[#787774] hover:bg-[#EFEFEF] disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {categoryChartData.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#787774]">
                No expenses logged in this cycle date range.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Donut Chart */}
                <div className="h-64 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={2}
                      >
                        {categoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: unknown) => [
                          formatINR(typeof val === 'number' ? val * 100 : 0),
                          'Spend',
                        ]}
                        contentStyle={{
                          backgroundColor: '#FBFBFA',
                          borderColor: '#E9E9E7',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Stat */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[11px] font-medium text-[#787774] uppercase tracking-wider">
                      Total
                    </span>
                    <span className="text-sm font-bold text-[#37352F]">
                      {formatINR(totalCycleSpendRupees * 100)}
                    </span>
                  </div>
                </div>

                {/* Category Legend & Proportions Table */}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {categoryChartData.map((entry) => {
                    const percentage = Math.round((entry.value / totalCycleSpendRupees) * 100);
                    return (
                      <div
                        key={entry.name}
                        className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-[#FBFBFA] border border-transparent hover:border-[#E9E9E7]"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="font-medium text-[#37352F]">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[#787774] font-mono text-[11px]">{percentage}%</span>
                          <span className="font-semibold text-[#37352F]">
                            {formatINR(entry.value * 100)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Chart 2: Month-over-Month Comparison */}
          <div className="rounded border border-[#E9E9E7] bg-white p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E9E9E7] mb-4">
              <div>
                <h2 className="text-sm font-semibold text-[#37352F] tracking-tight">
                  Month-over-Month Spend (Last 6 Months)
                </h2>
                <p className="text-xs text-[#787774] mt-0.5">
                  Calendar month totals (expenses minus refunds)
                </p>
              </div>
              <BarChart3 className="h-4 w-4 text-[#787774]" />
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <XAxis
                    dataKey="name"
                    stroke="#787774"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E9E9E7' }}
                  />
                  <YAxis
                    stroke="#787774"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#E9E9E7' }}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip
                    formatter={(val: unknown) => [
                      formatINR(typeof val === 'number' ? val * 100 : 0),
                      'Total Spend',
                    ]}
                    contentStyle={{
                      backgroundColor: '#FBFBFA',
                      borderColor: '#E9E9E7',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="spendRupees" fill="#37352F" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
