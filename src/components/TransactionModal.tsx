import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Transaction, TransactionType } from '../types';
import { Modal } from './Modal';
import { parseINRInput, paiseToInputString } from '../lib/format';
import { todayISO } from '../lib/dates';
import { ArrowDownLeft, ArrowUpRight, RotateCcw } from 'lucide-react';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionToEdit?: Transaction | null;
  onSave?: () => void;
  defaultRecurring?: boolean;
}

const LAST_USED_CARD_KEY = 'card_tracker_last_card_id';

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  transactionToEdit,
  onSave,
  defaultRecurring = false,
}) => {
  const cards = useLiveQuery(() => db.cards.orderBy('createdAt').reverse().toArray());
  const categories = useLiveQuery(() => db.categories.toArray());

  const [type, setType] = useState<TransactionType>('expense');
  const [amountRupees, setAmountRupees] = useState('');
  const [cardId, setCardId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'monthly' | 'yearly'>('monthly');
  const [isReimbursable, setIsReimbursable] = useState(false);
  const [reimbursableFrom, setReimbursableFrom] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (transactionToEdit) {
        setType(transactionToEdit.type);
        setAmountRupees(paiseToInputString(transactionToEdit.amount));
        setCardId(transactionToEdit.cardId);
        setCategoryId(transactionToEdit.categoryId || '');
        setDate(transactionToEdit.date);
        setNote(transactionToEdit.note || '');
        setIsRecurring(transactionToEdit.isRecurring);
        setRecurringFrequency(transactionToEdit.recurringFrequency || 'monthly');
        setIsReimbursable(transactionToEdit.isReimbursable);
        setReimbursableFrom(transactionToEdit.reimbursableFrom || '');
      } else {
        // Quick Add defaults
        setType('expense');
        setAmountRupees('');
        setDate(todayISO());
        setNote('');
        setIsRecurring(defaultRecurring);
        setRecurringFrequency('monthly');
        setIsReimbursable(false);
        setReimbursableFrom('');

        // Remember last used card
        const lastCard = localStorage.getItem(LAST_USED_CARD_KEY);
        if (lastCard && cards?.some((c) => c.id === lastCard)) {
          setCardId(lastCard);
        } else if (cards && cards.length > 0) {
          setCardId(cards[0].id);
        }

        // Default category
        if (categories && categories.length > 0) {
          setCategoryId(categories[0].id);
        }
      }
      setErrors({});

      // Focus the amount input immediately for ultra-fast logging (< 5s)
      setTimeout(() => {
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      }, 50);
    }
  }, [isOpen, transactionToEdit, cards, categories]);

  // If card list loads and no card is selected, select first
  useEffect(() => {
    if (!cardId && cards && cards.length > 0) {
      const lastCard = localStorage.getItem(LAST_USED_CARD_KEY);
      if (lastCard && cards.some((c) => c.id === lastCard)) {
        setCardId(lastCard);
      } else {
        setCardId(cards[0].id);
      }
    }
  }, [cards, cardId]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const amountPaise = parseINRInput(amountRupees);
    if (amountPaise <= 0) {
      newErrors.amount = 'Amount must be greater than ₹0';
    }

    if (!cardId) {
      newErrors.cardId = 'Please select a credit card';
    }

    if (type !== 'payment' && !categoryId) {
      newErrors.categoryId = 'Please select a category';
    }

    if (!date) {
      newErrors.date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const amountPaise = parseINRInput(amountRupees);

      // Save last used card for Quick Add convenience
      localStorage.setItem(LAST_USED_CARD_KEY, cardId);

      const txnData: Omit<Transaction, 'id' | 'createdAt'> = {
        cardId,
        type,
        amount: amountPaise,
        categoryId: type === 'payment' ? undefined : categoryId,
        date,
        note: note.trim() || undefined,
        isRecurring,
        recurringFrequency: isRecurring ? recurringFrequency : undefined,
        isReimbursable,
        reimbursableFrom: isReimbursable ? reimbursableFrom.trim() || undefined : undefined,
        isReimbursed: transactionToEdit ? transactionToEdit.isReimbursed : false,
      };

      if (transactionToEdit) {
        await db.transactions.update(transactionToEdit.id, txnData);
      } else {
        const newTxn: Transaction = {
          ...txnData,
          id: `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          createdAt: Date.now(),
        };
        await db.transactions.add(newTxn);
      }

      onSave?.();
      onClose();
    } catch (err) {
      console.error('Failed to save transaction:', err);
      setErrors({ form: 'Failed to record transaction. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const hasNoCards = !cards || cards.length === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={transactionToEdit ? 'Edit Transaction' : 'Quick Add Transaction'}
      description="Quickly record your spending, bill payment, or refund."
      maxWidth="md"
    >
      {hasNoCards ? (
        <div className="py-6 text-center space-y-3">
          <p className="text-sm text-[#787774]">
            You need to add a credit card before logging transactions.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-[#37352F] px-4 py-2 text-xs font-medium text-white hover:bg-[#201F1D]"
          >
            Close & Go to Cards
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.form && (
            <div className="rounded border border-[#E03E3E] bg-[#FBE4E4] p-2 text-xs text-[#E03E3E]">
              {errors.form}
            </div>
          )}

          {/* Transaction Type Segmented Control */}
          <div>
            <label className="block text-xs font-medium text-[#787774] mb-1.5 uppercase tracking-wider">
              Type
            </label>
            <div className="grid grid-cols-3 gap-1 rounded bg-[#F1F1EF] p-1 border border-[#E9E9E7]">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
                  type === 'expense'
                    ? 'bg-white text-[#37352F] shadow-xs'
                    : 'text-[#787774] hover:text-[#37352F]'
                }`}
              >
                <ArrowDownLeft className="h-3.5 w-3.5 text-[#E03E3E]" />
                <span>Expense</span>
              </button>

              <button
                type="button"
                onClick={() => setType('payment')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
                  type === 'payment'
                    ? 'bg-white text-[#37352F] shadow-xs'
                    : 'text-[#787774] hover:text-[#37352F]'
                }`}
              >
                <ArrowUpRight className="h-3.5 w-3.5 text-[#0F7B6C]" />
                <span>Bill Payment</span>
              </button>

              <button
                type="button"
                onClick={() => setType('refund')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
                  type === 'refund'
                    ? 'bg-white text-[#37352F] shadow-xs'
                    : 'text-[#787774] hover:text-[#37352F]'
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#0B6E99]" />
                <span>Refund</span>
              </button>
            </div>
          </div>

          {/* Amount Field (Focused First) */}
          <div>
            <label className="block text-xs font-medium text-[#37352F] mb-1">
              Amount (₹) <span className="text-[#E03E3E]">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-base font-medium text-[#787774]">₹</span>
              <input
                ref={amountInputRef}
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                className="w-full rounded border border-[#E9E9E7] bg-white pl-8 pr-3 py-2 text-lg font-semibold text-[#37352F] placeholder-[#787774] focus:border-[#37352F] focus:outline-hidden transition-colors"
              />
            </div>
            {errors.amount && <p className="text-[11px] text-[#E03E3E] mt-1">{errors.amount}</p>}
          </div>

          {/* Card & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card selector */}
            <div>
              <label className="block text-xs font-medium text-[#37352F] mb-1">
                Credit Card <span className="text-[#E03E3E]">*</span>
              </label>
              <select
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                className="w-full rounded border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] focus:border-[#37352F] focus:outline-hidden transition-colors"
              >
                {cards?.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.nickname} (•••• {card.last4})
                  </option>
                ))}
              </select>
              {errors.cardId && <p className="text-[11px] text-[#E03E3E] mt-1">{errors.cardId}</p>}
            </div>

            {/* Category selector (only for expense & refund) */}
            {type !== 'payment' ? (
              <div>
                <label className="block text-xs font-medium text-[#37352F] mb-1">
                  Category <span className="text-[#E03E3E]">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] focus:border-[#37352F] focus:outline-hidden transition-colors"
                >
                  <option value="" disabled>
                    Select category
                  </option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {errors.categoryId && (
                  <p className="text-[11px] text-[#E03E3E] mt-1">{errors.categoryId}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center pt-6 text-xs text-[#787774]">
                Bill payments reduce card outstanding balance directly.
              </div>
            )}
          </div>

          {/* Date & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#37352F] mb-1">
                Date <span className="text-[#E03E3E]">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] focus:border-[#37352F] focus:outline-hidden transition-colors"
              />
              {errors.date && <p className="text-[11px] text-[#E03E3E] mt-1">{errors.date}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#37352F] mb-1">
                Note (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Swiggy lunch, Flight to Delhi"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] placeholder-[#787774] focus:border-[#37352F] focus:outline-hidden transition-colors"
              />
            </div>
          </div>

          {/* Reimbursable Section */}
          <div className="pt-2 border-t border-[#E9E9E7]">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#37352F]">
              <input
                type="checkbox"
                checked={isReimbursable}
                onChange={(e) => setIsReimbursable(e.target.checked)}
                className="rounded border-[#E9E9E7] text-[#37352F] focus:ring-0"
              />
              <span>This is reimbursable (e.g. office expense or friend)</span>
            </label>

            {isReimbursable && (
              <div className="mt-2 pl-5">
                <input
                  type="text"
                  placeholder="Who will reimburse? (e.g. Company, Rahul)"
                  value={reimbursableFrom}
                  onChange={(e) => setReimbursableFrom(e.target.value)}
                  className="w-full rounded border border-[#E9E9E7] bg-white px-3 py-1.5 text-xs text-[#37352F] placeholder-[#787774] focus:border-[#37352F] focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Recurring / Subscription Section */}
          <div className="pt-2 border-t border-[#E9E9E7]">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#37352F]">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded border-[#E9E9E7] text-[#37352F] focus:ring-0"
                />
                <span>Recurring subscription</span>
              </label>

              {isRecurring && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[#787774]">Frequency:</span>
                  <select
                    value={recurringFrequency}
                    onChange={(e) => setRecurringFrequency(e.target.value as 'monthly' | 'yearly')}
                    className="rounded border border-[#E9E9E7] bg-white px-2 py-1 text-xs text-[#37352F] focus:outline-hidden"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E9E9E7]">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-[#E9E9E7] bg-white px-3.5 py-2 text-xs font-medium text-[#37352F] hover:bg-[#F1F1EF] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-[#37352F] px-4 py-2 text-xs font-medium text-white hover:bg-[#201F1D] active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
            >
              {submitting ? 'Saving...' : transactionToEdit ? 'Save Changes' : 'Record Transaction'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
