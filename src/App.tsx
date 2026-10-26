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

export const App: React.FC = () => {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
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
        </div>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBFBFA]">
        <div className="flex items-center gap-2 text-sm text-[#787774]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#37352F] border-t-transparent" />
          <span>Loading local database...</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="cards" element={<CardsPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="charts" element={<ChartsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
