import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { CardsPage } from './pages/CardsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { ChartsPage } from './pages/ChartsPage';
import { SettingsPage } from './pages/SettingsPage';
import { initializeDatabase } from './db';

import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    // Request persistent storage so the browser does not arbitrarily clear IndexedDB
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {
        // Gracefully handle if denied or not supported
      });
    }

    initializeDatabase()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('Failed to initialize database:', err);
        setDbError(err instanceof Error ? err.message : 'Database error');
      });
  }, []);

  if (dbError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBFBFA] p-4">
        <div className="max-w-md w-full rounded border border-[#E03E3E] bg-[#FBE4E4] p-6 text-center">
          <h2 className="text-lg font-semibold text-[#E03E3E]">Storage Error</h2>
          <p className="text-sm text-[#37352F] mt-2">
            Could not initialize local browser storage: {dbError}
          </p>
          <p className="text-xs text-[#5F5E5B] mt-3">
            Please make sure third-party storage or IndexedDB is enabled in your browser settings.
          </p>
        </div>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBFBFA]">
        <div className="flex items-center gap-2 text-sm text-[#5F5E5B]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#37352F] border-t-transparent" />
          <span>Loading local database...</span>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<ErrorBoundary fallbackTitle="Error loading Dashboard"><DashboardPage /></ErrorBoundary>} />
            <Route path="cards" element={<ErrorBoundary fallbackTitle="Error loading Cards"><CardsPage /></ErrorBoundary>} />
            <Route path="transactions" element={<ErrorBoundary fallbackTitle="Error loading Transactions"><TransactionsPage /></ErrorBoundary>} />
            <Route path="budgets" element={<ErrorBoundary fallbackTitle="Error loading Budgets"><BudgetsPage /></ErrorBoundary>} />
            <Route path="subscriptions" element={<ErrorBoundary fallbackTitle="Error loading Subscriptions"><SubscriptionsPage /></ErrorBoundary>} />
            <Route path="charts" element={<ErrorBoundary fallbackTitle="Error loading Charts"><ChartsPage /></ErrorBoundary>} />
            <Route path="settings" element={<ErrorBoundary fallbackTitle="Error loading Settings"><SettingsPage /></ErrorBoundary>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
