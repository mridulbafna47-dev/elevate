import React, { useRef, useState } from 'react';
import {
  Check,
  Download,
  LogOut,
  Trash2,
  Upload,
} from 'lucide-react';
import { useElevate } from '../../context/ElevateContext';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'INR'];

export function SettingsPillar() {
  const {
    user,
    updateProfile,
    signOut,
    workspace,
    setCurrency,
    updateGuideSettings,
    clearWorkspace,
    importWorkspaceJSON,
  } = useElevate();

  const [nameInput, setNameInput] = useState(user?.name ?? '');
  const [emailInput, setEmailInput] = useState(user?.email ?? '');
  const [profileSaved, setProfileSaved] = useState(false);

  const [baselineInput, setBaselineInput] = useState(
    workspace.guideSettings.customMonthlyEssentialBaseline !== null
      ? String(workspace.guideSettings.customMonthlyEssentialBaseline)
      : ''
  );
  const [planningSaved, setPlanningSaved] = useState(false);

  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name: nameInput.trim() || 'Member',
      email: emailInput.trim(),
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const handleSavePlanning = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(baselineInput);
    updateGuideSettings({
      customMonthlyEssentialBaseline:
        baselineInput.trim() && Number.isFinite(num) && num > 0 ? num : null,
    });
    setPlanningSaved(true);
    setTimeout(() => setPlanningSaved(false), 2000);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `elevate-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
      const res = importWorkspaceJSON(String(reader.result ?? ''));
      setImportStatus(
        res.ok
          ? 'Workspace backup imported successfully.'
          : res.error ?? 'Failed to import backup file.'
      );
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl">
      <div>
        <p className="text-xs font-semibold text-[#1E8A78]">
          Workspace Preferences & Portability
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
          Settings
        </h1>
        <p className="mt-1.5 text-sm text-[#425466]">
          Manage your profile, display currency, planning assumptions, and local data backups.
        </p>
      </div>

      {/* Profile & Session */}
      <Card>
        <CardHeader
          title="Profile & Session"
          subtitle="Stored locally in this browser; sign out anytime to return to the Elevate landing page"
        />

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="settings-name"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Display Name
              </label>
              <input
                id="settings-name"
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>

            <div>
              <label
                htmlFor="settings-email"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Email Label (Optional)
              </label>
              <input
                id="settings-email"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button type="submit" variant="primary" size="sm">
              {profileSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save Profile</span>
              )}
            </Button>

            <Button type="button" variant="outline" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* Currency & Guide Planning Defaults */}
      <Card>
        <CardHeader
          title="Currency & Planning Baselines"
          subtitle="Configure formatting currency and Elevate Guide emergency runway defaults"
        />

        <form onSubmit={handleSavePlanning} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="settings-currency"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Display Currency
              </label>
              <select
                id="settings-currency"
                value={workspace.currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="settings-runway-months"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Emergency Target (Months)
              </label>
              <select
                id="settings-runway-months"
                value={workspace.guideSettings.emergencyTargetMonths}
                onChange={(e) =>
                  updateGuideSettings({
                    emergencyTargetMonths: Number(e.target.value),
                  })
                }
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              >
                {[3, 4, 5, 6, 9, 12].map((m) => (
                  <option key={m} value={m}>
                    {m} months
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="settings-baseline"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Essential Cost Override ({workspace.currency})
              </label>
              <input
                id="settings-baseline"
                type="number"
                min="0"
                step="10"
                value={baselineInput}
                onChange={(e) => setBaselineInput(e.target.value)}
                placeholder="Auto from Flow"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div>
            <Button type="submit" variant="secondary" size="sm">
              {planningSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Preferences Updated</span>
                </>
              ) : (
                <span>Save Planning Preferences</span>
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* Data Portability & Reset */}
      <Card>
        <CardHeader
          title="Backup, Restore & Reset"
          subtitle="Download your complete workspace as JSON or clear all entries to start fresh"
        />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleExportJSON}>
              <Download className="w-4 h-4" />
              <span>Export JSON Backup</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              <span>Import JSON Backup</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileImport}
              className="sr-only"
            />
          </div>

          {importStatus && (
            <p className="text-xs font-medium text-[#1E8A78]">{importStatus}</p>
          )}

          <div className="pt-4 border-t border-[#142A3B]/10 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#425466]">
              Clearing your workspace permanently removes all accounts, transactions, budgets, holdings, snapshots, goals, and policies stored in this browser.
            </p>
            {!confirmReset ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmReset(true)}
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All Data</span>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    clearWorkspace();
                    setBaselineInput('');
                    setConfirmReset(false);
                  }}
                >
                  Confirm Clear Everything
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
