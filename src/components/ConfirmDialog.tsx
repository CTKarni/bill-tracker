import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          {isDestructive && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FBE4E4] text-[#E03E3E]">
              <AlertTriangle className="h-4 w-4" />
            </div>
          )}
          <p className="text-sm text-[#37352F] leading-relaxed">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E9E9E7]">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[#E9E9E7] bg-white px-3 py-1.5 text-xs font-medium text-[#37352F] hover:bg-[#F1F1EF] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`rounded px-3 py-1.5 text-xs font-medium text-white transition-colors ${
              isDestructive
                ? 'bg-[#E03E3E] hover:bg-[#C93232]'
                : 'bg-[#37352F] hover:bg-[#201F1D]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
