import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Archive,
  ArrowRight,
  Check,
  CreditCard,
  Download,
  KeyRound,
  LogOut,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { NavViewId } from '../../types/finance';
import { useElevate } from '../../context/ElevateContext';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'INR'];

interface SettingsPillarProps {
  onNavigate: (view: NavViewId) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SettingsPillar({ onNavigate }: SettingsPillarProps) {
  const {
    user,
    updateProfile,
    changePassword,
    signOut,
    workspace,
    syncStatus,
    entitlement,
    entitlements,
    totalGoalsCount,
    setCurrency,
    updateGuideSettings,
    clearWorkspace,
    importWorkspaceJSON,
    backups,
    backupsLoading,
    auditLogs,
    refreshBackups,
    createServerBackup,
    restoreServerBackup,
    downloadServerBackup,
    refreshAuditLogs,
  } = useElevate();

  const [nameInput, setNameInput] = useState(user?.name ?? '');
  const [emailInput, setEmailInput] = useState(user?.email ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [baselineInput, setBaselineInput] = useState(
    workspace.guideSettings.customMonthlyEssentialBaseline !== null
      ? String(workspace.guideSettings.customMonthlyEssentialBaseline)
      : ''
  );
  const [planningSaved, setPlanningSaved] = useState(false);

  const [backupNoteInput, setBackupNoteInput] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  const [importStatus, setImportStatus] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [clearing, setClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameInput(user?.name ?? '');
    setEmailInput(user?.email ?? '');
  }, [user?.name, user?.email]);

  useEffect(() => {
    setBaselineInput(
      workspace.guideSettings.customMonthlyEssentialBaseline !== null
        ? String(workspace.guideSettings.customMonthlyEssentialBaseline)
        : ''
    );
  }, [workspace.guideSettings.customMonthlyEssentialBaseline]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileSaving) return;
    setProfileError(null);
    setProfileSaved(false);

    const cleanName = nameInput.trim();
    const cleanEmail = emailInput.trim();
    if (!cleanName) {
      setProfileError('Display name cannot be empty.');
      return;
    }
    if (!cleanEmail) {
      setProfileError('Email address cannot be empty.');
      return;
    }

    setProfileSaving(true);
    const res = await updateProfile({ name: cleanName, email: cleanEmail });
    setProfileSaving(false);
    if (!res.ok) {
      setProfileError(res.error || 'Could not update profile.');
      return;
    }
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordSaving) return;
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    const res = await changePassword({ currentPassword, newPassword });
    setPasswordSaving(false);
    if (!res.ok) {
      setPasswordError(res.error || 'Failed to update password.');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordSuccess('Password updated and previous session tokens revoked.');
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

  const handleCreateServerBackup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    setBackupFeedback(null);
    const res = await createServerBackup(backupNoteInput.trim() || undefined);
    setBackupBusy(false);
    if (!res.ok) {
      setBackupFeedback({
        type: 'err',
        text: res.error || 'Failed to create server backup.',
      });
      return;
    }
    setBackupNoteInput('');
    setBackupFeedback({
      type: 'ok',
      text: 'Server backup snapshot saved to your account.',
    });
  };

  const handleRestoreServerBackup = async (backupId: string) => {
    if (backupBusy) return;
    setBackupBusy(true);
    setBackupFeedback(null);
    const res = await restoreServerBackup(backupId);
    setBackupBusy(false);
    setConfirmRestoreId(null);
    if (!res.ok) {
      setBackupFeedback({
        type: 'err',
        text: res.error || 'Unable to restore backup.',
      });
      return;
    }
    setBackupFeedback({
      type: 'ok',
      text: 'Workspace restored from selected backup (pre-restore safety snapshot saved).',
    });
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
    reader.onload = async () => {
      const res = await importWorkspaceJSON(String(reader.result ?? ''));
      setImportStatus(
        res.ok
          ? { type: 'ok', text: 'Workspace JSON validated and saved to your account.' }
          : { type: 'err', text: res.error ?? 'Failed to import backup file.' }
      );
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmClearWorkspace = async () => {
    if (clearing) return;
    setClearing(true);
    const res = await clearWorkspace();
    setClearing(false);
    setConfirmReset(false);
    if (res.ok) {
      setBaselineInput('');
      setBackupFeedback({
        type: 'ok',
        text: 'Workspace cleared. If you had existing records, a pre-reset backup was saved automatically.',
      });
    } else {
      setBackupFeedback({
        type: 'err',
        text: res.error || 'Could not clear workspace.',
      });
    }
  };

  const aiUsed = entitlement?.aiQuestionsUsed ?? 0;
  const aiLimit = entitlement?.aiQuestionsLimit ?? entitlements.aiMonthlyQuota;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#1E8A78]">
            Account Security, Backups &amp; Preferences
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
            Settings
          </h1>
          <p className="mt-1.5 text-sm text-[#425466]">
            Manage your authenticated account, password, subscription entitlements, backups, and security log.
          </p>
        </div>

        <p className="text-xs font-medium text-[#627384] shrink-0">
          {syncStatus === 'saving'
            ? 'Saving changes…'
            : syncStatus === 'saved'
              ? 'All changes saved to server'
              : syncStatus === 'error'
                ? 'Server sync error'
                : 'Connected to Elevate server'}
        </p>
      </div>

      {/* Subscription Plan & Server Entitlements */}
      <Card>
        <CardHeader
          title="Subscription Plan & Server Entitlements"
          subtitle="Preview mode — no payment provider is integrated and no live charges are made"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('plans')}
            >
              <span>Manage Plan &amp; Compare</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10 text-xs">
          <div>
            <span className="text-[#627384] flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#1E8A78]" />
              <span>Active Plan</span>
            </span>
            <p className="mt-1 text-sm font-bold text-[#142A3B]">
              {entitlement?.status === 'ended'
                ? 'Ended (Inactive)'
                : entitlement?.plan === 'pro'
                  ? 'Elevate Pro · ₹199/mo'
                  : 'Elevate Basic · ₹99/mo'}
            </p>
            <p className="text-[11px] text-[#627384] mt-0.5 capitalize">
              Status: {(entitlement?.status ?? 'active').replace('_', ' ')}
            </p>
          </div>
          <div>
            <span className="text-[#627384] block">Guide AI Allowance</span>
            <p className="mt-1 text-sm font-bold font-mono tabular-nums text-[#142A3B]">
              {aiUsed} / {aiLimit} questions
            </p>
            <p className="text-[11px] text-[#627384] mt-0.5">
              Enforced server-side per month
            </p>
          </div>
          <div>
            <span className="text-[#627384] block">Goals &amp; Budgets</span>
            <p className="mt-1 text-sm font-bold font-mono tabular-nums text-[#142A3B]">
              {entitlements.maxGoals !== null
                ? `${totalGoalsCount} / ${entitlements.maxGoals} goals`
                : `${totalGoalsCount} goals · Unlimited`}
            </p>
            <p className="text-[11px] text-[#627384] mt-0.5">
              {entitlements.maxBudgets !== null
                ? `${workspace.budgets.length} / ${entitlements.maxBudgets} budgets`
                : `${workspace.budgets.length} budgets · Unlimited`}
            </p>
          </div>
        </div>
      </Card>

      {/* Account Profile & Password */}
      <Card>
        <CardHeader
          title="Account Profile & Session"
          subtitle="Persisted on the Elevate server; sign out anytime to revoke your active session token"
        />

        <form onSubmit={handleSaveProfile} className="space-y-4">
          {profileError && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-xl bg-[#B42318]/8 border border-[#B42318]/25 text-xs font-medium text-[#B42318]"
            >
              {profileError}
            </div>
          )}

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
                maxLength={80}
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
                Account Email
              </label>
              <input
                id="settings-email"
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={profileSaving}
            >
              {profileSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved</span>
                </>
              ) : (
                <span>{profileSaving ? 'Saving…' : 'Save Profile'}</span>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void signOut();
              }}
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </form>

        {/* Change Password */}
        <form
          onSubmit={handleChangePassword}
          className="mt-6 pt-6 border-t border-[#142A3B]/10 space-y-4"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#1E8A78]" />
            <h3 className="text-sm font-semibold text-[#142A3B]">
              Update Password
            </h3>
          </div>

          {passwordError && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-xl bg-[#B42318]/8 border border-[#B42318]/25 text-xs font-medium text-[#B42318]"
            >
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="px-3.5 py-2.5 rounded-xl bg-[#1E8A78]/10 border border-[#1E8A78]/25 text-xs font-medium text-[#142A3B]">
              {passwordSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="settings-current-pw"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Current Password
              </label>
              <input
                id="settings-current-pw"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>

            <div>
              <label
                htmlFor="settings-new-pw"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                New Password (min 8 chars)
              </label>
              <input
                id="settings-new-pw"
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>

            <div>
              <label
                htmlFor="settings-confirm-pw"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Confirm New Password
              </label>
              <input
                id="settings-confirm-pw"
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={passwordSaving}
            >
              <span>{passwordSaving ? 'Updating Password…' : 'Change Password'}</span>
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

      {/* Server Backups, Restore & Portability */}
      <Card>
        <CardHeader
          title="Server Backups, Restore & Portability"
          subtitle="Create manual snapshots on the server, restore prior checkpoints, or export/import JSON"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void refreshBackups();
              }}
              disabled={backupsLoading}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </Button>
          }
        />

        <div className="space-y-5">
          {backupFeedback && (
            <div
              role={backupFeedback.type === 'err' ? 'alert' : 'status'}
              className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium ${
                backupFeedback.type === 'err'
                  ? 'bg-[#B42318]/8 border-[#B42318]/25 text-[#B42318]'
                  : 'bg-[#1E8A78]/10 border-[#1E8A78]/25 text-[#142A3B]'
              }`}
            >
              {backupFeedback.text}
            </div>
          )}

          {/* Create Server Backup */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              maxLength={100}
              aria-label="Backup note"
              value={backupNoteInput}
              onChange={(e) => setBackupNoteInput(e.target.value)}
              placeholder="Optional snapshot note (e.g., Month-end close)"
              className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
            />
            <Button
              variant="secondary"
              onClick={handleCreateServerBackup}
              disabled={backupBusy}
            >
              <Archive className="w-4 h-4" />
              <span>{backupBusy ? 'Saving…' : 'Create Server Backup'}</span>
            </Button>
          </div>

          {/* Stored Server Backups List */}
          {backups.length > 0 ? (
            <ul className="divide-y divide-[#142A3B]/10 rounded-xl border border-[#142A3B]/10 bg-[#F7F9FA]/50">
              {backups.slice(0, 8).map((b) => (
                <li
                  key={b.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-[#142A3B] truncate">
                        {b.note}
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white border border-[#142A3B]/10 text-[#425466]">
                        {b.reason.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#627384] mt-1 font-mono tabular-nums">
                      {new Date(b.createdAt).toLocaleString()} · {formatBytes(b.sizeBytes)} ·{' '}
                      {b.counts.transactions} tx, {b.counts.holdings} holdings,{' '}
                      {b.counts.policies} policies
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void downloadServerBackup(b.id);
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>JSON</span>
                    </Button>
                    {confirmRestoreId === b.id ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmRestoreId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={backupBusy}
                          onClick={() => {
                            void handleRestoreServerBackup(b.id);
                          }}
                        >
                          Confirm Restore
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmRestoreId(b.id)}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#627384]">
              No server backups yet. Manual backups, automatic rolling checkpoints, and pre-reset snapshots appear here.
            </p>
          )}

          {/* Portable File Export/Import */}
          <div className="pt-4 border-t border-[#142A3B]/10 flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleExportJSON}>
              <Download className="w-4 h-4" />
              <span>Export Current JSON</span>
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
            <p
              className={`text-xs font-medium ${
                importStatus.type === 'err' ? 'text-[#B42318]' : 'text-[#1E8A78]'
              }`}
            >
              {importStatus.text}
            </p>
          )}

          {/* Reset Workspace */}
          <div className="pt-4 border-t border-[#142A3B]/10 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#425466] max-w-lg">
              Clearing your workspace resets all Flow, Guide, Wealth, and Secure entries on the server. A pre-reset safety backup is created automatically if records exist.
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
                  disabled={clearing}
                  onClick={() => {
                    void handleConfirmClearWorkspace();
                  }}
                >
                  {clearing ? 'Clearing…' : 'Confirm Clear Everything'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Account Activity & Security Audit Log */}
      <Card>
        <CardHeader
          title="Security & Activity Log"
          subtitle="Recent authentication, entitlement, backup, and export events recorded on the server for your account"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void refreshAuditLogs();
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </Button>
          }
        />

        {auditLogs.length > 0 ? (
          <ul className="divide-y divide-[#142A3B]/8 max-h-72 overflow-y-auto pr-1">
            {auditLogs.slice(0, 20).map((entry) => (
              <li
                key={entry.id}
                className="py-2.5 flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <Activity
                    className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                      entry.level === 'error'
                        ? 'text-[#B42318]'
                        : entry.level === 'warn'
                          ? 'text-[#946C1B]'
                          : 'text-[#1E8A78]'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-[#142A3B]">
                      {entry.event}
                    </p>
                    <p className="text-[#425466] truncate">{entry.detail}</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-[#627384] shrink-0">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[#627384]">
            Activity events for your account will appear here as you sign in, update plans, or create backups.
          </p>
        )}
      </Card>

      {/* Connected vs. Preview Boundaries Disclosure */}
      <Card>
        <CardHeader
          title="Connected Capabilities vs. Preview / Manual Boundaries"
          subtitle="Clear documentation of live server integrations and features that are intentionally manual or preview-only"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
          <div className="p-4 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10 space-y-2">
            <p className="font-semibold text-[#1E8A78] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Live Backend &amp; Enforced Controls</span>
            </p>
            <ul className="space-y-1.5 text-[#425466] list-disc pl-4">
              <li>
                Email/password authentication with per-user salted scrypt hashes and server-revocable HMAC session tokens.
              </li>
              <li>
                Per-user isolated ledger persistence, schema validation, plan quota checks, rolling backups, and audit logs on the server.
              </li>
              <li>
                Server-side Gemini API proxy for Elevate Guide coaching and Monthly Reviews (when <code>GEMINI_API_KEY</code> is configured).
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10 space-y-2">
            <p className="font-semibold text-[#946C1B]">
              Preview Mode &amp; Manual-Only Integrations
            </p>
            <ul className="space-y-1.5 text-[#425466] list-disc pl-4">
              <li>
                <strong>Subscription Billing (₹99 / ₹199):</strong> Preview-only plan switching and cancellation; no payment processor is connected and no cards are charged.
              </li>
              <li>
                <strong>Bank Feeds, Market Quotes &amp; Carrier APIs:</strong> Not connected by design—balances, holdings, valuations, and policy records are strictly user-entered.
              </li>
              <li>
                <strong>Notifications:</strong> Policy renewal reminders display inside the app rather than sending external email/SMS alerts.
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
