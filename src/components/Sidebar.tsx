import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CreditCard,
  ArrowLeftRight,
  PiggyBank,
  CalendarClock,
  PieChart,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Plus,
  X,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onQuickAdd?: () => void;
}

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Cards', path: '/cards', icon: CreditCard },
  { name: 'Transactions', path: '/transactions', icon: ArrowLeftRight },
  { name: 'Budgets', path: '/budgets', icon: PiggyBank },
  { name: 'Subscriptions', path: '/subscriptions', icon: CalendarClock },
  { name: 'Charts', path: '/charts', icon: PieChart },
  { name: 'Settings', path: '/settings', icon: SettingsIcon },
];

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  onQuickAdd,
}) => {
  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Desktop & Mobile Drawer Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-[#E9E9E7] bg-[#F7F6F3] text-[#37352F] transition-all duration-200 ease-in-out md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'w-16' : 'w-64'}`}
      >
        {/* App Title / Header */}
        <div className="flex h-14 items-center justify-between px-3 border-b border-[#E9E9E7]">
          {!collapsed ? (
            <div className="flex items-center gap-2 overflow-hidden px-1">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#37352F] text-white font-semibold text-xs tracking-wider">
                CC
              </div>
              <div className="truncate">
                <span className="font-semibold text-sm tracking-tight text-[#37352F]">Card Tracker</span>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-7 w-7 items-center justify-center rounded bg-[#37352F] text-white font-semibold text-xs">
              CC
            </div>
          )}

          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded hover:bg-[#EFEFEF] text-[#787774] hover:text-[#37352F] transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="flex md:hidden h-7 w-7 items-center justify-center rounded hover:bg-[#EFEFEF] text-[#787774]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Add Button in Sidebar (desktop) */}
        <div className="p-2">
          <button
            onClick={onQuickAdd}
            className={`w-full flex items-center justify-center gap-2 rounded bg-[#37352F] text-white text-xs font-medium py-2 px-3 hover:bg-[#201F1D] active:scale-[0.98] transition-all cursor-pointer shadow-xs ${
              collapsed ? 'px-0' : ''
            }`}
            title="Quick Add Transaction (N)"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Quick Add</span>}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-0.5 px-2 py-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                title={collapsed ? item.name : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded px-2.5 py-1.5 text-sm transition-colors ${
                    collapsed ? 'justify-center px-0' : ''
                  } ${
                    isActive
                      ? 'bg-[#EFEFEF] font-semibold text-[#37352F]'
                      : 'text-[#5A5853] hover:bg-[#F1F1EF] hover:text-[#37352F]'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0 text-[#787774]" />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Privacy badge at sidebar bottom */}
        <div className="p-3 border-t border-[#E9E9E7]">
          {!collapsed ? (
            <div className="flex items-center gap-2 text-[11px] text-[#787774]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#0F7B6C] shrink-0" />
              <span className="truncate">Local-first • Browser only</span>
            </div>
          ) : (
            <div className="flex justify-center" title="Local-first • Browser only">
              <ShieldCheck className="h-3.5 w-3.5 text-[#0F7B6C]" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
