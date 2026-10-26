import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_SETTINGS, DEFAULT_CATEGORIES } from '../db';
import type { Category } from '../types';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { downloadCalendarICS } from '../lib/calendar';
import { todayISO, formatDisplayDate, daysBetween } from '../lib/dates';
import { validateBackupJSON, MAX_BACKUP_FILE_SIZE } from '../lib/backup';
import {
  Sliders,
  Calendar,
  Tag,
  Download,
  Upload,
  Trash2,
  Plus,
  Pencil,
  Check,
  AlertTriangle,
  FolderSync,
} from 'lucide-react';

const CATEGORY_COLORS = [
  '#E03E3E', // red
  '#0F7B6C', // teal/green
  '#6940A5', // purple
  '#0B6E99', // blue
  '#D9730D', // amber
  '#4D6461', // sage
  '#AD1A72', // magenta
  '#5C3882', // violet
  '#DF5452', // coral
  '#337EA9', // cyan
  '#787774', // slate
  '#2B6CB0', // cobalt
  '#C05621', // rust
];

export const SettingsPage: React.FC = () => {
  const settings = useLiveQuery(() => db.settings.get('main'));
  const categories = useLiveQuery(() => db.categories.toArray());
  const cards = useLiveQuery(() => db.cards.toArray());

  // Form states for Settings
  const [reminderDays, setReminderDays] = useState('3');
  const [alertPercent, setAlertPercent] = useState('80');
  const [savedSettingsNotice, setSavedSettingsNotice] = useState(false);

  // Category modal states
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [categoryError, setCategoryError] = useState('');

  // Delete category with reassign modal state
  const [deleteCatModalOpen, setDeleteCatModalOpen] = useState(false);
  const [catToDelete, setCatToDelete] = useState<Category | null>(null);
  const [reassignTargetCatId, setReassignTargetCatId] = useState('');

  // Delete all data confirm dialog
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);

  // Backup & Restore status message
  const [backupNotice, setBackupNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setReminderDays(String(settings.reminderDaysBeforeDue));
      setAlertPercent(String(settings.budgetAlertPercent));
    }
  }, [settings]);

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = parseInt(reminderDays, 10);
    const percent = parseInt(alertPercent, 10);

    if (isNaN(days) || days < 1 || days > 30) {
      alert('Reminder days must be between 1 and 30');
      return;
    }
    if (isNaN(percent) || percent < 10 || percent > 100) {
      alert('Budget alert percentage must be between 10% and 100%');
      return;
    }

    await db.settings.put({
      id: 'main',
      reminderDaysBeforeDue: days,
      budgetAlertPercent: percent,
    });

    setSavedSettingsNotice(true);
    setTimeout(() => setSavedSettingsNotice(false), 2000);
  };

  // Add / Edit Category
  const handleOpenCategoryModal = (cat?: Category) => {
    if (cat) {
      setEditingCategory(cat);
      setCategoryName(cat.name);
      setCategoryColor(cat.color);
    } else {
      setEditingCategory(null);
      setCategoryName('');
      setCategoryColor(CATEGORY_COLORS[0]);
    }
    setCategoryError('');
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      setCategoryError('Category name is required');
      return;
    }

    if (editingCategory) {
      await db.categories.update(editingCategory.id, {
        name: categoryName.trim(),
        color: categoryColor,
      });
    } else {
      const newCat: Category = {
        id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: categoryName.trim(),
        color: categoryColor,
        isDefault: false,
      };
      await db.categories.add(newCat);
    }

    setCategoryModalOpen(false);
  };

  // Delete Category with Reassign
  const handleOpenDeleteCategory = (cat: Category) => {
    setCatToDelete(cat);
    // Find first available target category other than this one
    const other = categories?.find((c) => c.id !== cat.id);
    setReassignTargetCatId(other ? other.id : '');
    setDeleteCatModalOpen(true);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!catToDelete) return;

    await db.transaction('rw', db.categories, db.transactions, async () => {
      if (reassignTargetCatId) {
        // Reassign existing transactions to selected category
        const affectedTxns = await db.transactions.where('categoryId').equals(catToDelete.id).toArray();
        for (const t of affectedTxns) {
          await db.transactions.update(t.id, { categoryId: reassignTargetCatId });
        }
      }
      await db.categories.delete(catToDelete.id);
    });

    setDeleteCatModalOpen(false);
    setCatToDelete(null);
  };

  // Calendar .ics Export
  const handleExportCalendar = () => {
    if (!cards || cards.length === 0) {
      alert('Add credit cards before exporting calendar due date reminders.');
      return;
    }
    const days = settings?.reminderDaysBeforeDue ?? 3;
    downloadCalendarICS(cards, days);
  };

  // Full Data Backup (JSON Export)
  const handleExportBackupJSON = async () => {
    try {
      const allCards = await db.cards.toArray();
      const allCategories = await db.categories.toArray();
      const allTransactions = await db.transactions.toArray();
      const currentSettings = await db.settings.get('main');

      const today = todayISO();
      await db.settings.update('main', { lastBackupDate: today });

      const backupData = {
        app: 'CreditCardExpenseTracker',
        version: 1,
        exportedAt: new Date().toISOString(),
        cards: allCards,
        categories: allCategories,
        transactions: allTransactions,
        settings: {
          ...(currentSettings || DEFAULT_SETTINGS),
          lastBackupDate: today,
        },
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `credit_card_tracker_backup_${today}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setBackupNotice({ type: 'success', msg: 'Backup JSON exported successfully!' });
      setTimeout(() => setBackupNotice(null), 3000);
    } catch (err) {
      console.error('Backup export failed:', err);
      setBackupNotice({ type: 'error', msg: 'Failed to create backup export.' });
    }
  };

  // Full Data Restore (JSON Import) with strict schema validation & size limit
  const handleImportBackupJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BACKUP_FILE_SIZE) {
      setBackupNotice({ type: 'error', msg: 'Backup file exceeds 20 MB size limit.' });
      e.target.value = '';
      return;
    }

    if (!file.name.toLowerCase().endsWith('.json')) {
      setBackupNotice({ type: 'error', msg: 'Invalid file type. Please upload a valid .json file.' });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const validation = validateBackupJSON(text);

        if (!validation.success || !validation.data) {
          throw new Error(validation.error || 'Invalid backup file structure.');
        }

        const data = validation.data;

        const confirmRestore = window.confirm(
          `This backup contains ${data.cards.length} cards, ${data.categories.length} categories, and ${data.transactions.length} transactions.\n\nRestoring will replace all current data. Proceed?`
        );
        if (!confirmRestore) return;

        // Atomically replace all data inside a Dexie transaction
        await db.transaction('rw', db.cards, db.categories, db.transactions, db.settings, async () => {
          await db.cards.clear();
          await db.categories.clear();
          await db.transactions.clear();
          await db.settings.clear();

          if (data.cards.length > 0) await db.cards.bulkAdd(data.cards);
          if (data.categories.length > 0) await db.categories.bulkAdd(data.categories);
          if (data.transactions.length > 0) await db.transactions.bulkAdd(data.transactions);
          if (data.settings) {
            await db.settings.put(data.settings);
          } else {
            await db.settings.put(DEFAULT_SETTINGS);
          }
        });

        setBackupNotice({ type: 'success', msg: 'Data restored successfully from backup!' });
        setTimeout(() => setBackupNotice(null), 3000);
      } catch (err) {
        console.error('Restore error:', err);
        setBackupNotice({
          type: 'error',
          msg: err instanceof Error ? err.message : 'Failed to restore backup.',
        });
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Delete All Data (Reset)
  const handleDeleteAllData = async () => {
    await db.transaction('rw', db.cards, db.categories, db.transactions, db.settings, async () => {
      await db.cards.clear();
      await db.transactions.clear();
      await db.categories.clear();
      await db.settings.clear();

      // Re-seed default categories and settings
      const categoriesWithId: Category[] = DEFAULT_CATEGORIES.map((cat, idx) => ({
        ...cat,
        id: `cat_default_${idx + 1}`,
      }));
      await db.categories.bulkPut(categoriesWithId);
      await db.settings.put(DEFAULT_SETTINGS);
    });

    setDeleteAllConfirmOpen(false);
    setBackupNotice({ type: 'success', msg: 'All user data has been cleared.' });
    setTimeout(() => setBackupNotice(null), 3000);
  };

  const lastBackup = settings?.lastBackupDate;
  const daysSinceBackup = lastBackup ? daysBetween(lastBackup, todayISO()) : null;
  const isBackupStale = daysSinceBackup === null || daysSinceBackup > 14;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#37352F]">Settings</h1>
        <p className="text-sm text-[#787774] mt-0.5">
          Notification preferences, category customization, calendar sync, and data backup
        </p>
      </div>

      {backupNotice && (
        <div
          className={`p-3 rounded text-xs font-medium flex items-center gap-2 border ${
            backupNotice.type === 'success'
              ? 'bg-[#EDF6F3] text-[#0F7B6C] border-[#0F7B6C]/20'
              : 'bg-[#FBE4E4] text-[#E03E3E] border-[#E03E3E]/20'
          }`}
        >
          {backupNotice.type === 'success' ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{backupNotice.msg}</span>
        </div>
      )}

      {/* 1. Threshold Preferences Form */}
      <div className="rounded border border-[#E9E9E7] bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#E9E9E7]">
          <Sliders className="h-4 w-4 text-[#37352F]" />
          <h2 className="text-sm font-semibold text-[#37352F]">Thresholds & Alerts</h2>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#37352F] mb-1">
                Due Date Reminder Threshold
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={reminderDays}
                  onChange={(e) => setReminderDays(e.target.value)}
                  className="rounded border border-[#E9E9E7] bg-white px-3 py-1.5 text-xs text-[#37352F] focus:outline-hidden w-24"
                />
                <span className="text-xs text-[#787774]">days before payment is due</span>
              </div>
              <p className="text-[11px] text-[#787774] mt-1">
                Dashboard displays an alert banner when payment is within this many days.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#37352F] mb-1">
                Budget Alert Threshold (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={alertPercent}
                  onChange={(e) => setAlertPercent(e.target.value)}
                  className="rounded border border-[#E9E9E7] bg-white px-3 py-1.5 text-xs text-[#37352F] focus:outline-hidden w-24"
                />
                <span className="text-xs text-[#787774]">% of monthly category budget</span>
              </div>
              <p className="text-[11px] text-[#787774] mt-1">
                Alert turns amber when spending reaches this percentage of budget (default 80%).
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            {savedSettingsNotice && (
              <span className="text-xs text-[#0F7B6C] font-medium flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                <span>Preferences saved</span>
              </span>
            )}
            <button
              type="submit"
              className="rounded bg-[#37352F] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#201F1D] active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              Save Preferences
            </button>
          </div>
        </form>
      </div>

      {/* 2. Calendar Sync (.ics file) */}
      <div className="rounded border border-[#E9E9E7] bg-white p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#E9E9E7]">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#37352F]" />
            <h2 className="text-sm font-semibold text-[#37352F]">Calendar Due Date Reminders</h2>
          </div>
        </div>

        <p className="text-xs text-[#787774]">
          Download an `.ics` file containing all upcoming credit card due dates with an alarm set to{' '}
          {settings?.reminderDaysBeforeDue ?? 3} days before due. Works with Apple Calendar, Google Calendar, Outlook, and phone calendars.
        </p>

        <button
          onClick={handleExportCalendar}
          className="inline-flex items-center gap-1.5 rounded border border-[#E9E9E7] bg-white px-3.5 py-2 text-xs font-medium text-[#37352F] hover:bg-[#F1F1EF] transition-colors cursor-pointer"
        >
          <Calendar className="h-3.5 w-3.5 text-[#0F7B6C]" />
          <span>Add Due Dates to Calendar (.ics)</span>
        </button>
      </div>

      {/* 3. Manage Categories */}
      <div className="rounded border border-[#E9E9E7] bg-white p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E9E9E7]">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-[#37352F]" />
            <h2 className="text-sm font-semibold text-[#37352F]">Categories ({categories?.length || 0})</h2>
          </div>

          <button
            onClick={() => handleOpenCategoryModal()}
            className="inline-flex items-center gap-1 rounded bg-[#37352F] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#201F1D] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Category</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {categories?.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between p-2.5 rounded border border-[#E9E9E7] bg-[#FBFBFA] hover:bg-white transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-xs font-medium text-[#37352F] truncate">{cat.name}</span>
                {cat.isDefault && (
                  <span className="text-[10px] text-[#787774] bg-[#EFEFEF] px-1 rounded">
                    Default
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleOpenCategoryModal(cat)}
                  title="Rename or recolor"
                  className="flex h-6 w-6 items-center justify-center rounded text-[#787774] hover:bg-[#EFEFEF] hover:text-[#37352F]"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                {/* Allow deleting any category with safe reassign */}
                <button
                  onClick={() => handleOpenDeleteCategory(cat)}
                  title="Delete category with reassign"
                  className="flex h-6 w-6 items-center justify-center rounded text-[#787774] hover:bg-[#FBE4E4] hover:text-[#E03E3E]"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Full Data Backup & Restore */}
      <div className="rounded border border-[#E9E9E7] bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#E9E9E7]">
          <FolderSync className="h-4 w-4 text-[#37352F]" />
          <h2 className="text-sm font-semibold text-[#37352F]">Data Backup & Restore</h2>
        </div>

        <p className="text-xs text-[#787774]">
          Since all data stays exclusively inside this browser, download regular JSON backups to prevent accidental data loss or to move your database to another device.
        </p>

        {isBackupStale && (
          <div className="flex items-start gap-2.5 rounded border border-[#D9730D]/30 bg-[#FBF3DB] p-3 text-xs text-[#37352F]">
            <AlertTriangle className="h-4 w-4 text-[#D9730D] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#D9730D]">Backup Reminder: </span>
              {daysSinceBackup === null
                ? 'You have never exported a backup yet. Export a JSON backup to protect your financial records against browser cache clears.'
                : `Your last backup was ${daysSinceBackup} days ago (${formatDisplayDate(lastBackup!)}). Download an updated backup to keep your data safe.`}
            </div>
          </div>
        )}

        <div className="text-xs text-[#787774]">
          Last backup:{' '}
          <span className="font-medium text-[#37352F]">
            {lastBackup ? formatDisplayDate(lastBackup) : 'Never'}
          </span>
          {daysSinceBackup !== null && ` (${daysSinceBackup} days ago)`}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleExportBackupJSON}
            className="inline-flex items-center gap-1.5 rounded border border-[#E9E9E7] bg-white px-3.5 py-2 text-xs font-medium text-[#37352F] hover:bg-[#F1F1EF] transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-[#0F7B6C]" />
            <span>Export Backup (JSON)</span>
          </button>

          <label className="inline-flex items-center gap-1.5 rounded border border-[#E9E9E7] bg-white px-3.5 py-2 text-xs font-medium text-[#37352F] hover:bg-[#F1F1EF] transition-colors cursor-pointer">
            <Upload className="h-3.5 w-3.5 text-[#2B6CB0]" />
            <span>Restore Backup (JSON)</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackupJSON}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 5. Danger Zone: Reset All Data */}
      <div className="rounded border border-[#E03E3E]/30 bg-[#FBE4E4]/30 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#E03E3E]">Danger Zone</h2>
        <p className="text-xs text-[#37352F]">
          Permanently delete all cards, transactions, and category budgets from this browser. This cannot be undone unless you have a backup.
        </p>

        <button
          onClick={() => setDeleteAllConfirmOpen(true)}
          className="inline-flex items-center gap-1.5 rounded bg-[#E03E3E] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#C93232] active:scale-95 transition-all shadow-xs cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete All Data</span>
        </button>
      </div>

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Add Custom Category'}
        description="Choose a name and distinct color for this spending category."
        maxWidth="sm"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#37352F] mb-1">
              Category Name <span className="text-[#E03E3E]">*</span>
            </label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Pet Care, Gadgets, Books"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full rounded border border-[#E9E9E7] bg-white px-3 py-2 text-xs text-[#37352F] focus:border-[#37352F] focus:outline-hidden"
            />
            {categoryError && <p className="text-[11px] text-[#E03E3E] mt-1">{categoryError}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#37352F] mb-1.5">Color Accent</label>
            <div className="flex items-center gap-2 flex-wrap">
              {CATEGORY_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setCategoryColor(hex)}
                  className={`h-6 w-6 rounded-full border transition-transform ${
                    categoryColor === hex
                      ? 'ring-2 ring-[#37352F] ring-offset-2 scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E9E9E7]">
            <button
              type="button"
              onClick={() => setCategoryModalOpen(false)}
              className="rounded border border-[#E9E9E7] bg-white px-3 py-1.5 text-xs font-medium text-[#37352F] hover:bg-[#F1F1EF]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-[#37352F] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#201F1D]"
            >
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Category with Reassign Modal */}
      <Modal
        isOpen={deleteCatModalOpen}
        onClose={() => setDeleteCatModalOpen(false)}
        title={`Delete Category "${catToDelete?.name}"`}
        description="To keep your transaction history intact, choose a category to reassign existing entries to."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#37352F] mb-1">
              Reassign existing transactions to:
            </label>
            <select
              value={reassignTargetCatId}
              onChange={(e) => setReassignTargetCatId(e.target.value)}
              className="w-full rounded border border-[#E9E9E7] bg-white px-3 py-2 text-xs text-[#37352F]"
            >
              {categories
                ?.filter((c) => c.id !== catToDelete?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E9E9E7]">
            <button
              type="button"
              onClick={() => setDeleteCatModalOpen(false)}
              className="rounded border border-[#E9E9E7] bg-white px-3 py-1.5 text-xs font-medium text-[#37352F] hover:bg-[#F1F1EF]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteCategory}
              className="rounded bg-[#E03E3E] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#C93232]"
            >
              Reassign & Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete All Data Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteAllConfirmOpen}
        onClose={() => setDeleteAllConfirmOpen(false)}
        onConfirm={handleDeleteAllData}
        title="⚠️ Delete All Data?"
        message="Are you completely sure you want to delete all credit cards, transactions, and custom settings? This action cannot be reversed."
        confirmLabel="Yes, Delete Everything"
        cancelLabel="Cancel"
        isDestructive={true}
      />
    </div>
  );
};
