import React, { useRef, useState } from 'react';
import {
  Compass,
  Database,
  Download,
  LayoutGrid,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react';
import { PillarId } from '../../types/finance';
import { useElevate } from '../../context/ElevateContext';
import { Button } from '../ui/Button';
import { ModalSheet } from '../ui/ModalSheet';

interface AppShellProps {
  activePillar: PillarId;
  onSelectPillar: (pillar: PillarId) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  id: PillarId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'flow', label: 'Flow', icon: Wallet },
  { id: 'guide', label: 'Guide', icon: Compass },
  { id: 'wealth', label: 'Wealth', icon: TrendingUp },
  { id: 'secure', label: 'Secure', icon: ShieldCheck },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'INR'];

export function AppShell({
  activePillar,
  onSelectPillar,
  children,
}: AppShellProps) {
  const {
    workspace,
    setCurrency,
    loadSampleTemplate,
    clearWorkspace,
    importWorkspaceJSON,
  } = useElevate();

  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `elevate-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importWorkspaceJSON(String(reader.result ?? ''));
      if (result.ok) {
        setImportFeedback('Workspace imported successfully.');
      } else {
        setImportFeedback(result.error ?? 'Failed to import JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FA] text-[#142A3B]">
      {/* Top Navigation Bar (Strict 3-zone contract on desktop, compact 48px on mobile) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#142A3B]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 md:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand wordmark */}
          <button
            type="button"
            onClick={() => onSelectPillar('overview')}
            className="font-display text-lg md:text-xl font-bold tracking-tight text-[#142A3B] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78] rounded-md px-1 -ml-1"
          >
            Elevate
          </button>

          {/* Zone 2: 5 concise single-line text nav links (Desktop) */}
          <nav
            aria-label="Elevate pillars"
            className="hidden md:flex items-center gap-7"
          >
            {NAV_ITEMS.map((item) => {
              const active = activePillar === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectPillar(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78] rounded-sm ${
                    active
                      ? 'text-[#142A3B]'
                      : 'text-[#425466] hover:text-[#142A3B]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      className="absolute left-0 right-0 -bottom-[17px] h-[2px] bg-[#1E8A78]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImportFeedback(null);
                setConfirmClear(false);
                setDataModalOpen(true);
              }}
            >
              <Database className="w-3.5 h-3.5 text-[#1E8A78]" />
              <span>Manage Data</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-12">
        {workspace.isSampleTemplate && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#D5A64A]/15 border border-[#D5A64A]/40 text-xs sm:text-sm text-[#142A3B]">
            <p>
              <span className="font-semibold">Fictional sample template active.</span>{' '}
              Numbers shown are illustrative placeholders — replace them with your own entries or clear the workspace.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={clearWorkspace}
            >
              Clear Template
            </Button>
          </div>
        )}

        {children}
      </main>

      {/* Quiet Editorial Footer (Hidden behind bottom nav margin on mobile, clean on desktop) */}
      <footer className="hidden md:block border-t border-[#142A3B]/10 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-[#627384]">
          <p className="font-medium text-[#142A3B]">
            Elevate · Your entire financial life, elevated.
          </p>
          <p>
            Manual-entry workspace stored locally in your browser · No external bank feeds or fabricated quotes
          </p>
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar (60px height, 44px+ hitboxes, natural thumb zone) */}
      <nav
        aria-label="Mobile pillar navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#142A3B]/10 pb-safe"
      >
        <div className="grid grid-cols-5 h-[60px] items-center px-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePillar === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectPillar(item.id)}
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
        </div>
      </nav>

      {/* Workspace Data Management Sheet */}
      <ModalSheet
        open={dataModalOpen}
        onClose={() => setDataModalOpen(false)}
        title="Workspace & Data Controls"
        subtitle="All records remain in your browser. Export backups or load an illustrative template anytime."
      >
        <div className="space-y-6">
          {/* Currency Preference */}
          <div>
            <label
              htmlFor="elevate-currency-select"
              className="block text-xs font-semibold text-[#142A3B] mb-2"
            >
              Display Currency
            </label>
            <select
              id="elevate-currency-select"
              value={workspace.currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm text-[#142A3B] focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Backup & Restore */}
          <div className="pt-4 border-t border-[#142A3B]/10 space-y-3">
            <h3 className="text-xs font-semibold text-[#142A3B]">
              Backup & Portability
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="outline" onClick={handleExportJSON} className="w-full">
                <Download className="w-4 h-4" />
                <span>Export JSON</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="w-4 h-4" />
                <span>Import JSON</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleFileImport}
                className="sr-only"
              />
            </div>
            {importFeedback && (
              <p className="text-xs text-[#1E8A78] font-medium">{importFeedback}</p>
            )}
          </div>

          {/* Illustrative Template & Reset */}
          <div className="pt-4 border-t border-[#142A3B]/10 space-y-3">
            <h3 className="text-xs font-semibold text-[#142A3B]">
              Template & Reset
            </h3>
            <p className="text-xs text-[#425466] leading-relaxed">
              Load a clearly labeled fictional planning template to explore charts across all four pillars, or clear all records to start fresh.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  loadSampleTemplate();
                  setDataModalOpen(false);
                }}
              >
                Load Sample Template
              </Button>

              {!confirmClear ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmClear(true)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Data</span>
                </Button>
              ) : (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    clearWorkspace();
                    setConfirmClear(false);
                    setDataModalOpen(false);
                  }}
                >
                  Confirm Clear Everything
                </Button>
              )}
            </div>
          </div>
        </div>
      </ModalSheet>
    </div>
  );
}
