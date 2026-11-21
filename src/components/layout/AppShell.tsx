import React, { useState } from 'react';
import {
  BarChart3,
  Compass,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { NavViewId } from '../../types/finance';
import { useElevate } from '../../context/ElevateContext';
import { Button } from '../ui/Button';
import { ModalSheet } from '../ui/ModalSheet';

interface AppShellProps {
  activeView: NavViewId;
  onSelectView: (view: NavViewId) => void;
  children: React.ReactNode;
}

const ALL_NAV_ITEMS: Array<{
  id: NavViewId;
  label: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'flow', label: 'Flow', subtitle: 'Cash & Budgets', icon: Wallet },
  { id: 'guide', label: 'Guide', subtitle: 'Coach & Goals', icon: Compass },
  { id: 'wealth', label: 'Wealth', subtitle: 'Investments', icon: TrendingUp },
  { id: 'secure', label: 'Secure', subtitle: 'Insurance', icon: ShieldCheck },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'plans', label: 'Plans', subtitle: 'Basic & Pro', icon: CreditCard },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const MOBILE_PRIMARY_TABS: Array<{
  id: NavViewId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'flow', label: 'Flow', icon: Wallet },
  { id: 'guide', label: 'Guide', icon: Compass },
  { id: 'wealth', label: 'Wealth', icon: TrendingUp },
];

export function AppShell({
  activeView,
  onSelectView,
  children,
}: AppShellProps) {
  const { user, signOut, entitlement } = useElevate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeMeta =
    ALL_NAV_ITEMS.find((n) => n.id === activeView) ?? ALL_NAV_ITEMS[0];
  const isOverflowActive =
    activeView === 'secure' ||
    activeView === 'reports' ||
    activeView === 'plans' ||
    activeView === 'settings';

  const handleQuickAction = () => {
    onSelectView('flow');
  };

  return (
    <div className="min-h-screen bg-[#F7F9FA] text-[#142A3B] flex">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-[#142A3B]/10 z-30">
        {/* Sidebar Brand */}
        <div className="h-16 px-6 flex items-center border-b border-[#142A3B]/10 shrink-0">
          <button
            type="button"
            onClick={() => onSelectView('dashboard')}
            className="font-display text-xl font-bold tracking-tight text-[#142A3B] whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78] rounded-md"
          >
            Elevate
          </button>
        </div>

        {/* Sidebar Navigation Links */}
        <nav
          aria-label="Primary workspace navigation"
          className="flex-1 px-3 py-5 space-y-1 overflow-y-auto"
        >
          {ALL_NAV_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            const showDividerBefore = idx === 1 || idx === 5;
            return (
              <React.Fragment key={item.id}>
                {showDividerBefore && (
                  <div className="my-3 mx-3 border-t border-[#142A3B]/8" />
                )}
                <button
                  type="button"
                  onClick={() => onSelectView(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78] ${
                    active
                      ? 'bg-[#142A3B] text-white'
                      : 'text-[#425466] hover:text-[#142A3B] hover:bg-[#F7F9FA]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-[#D5A64A]' : 'text-[#627384]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                  {item.subtitle && (
                    <span
                      className={`ml-auto text-[11px] truncate ${
                        active ? 'text-white/70' : 'text-[#627384]'
                      }`}
                    >
                      {item.subtitle}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Signed-in Profile, Plan Summary & Sign Out */}
        <div className="p-4 border-t border-[#142A3B]/10 space-y-2.5">
          <button
            type="button"
            onClick={() => onSelectView('plans')}
            className="w-full text-left px-2.5 py-2 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10 hover:border-[#1E8A78]/40 transition-colors cursor-pointer"
          >
            <p className="text-[11px] font-semibold text-[#1E8A78]">
              {entitlement?.status === 'ended'
                ? 'Subscription Ended'
                : entitlement?.plan === 'pro'
                  ? 'Elevate Pro · ₹199/mo'
                  : 'Elevate Basic · ₹99/mo'}
            </p>
            <p className="text-[11px] text-[#627384] truncate">
              {entitlement?.status === 'downgrade_scheduled'
                ? 'Downgrade scheduled · Manage'
                : entitlement?.status === 'canceled'
                  ? 'Canceled · Manage plan'
                  : 'Compare or manage plan'}
            </p>
          </button>

          <div className="px-2">
            <p className="text-xs font-semibold text-[#142A3B] truncate">
              {user?.name ?? 'Member'}
            </p>
            <p className="text-[11px] text-[#627384] truncate">
              {user?.email || 'Authenticated Account'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void signOut();
            }}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-medium text-[#425466] hover:text-[#B42318] hover:bg-[#B42318]/8 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78]"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        {/* Top Bar (Desktop breadcrumb + 1 action; Mobile compact 48px bar) */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#142A3B]/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 md:h-16 flex items-center justify-between gap-4">
            {/* Left Slot */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="md:hidden font-display text-base font-bold text-[#142A3B] whitespace-nowrap">
                Elevate
              </span>
              <span
                className="md:hidden text-[#142A3B]/30"
                aria-hidden="true"
              >
                /
              </span>
              <span className="hidden md:inline text-sm text-[#627384]">
                Elevate
              </span>
              <span
                className="hidden md:inline text-[#142A3B]/30"
                aria-hidden="true"
              >
                /
              </span>
              <span className="text-sm font-semibold text-[#142A3B] truncate">
                {activeMeta.label}
              </span>
            </div>

            {/* Right Slot */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden md:block">
                {activeView !== 'flow' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleQuickAction}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Open Flow Ledger</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectView('reports')}
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-[#1E8A78]" />
                    <span>View Reports</span>
                  </Button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open workspace menu"
                className="md:hidden min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-[#142A3B] hover:bg-[#F7F9FA] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78]"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Content Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation (60px + safe area) */}
      <nav
        aria-label="Mobile workspace navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#142A3B]/10 pb-safe"
      >
        <div className="grid grid-cols-5 h-[60px] items-center px-1">
          {MOBILE_PRIMARY_TABS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`min-h-[46px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78] ${
                  active ? 'text-[#1E8A78]' : 'text-[#425466]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span
                  className={`text-[11px] leading-none tracking-tight ${
                    active ? 'font-semibold text-[#142A3B]' : 'font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="More workspace views"
            className={`min-h-[46px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78] ${
              isOverflowActive ? 'text-[#1E8A78]' : 'text-[#425466]'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span
              className={`text-[11px] leading-none tracking-tight ${
                isOverflowActive ? 'font-semibold text-[#142A3B]' : 'font-medium'
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile Overflow Menu Sheet (Secure, Reports, Settings, Sign Out) */}
      <ModalSheet
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        title="Elevate Workspace"
        subtitle={user ? `Signed in as ${user.name}` : undefined}
      >
        <div className="space-y-2">
          {ALL_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectView(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full min-h-[48px] px-4 py-3 rounded-xl flex items-center justify-between text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#142A3B] text-white'
                    : 'bg-[#F7F9FA] text-[#142A3B] hover:bg-[#EEF2F5]'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      active ? 'text-[#D5A64A]' : 'text-[#1E8A78]'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {item.subtitle && (
                  <span
                    className={`text-xs ${
                      active ? 'text-white/75' : 'text-[#627384]'
                    }`}
                  >
                    {item.subtitle}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 mt-3 border-t border-[#142A3B]/10">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                signOut();
              }}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium text-[#B42318] bg-[#B42318]/8 hover:bg-[#B42318]/12 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </ModalSheet>
    </div>
  );
}
