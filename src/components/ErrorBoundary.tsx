import { Component, type ErrorInfo, type ReactNode } from 'react';
import { db } from '../db';
import { todayISO } from '../lib/dates';
import { AlertOctagon, RotateCw, Download } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  exporting: boolean;
  exportSuccess: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    exporting: false,
    exportSuccess: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, exporting: false, exportSuccess: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleEmergencyExport = async () => {
    this.setState({ exporting: true });
    try {
      const cards = await db.cards.toArray();
      const categories = await db.categories.toArray();
      const transactions = await db.transactions.toArray();
      const settings = await db.settings.get('main');

      const backup = {
        app: 'CreditCardExpenseTracker',
        version: 1,
        exportedAt: new Date().toISOString(),
        cards,
        categories,
        transactions,
        settings,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `emergency_backup_${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.setState({ exportSuccess: true });
    } catch (err) {
      console.error('Emergency export failed:', err);
      alert('Could not read from local database to generate backup.');
    } finally {
      this.setState({ exporting: false });
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FBFBFA] p-4 text-[#37352F]">
          <div className="max-w-md w-full rounded border border-[#E9E9E7] bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 text-[#E03E3E]">
              <AlertOctagon className="h-6 w-6 shrink-0" />
              <h2 className="text-base font-semibold">
                {this.props.fallbackTitle || 'Something went wrong'}
              </h2>
            </div>

            <p className="text-xs text-[#5F5E5B]">
              An unexpected application error occurred. Your financial data is safely stored in your browser's local IndexedDB.
            </p>

            {this.state.error && (
              <div className="p-2.5 rounded bg-[#F7F6F3] border border-[#E9E9E7] text-[11px] font-mono text-[#5F5E5B] overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-[#E9E9E7]">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-1.5 rounded bg-[#37352F] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#201F1D] cursor-pointer"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span>Reload Application</span>
              </button>

              <button
                onClick={this.handleEmergencyExport}
                disabled={this.state.exporting}
                className="inline-flex items-center gap-1.5 rounded border border-[#E9E9E7] bg-white px-3 py-1.5 text-xs font-medium text-[#37352F] hover:bg-[#F1F1EF] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-[#0F7B6C]" />
                <span>
                  {this.state.exportSuccess
                    ? 'Exported!'
                    : this.state.exporting
                    ? 'Exporting...'
                    : 'Export Emergency Backup'}
                </span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
