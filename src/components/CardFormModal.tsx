import React, { useState, useEffect } from 'react';
import type { Card } from '../types';
import { Modal } from './Modal';
import { parseINRInput, paiseToInputString, validateAmount } from '../lib/format';

interface CardFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cardData: Omit<Card, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  cardToEdit?: Card | null;
}

const COLOR_OPTIONS = [
  { name: 'Classic Slate', hex: '#37352F' },
  { name: 'Emerald Green', hex: '#0F7B6C' },
  { name: 'Deep Indigo', hex: '#4A5568' },
  { name: 'Warm Amber', hex: '#D9730D' },
  { name: 'Wine Red', hex: '#9B2C2C' },
  { name: 'Cobalt Blue', hex: '#2B6CB0' },
  { name: 'Royal Purple', hex: '#6B46C1' },
];

export const CardFormModal: React.FC<CardFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  cardToEdit,
}) => {
  const [nickname, setNickname] = useState('');
  const [last4, setLast4] = useState('');
  const [limitRupees, setLimitRupees] = useState('');
  const [statementDay, setStatementDay] = useState('15');
  const [dueDay, setDueDay] = useState('5');
  const [color, setColor] = useState(COLOR_OPTIONS[0].hex);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (cardToEdit) {
      setNickname(cardToEdit.nickname);
      setLast4(cardToEdit.last4);
      setLimitRupees(paiseToInputString(cardToEdit.limit));
      setStatementDay(String(cardToEdit.statementDay));
      setDueDay(String(cardToEdit.dueDay));
      setColor(cardToEdit.color || COLOR_OPTIONS[0].hex);
    } else {
      setNickname('');
      setLast4('');
      setLimitRupees('');
      setStatementDay('15');
      setDueDay('5');
      setColor(COLOR_OPTIONS[0].hex);
    }
    setErrors({});
  }, [cardToEdit, isOpen]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nickname.trim()) {
      newErrors.nickname = 'Card nickname is required (e.g. HDFC Regalia)';
    }

    if (!/^\d{4}$/.test(last4.trim())) {
      newErrors.last4 = 'Last 4 digits must be exactly 4 numbers';
    }

    const limitValidation = validateAmount(limitRupees);
    if (!limitValidation.valid) {
      newErrors.limit = limitValidation.error || 'Credit limit must be greater than ₹0';
    }

    const sDay = parseInt(statementDay, 10);
    if (isNaN(sDay) || sDay < 1 || sDay > 31) {
      newErrors.statementDay = 'Statement day must be between 1 and 31';
    }

    const dDay = parseInt(dueDay, 10);
    if (isNaN(dDay) || dDay < 1 || dDay > 31) {
      newErrors.dueDay = 'Due day must be between 1 and 31';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const limitPaise = parseINRInput(limitRupees);
      await onSave({
        id: cardToEdit?.id,
        nickname: nickname.trim(),
        last4: last4.trim(),
        limit: limitPaise,
        statementDay: parseInt(statementDay, 10),
        dueDay: parseInt(dueDay, 10),
        color,
      });
      onClose();
    } catch (err) {
      console.error('Error saving card:', err);
      setErrors({ form: 'Failed to save card. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={cardToEdit ? 'Edit Credit Card' : 'Add Credit Card'}
      description="Enter your card details. We only ask for the last 4 digits for privacy."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.form && (
          <div className="rounded border border-[#E03E3E] bg-[#FBE4E4] p-2.5 text-xs text-[#E03E3E]">
            {errors.form}
          </div>
        )}

        {/* Nickname */}
        <div>
          <label className="block text-xs font-medium text-[#37352F] mb-1">
            Card Nickname <span className="text-[#E03E3E]">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. HDFC Regalia Gold, ICICI Amazon Pay"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full rounded border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] placeholder-[#787774] focus:border-[#37352F] focus:outline-hidden transition-colors"
          />
          {errors.nickname && <p className="text-[11px] text-[#E03E3E] mt-1">{errors.nickname}</p>}
        </div>

        {/* Last 4 & Limit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#37352F] mb-1">
              Last 4 Digits <span className="text-[#E03E3E]">*</span>
            </label>
            <input
              type="text"
              maxLength={4}
              placeholder="4321"
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] placeholder-[#787774] focus:border-[#37352F] focus:outline-hidden transition-colors font-mono tracking-wider"
            />
            {errors.last4 && <p className="text-[11px] text-[#E03E3E] mt-1">{errors.last4}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#37352F] mb-1">
              Total Credit Limit (₹) <span className="text-[#E03E3E]">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-[#787774]">₹</span>
              <input
                type="text"
                placeholder="1,50,000"
                value={limitRupees}
                onChange={(e) => setLimitRupees(e.target.value)}
                className="w-full rounded border border-[#E9E9E7] bg-white pl-7 pr-3 py-2 text-sm text-[#37352F] placeholder-[#787774] focus:border-[#37352F] focus:outline-hidden transition-colors"
              />
            </div>
            {errors.limit && <p className="text-[11px] text-[#E03E3E] mt-1">{errors.limit}</p>}
          </div>
        </div>

        {/* Statement Day & Due Day */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#37352F] mb-1">
              Statement Cut-off Day <span className="text-[#E03E3E]">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={31}
              placeholder="15"
              value={statementDay}
              onChange={(e) => setStatementDay(e.target.value)}
              className="w-full rounded border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] placeholder-[#787774] focus:border-[#37352F] focus:outline-hidden transition-colors"
            />
            <p className="text-[11px] text-[#787774] mt-0.5">Day of month (1 to 31)</p>
            {errors.statementDay && (
              <p className="text-[11px] text-[#E03E3E] mt-0.5">{errors.statementDay}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#37352F] mb-1">
              Payment Due Day <span className="text-[#E03E3E]">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={31}
              placeholder="5"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              className="w-full rounded border border-[#E9E9E7] bg-white px-3 py-2 text-sm text-[#37352F] placeholder-[#787774] focus:border-[#37352F] focus:outline-hidden transition-colors"
            />
            <p className="text-[11px] text-[#787774] mt-0.5">Day of month (1 to 31)</p>
            {errors.dueDay && <p className="text-[11px] text-[#E03E3E] mt-0.5">{errors.dueDay}</p>}
          </div>
        </div>

        {/* Card Theme Color */}
        <div>
          <label className="block text-xs font-medium text-[#37352F] mb-1.5">Card Color Accent</label>
          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setColor(c.hex)}
                className={`h-6 w-6 rounded-full border transition-transform ${
                  color === c.hex
                    ? 'ring-2 ring-[#37352F] ring-offset-2 scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* Buttons */}
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
            className="rounded bg-[#37352F] px-4 py-2 text-xs font-medium text-white hover:bg-[#201F1D] active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {submitting ? 'Saving...' : cardToEdit ? 'Save Changes' : 'Create Card'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
