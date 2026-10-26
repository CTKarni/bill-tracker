import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import {
  Menu,
  Plus,
  LayoutDashboard,
  CreditCard,
  ArrowLeftRight,
  PieChart,
  MoreHorizontal,
} from 'lucide-react';

export const Layout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global keyboard shortcut 'N' for Quick Add (unless typing in input/textarea)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'n' || e.key === 'N') &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        // Trigger quick add action or navigate to transaction creation
        window.dispatchEvent(new CustomEvent('open-quick-add'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleQuickAdd = () => {
    window.dispatchEvent(new CustomEvent('open-quick-add'));
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#37352F] flex flex-col">
      {/* Sidebar (Desktop & Mobile Drawer) */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onQuickAdd={handleQuickAdd}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-200 ease-in-out pb-20 md:pb-8 ${
          collapsed ? 'md:ml-16' : 'md:ml-64'
        }`}
      >
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#E9E9E7] bg-[#FBFBFA]/90 backdrop-blur-xs px-4 md:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-[#EFEFEF] text-[#37352F]"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-semibold text-sm tracking-tight text-[#37352F]">Card Tracker</span>
          </div>

          <button
            onClick={handleQuickAdd}
            className="flex h-8 items-center gap-1.5 rounded bg-[#37352F] text-white text-xs font-medium px-2.5 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add</span>
          </button>
        </header>

        {/* Page Container */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Floating Action Button (Quick Add) */}
      <button
        onClick={handleQuickAdd}
        aria-label="Quick Add (N)"
        className="fixed bottom-20 right-5 z-40 md:hidden flex h-12 w-12 items-center justify-center rounded-full bg-[#37352F] text-white shadow-md active:scale-90 transition-transform"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-[#E9E9E7] bg-[#FBFBFA] px-2 md:hidden">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
              isActive ? 'text-[#37352F]' : 'text-[#787774]'
            }`
          }
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/cards"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
              isActive ? 'text-[#37352F]' : 'text-[#787774]'
            }`
          }
        >
          <CreditCard className="h-5 w-5" />
          <span>Cards</span>
        </NavLink>

        <NavLink
          to="/transactions"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
              isActive ? 'text-[#37352F]' : 'text-[#787774]'
            }`
          }
        >
          <ArrowLeftRight className="h-5 w-5" />
          <span>Entries</span>
        </NavLink>

        <NavLink
          to="/charts"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
              isActive ? 'text-[#37352F]' : 'text-[#787774]'
            }`
          }
        >
          <PieChart className="h-5 w-5" />
          <span>Analytics</span>
        </NavLink>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center gap-1 text-[10px] font-medium text-[#787774]"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
};
