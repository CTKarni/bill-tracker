import React from 'react';
import { LayoutDashboard } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#37352F]">Dashboard</h1>
          <p className="text-sm text-[#787774] mt-1">Overview of your credit cards, available limits, and upcoming payments</p>
        </div>
      </div>

      <div className="rounded border border-[#E9E9E7] bg-white p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F6F3] text-[#787774] mb-3">
          <LayoutDashboard className="h-6 w-6" />
        </div>
        <h3 className="text-base font-medium text-[#37352F]">Welcome to Credit Card Expense Tracker</h3>
        <p className="text-sm text-[#787774] max-w-md mx-auto mt-1">
          Your card limits, billing cycles, and spending analytics will appear here once cards and transactions are added.
        </p>
      </div>
    </div>
  );
};
