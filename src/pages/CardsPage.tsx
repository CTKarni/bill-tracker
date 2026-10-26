import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Card } from '../types';
import { CardFormModal } from '../components/CardFormModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatINR } from '../lib/format';
import { todayISO, formatDisplayDate } from '../lib/dates';
import {
  calculateOutstanding,
  calculateAvailableLimit,
  calculateUtilization,
  getCycle,
  daysLeftInCycle,
  daysUntilDue,
} from '../lib/finance';
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Clock,
} from 'lucide-react';

export const CardsPage: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [deleteConfirmCard, setDeleteConfirmCard] = useState<Card | null>(null);

  const cards = useLiveQuery(() => db.cards.orderBy('createdAt').reverse().toArray());
  const transactions = useLiveQuery(() => db.transactions.toArray());

  const handleOpenAdd = () => {
    setEditingCard(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (card: Card) => {
    setEditingCard(card);
    setModalOpen(true);
  };

  const handleSaveCard = async (
    cardData: Omit<Card, 'id' | 'createdAt'> & { id?: string }
  ) => {
    if (cardData.id) {
      await db.cards.update(cardData.id, {
        nickname: cardData.nickname,
        last4: cardData.last4,
        limit: cardData.limit,
        statementDay: cardData.statementDay,
        dueDay: cardData.dueDay,
        color: cardData.color,
      });
    } else {
      const newCard: Card = {
        id: `card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        nickname: cardData.nickname,
        last4: cardData.last4,
        limit: cardData.limit,
        statementDay: cardData.statementDay,
        dueDay: cardData.dueDay,
        color: cardData.color,
        createdAt: Date.now(),
      };
      await db.cards.add(newCard);
    }
  };

  const handleDeleteCard = async () => {
    if (!deleteConfirmCard) return;
    const cardId = deleteConfirmCard.id;
    // Deleting a card deletes all associated transactions as per the spec
    await db.transaction('rw', db.cards, db.transactions, async () => {
      await db.transactions.where('cardId').equals(cardId).delete();
      await db.cards.delete(cardId);
    });
    setDeleteConfirmCard(null);
  };

  const today = todayISO();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#37352F]">Cards</h1>
          <p className="text-sm text-[#787774] mt-0.5">
            Manage your credit cards, credit limits, and billing cycle cut-offs
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 rounded bg-[#37352F] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#201F1D] active:scale-95 transition-all shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Card</span>
        </button>
      </div>

      {/* Cards List or Empty State */}
      {!cards || cards.length === 0 ? (
        <div className="rounded border border-[#E9E9E7] bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F6F3] text-[#787774] mb-3">
            <CreditCard className="h-6 w-6" />
          </div>
          <h3 className="text-base font-medium text-[#37352F]">No credit cards yet</h3>
          <p className="text-sm text-[#787774] max-w-sm mx-auto mt-1 mb-5">
            Add your first credit card with its limit, statement day, and due day to start tracking available balance.
          </p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 rounded bg-[#37352F] px-4 py-2 text-xs font-medium text-white hover:bg-[#201F1D] transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Your First Card</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => {
            const outstanding = calculateOutstanding(transactions || [], card.id);
            const availableLimit = calculateAvailableLimit(card.limit, outstanding);
            const utilization = calculateUtilization(card.limit, outstanding);
            const cycle = getCycle(card, today);
            const daysLeft = daysLeftInCycle(card, today);
            const dueDays = daysUntilDue(card, today);

            // Status Colors according to Section 3:
            // green (<30%), amber (30-70%), red (>70% or over limit)
            let statusColor = '#0F7B6C'; // Green
            let statusBg = '#EDF6F3';
            let statusLabel = `${Math.round(utilization * 100)}% utilization`;

            if (utilization > 1) {
              statusColor = '#E03E3E'; // Red
              statusBg = '#FBE4E4';
              statusLabel = `${Math.round(utilization * 100)}% (Over Limit)`;
            } else if (utilization > 0.7) {
              statusColor = '#E03E3E'; // Red
              statusBg = '#FBE4E4';
            } else if (utilization >= 0.3) {
              statusColor = '#D9730D'; // Amber
              statusBg = '#FBF3DB';
            }

            const isCreditBalance = outstanding < 0;

            return (
              <div
                key={card.id}
                className="rounded border border-[#E9E9E7] bg-white p-5 transition-shadow hover:shadow-xs flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-8 w-8 rounded flex items-center justify-center text-white shrink-0 font-mono text-xs font-semibold"
                        style={{ backgroundColor: card.color || '#37352F' }}
                      >
                        CC
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[#37352F] tracking-tight">
                          {card.nickname}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-[#787774] font-mono">
                          <span>•••• {card.last4}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(card)}
                        title="Edit Card"
                        className="flex h-7 w-7 items-center justify-center rounded text-[#787774] hover:bg-[#F1F1EF] hover:text-[#37352F] transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmCard(card)}
                        title="Delete Card"
                        className="flex h-7 w-7 items-center justify-center rounded text-[#787774] hover:bg-[#FBE4E4] hover:text-[#E03E3E] transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Financial Metrics */}
                  <div className="mt-5 grid grid-cols-2 gap-3 pb-4 border-b border-[#E9E9E7]">
                    <div>
                      <span className="text-[11px] font-medium text-[#787774] block uppercase tracking-wider">
                        Available Limit
                      </span>
                      <span
                        className={`text-lg font-bold tracking-tight block mt-0.5 ${
                          availableLimit < 0 ? 'text-[#E03E3E]' : 'text-[#37352F]'
                        }`}
                      >
                        {formatINR(availableLimit)}
                      </span>
                      <span className="text-[11px] text-[#787774]">
                        of {formatINR(card.limit)} limit
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-medium text-[#787774] block uppercase tracking-wider">
                        {isCreditBalance ? 'Credit Balance' : 'Outstanding'}
                      </span>
                      <span
                        className={`text-lg font-bold tracking-tight block mt-0.5 ${
                          isCreditBalance ? 'text-[#0F7B6C]' : 'text-[#37352F]'
                        }`}
                      >
                        {isCreditBalance
                          ? `+${formatINR(Math.abs(outstanding))}`
                          : formatINR(outstanding)}
                      </span>
                      <span className="text-[11px] text-[#787774]">
                        {isCreditBalance ? 'Overpaid / refunded' : 'Current unbilled & billed'}
                      </span>
                    </div>
                  </div>

                  {/* Utilization Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[#787774]">Credit Utilization</span>
                      <span
                        className="font-medium px-2 py-0.5 rounded text-[11px]"
                        style={{ color: statusColor, backgroundColor: statusBg }}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-[#E9E9E7] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(0, utilization * 100))}%`,
                          backgroundColor: statusColor,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Billing Cycle & Due Date Information */}
                <div className="mt-5 pt-3 border-t border-[#E9E9E7] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-1.5 text-[#787774]">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Next Statement</span>
                    </div>
                    <span className="font-medium text-[#37352F] block mt-0.5">
                      {formatDisplayDate(cycle.end, 'dd MMM yyyy')}
                    </span>
                    <span className="text-[11px] text-[#787774]">
                      {daysLeft === 0 ? 'Closes today' : `${daysLeft} days left in cycle`}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 text-[#787774]">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Next Due Date</span>
                    </div>
                    <span className="font-medium text-[#37352F] block mt-0.5">
                      {formatDisplayDate(cycle.dueDate, 'dd MMM yyyy')}
                    </span>
                    <span
                      className={`text-[11px] font-medium ${
                        dueDays < 0
                          ? 'text-[#E03E3E]'
                          : dueDays <= 3
                          ? 'text-[#D9730D]'
                          : 'text-[#787774]'
                      }`}
                    >
                      {dueDays < 0
                        ? `${Math.abs(dueDays)} days overdue`
                        : dueDays === 0
                        ? 'Due today'
                        : `Pay in ${dueDays} days`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Card Form Modal */}
      <CardFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveCard}
        cardToEdit={editingCard}
      />

      {/* Delete Card Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirmCard}
        onClose={() => setDeleteConfirmCard(null)}
        onConfirm={handleDeleteCard}
        title="Delete Credit Card"
        message={`Are you sure you want to delete "${deleteConfirmCard?.nickname}"? This will permanently delete the card and all its logged transactions.`}
        confirmLabel="Delete Card & Data"
        cancelLabel="Keep Card"
        isDestructive={true}
      />
    </div>
  );
};
