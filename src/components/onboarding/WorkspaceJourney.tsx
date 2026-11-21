import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDot,
  Mail,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { GmailDetectedItem, InsuranceCategory } from '../../types/finance';
import { useElevate } from '../../context/ElevateContext';
import { formatCurrency, formatDateShort } from '../../utils/format';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { GoogleSignInButton } from '../ui/GoogleSignInButton';

const INSURANCE_CATEGORIES: Array<{
  id: InsuranceCategory;
  label: string;
  hint: string;
}> = [
  { id: 'Health', label: 'Health / Medical', hint: 'Individual or family floater' },
  { id: 'Life', label: 'Term / Life', hint: 'Income replacement cover' },
  { id: 'Auto', label: 'Motor / Auto', hint: 'Car or two-wheeler policy' },
  { id: 'Home & Renters', label: 'Home & Renters', hint: 'Property or contents cover' },
  { id: 'Disability', label: 'Disability / Critical Illness', hint: 'Accident or illness rider' },
  { id: 'Umbrella / Other', label: 'Umbrella / Other', hint: 'Travel or excess liability' },
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'CAD', 'AUD'];

const KIND_LABELS: Record<GmailDetectedItem['kind'], string> = {
  emi_due: 'EMI Due',
  emi_paid: 'EMI Paid',
  expense: 'Expense / Bill',
  sip_debit: 'SIP Debit',
};

export function WorkspaceJourney() {
  const {
    user,
    workspace,
    gmailAccessToken,
    gmailScanning,
    gmailError,
    gmailAnalyzerMode,
    clearGmailError,
    saveOnboardingStep1,
    setOnboardingStep,
    completeOnboarding,
    connectGmailAndScan,
    importGmailItem,
    importAllPendingGmailItems,
    dismissGmailItem,
  } = useElevate();

  const ob = workspace.onboarding;
  const activeStep: 1 | 2 | 3 = ob.currentStep === 2 ? 2 : 1;

  // Step 1 local form state
  const existingPrimaryAccount = workspace.accounts.find(
    (a) => a.id === 'acc_onboarding_primary'
  );
  const [ageInput, setAgeInput] = useState(
    ob.age !== null ? String(ob.age) : ''
  );
  const [hasInsurance, setHasInsurance] = useState<boolean | null>(
    ob.hasInsurance
  );
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceCategory[]>(
    ob.insuranceTypes ?? []
  );
  const [sipCountInput, setSipCountInput] = useState(
    ob.sipCount !== null ? String(ob.sipCount) : '0'
  );
  const [monthlySipInput, setMonthlySipInput] = useState(
    ob.monthlySipAmount !== null && ob.monthlySipAmount > 0
      ? String(ob.monthlySipAmount)
      : ''
  );
  const [balanceInput, setBalanceInput] = useState(
    ob.startingBalance !== null ? String(ob.startingBalance) : ''
  );
  const [currencyInput, setCurrencyInput] = useState(
    workspace.currency || 'INR'
  );
  const [accountNameInput, setAccountNameInput] = useState(
    existingPrimaryAccount?.name ?? 'Primary Bank Account'
  );
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2 local state
  const [scanSummary, setScanSummary] = useState<string | null>(null);
  const [amountOverrides, setAmountOverrides] = useState<Record<string, string>>(
    {}
  );
  const [itemError, setItemError] = useState<string | null>(null);

  const toggleInsuranceType = (cat: InsuranceCategory) => {
    setInsuranceTypes((prev) =>
      prev.includes(cat) ? prev.filter((item) => item !== cat) : [...prev, cat]
    );
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep1Error(null);

    const parsedAge = Number(ageInput);
    if (!Number.isFinite(parsedAge) || parsedAge < 16 || parsedAge > 100) {
      setStep1Error('Please enter a valid age between 16 and 100.');
      return;
    }

    if (hasInsurance === null) {
      setStep1Error('Please select whether you currently have any insurance policies.');
      return;
    }

    if (hasInsurance && insuranceTypes.length === 0) {
      setStep1Error('Select at least one insurance type that you hold.');
      return;
    }

    const parsedSipCount = Number(sipCountInput);
    if (!Number.isFinite(parsedSipCount) || parsedSipCount < 0 || parsedSipCount > 100) {
      setStep1Error('Enter your number of active SIPs (0 or more).');
      return;
    }

    const parsedMonthlySip =
      parsedSipCount > 0 && monthlySipInput.trim() !== ''
        ? Number(monthlySipInput)
        : 0;
    if (!Number.isFinite(parsedMonthlySip) || parsedMonthlySip < 0) {
      setStep1Error('Monthly SIP contribution must be 0 or greater.');
      return;
    }

    const parsedBalance = Number(balanceInput);
    if (balanceInput.trim() === '' || !Number.isFinite(parsedBalance) || parsedBalance < 0) {
      setStep1Error('Please enter your current available bank or cash balance (0 or greater).');
      return;
    }

    saveOnboardingStep1({
      age: Math.round(parsedAge),
      hasInsurance,
      insuranceTypes: hasInsurance ? insuranceTypes : [],
      sipCount: Math.round(parsedSipCount),
      monthlySipAmount: parsedMonthlySip,
      startingBalance: parsedBalance,
      currency: currencyInput,
      accountName: accountNameInput.trim() || 'Primary Bank Account',
    });
  };

  const handleScanGmail = async () => {
    clearGmailError();
    setScanSummary(null);
    setItemError(null);
    const res = await connectGmailAndScan();
    if (res.ok) {
      setScanSummary(
        `Scanned ${res.scannedEmailsCount ?? 0} recent financial email(s); found ${res.detectedCount ?? 0} new alert(s) to review.`
      );
    }
  };

  const handleImportSingle = (item: GmailDetectedItem) => {
    setItemError(null);
    const overrideRaw = amountOverrides[item.id];
    const overrideNum =
      overrideRaw !== undefined && overrideRaw.trim() !== ''
        ? Number(overrideRaw)
        : undefined;
    const res = importGmailItem(item.id, overrideNum);
    if (!res.ok) {
      setItemError(res.error || 'Could not add this item to Elevate Flow.');
    }
  };

  const handleApproveAll = () => {
    setItemError(null);
    const res = importAllPendingGmailItems();
    if (res.skippedCount > 0) {
      setScanSummary(
        `Imported ${res.importedCount} item(s) to Flow. ${res.skippedCount} item(s) need an amount entered manually before importing.`
      );
    } else if (res.importedCount > 0) {
      setScanSummary(
        `Imported all ${res.importedCount} detected item(s) into Elevate Flow.`
      );
    }
  };

  const pendingItems = useMemo(
    () => workspace.gmailItems.filter((g) => g.status === 'pending'),
    [workspace.gmailItems]
  );
  const importedItems = useMemo(
    () => workspace.gmailItems.filter((g) => g.status === 'imported'),
    [workspace.gmailItems]
  );

  const emiDuePending = pendingItems.filter((i) => i.kind === 'emi_due');
  const emiPaidOrExpensePending = pendingItems.filter(
    (i) => i.kind === 'emi_paid' || i.kind === 'expense' || i.kind === 'sip_debit'
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#1E8A78]">
            Welcome, {user?.name ?? 'Member'} · Workspace Setup Journey
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
            {activeStep === 1
              ? 'Step 1: Build your financial baseline'
              : 'Step 2: Connect Gmail for EMIs & expenses'}
          </h1>
          <p className="mt-1.5 text-sm text-[#425466]">
            {activeStep === 1
              ? 'Answer five quick questions so Elevate can configure your starting balance, SIP plan, and protection priorities.'
              : 'Optionally scan your inbox (read-only) to surface EMI due dates, paid EMIs, and email expenses before entering your Dashboard.'}
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => completeOnboarding({ skipGmail: true })}
        >
          <span>Skip setup to Dashboard</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* 3-Step Journey Stepper */}
      <div
        aria-label="Workspace onboarding steps"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        {[
          {
            step: 1 as const,
            title: '01. Profile Questions',
            sub: 'Age, insurance, SIPs & balance',
            done: ob.completedStep1,
          },
          {
            step: 2 as const,
            title: '02. Connect Gmail',
            sub: 'Detect EMIs due, paid & expenses',
            done: ob.gmailConnected,
          },
          {
            step: 3 as const,
            title: '03. Your Dashboard',
            sub: 'Live workspace & next actions',
            done: ob.completed,
          },
        ].map((item) => {
          const isCurrent = activeStep === item.step;
          const clickable = item.step === 1 || (item.step === 2 && ob.completedStep1);
          return (
            <button
              key={item.step}
              type="button"
              disabled={!clickable && item.step !== 3}
              onClick={() => {
                if (item.step === 1 || item.step === 2) {
                  setOnboardingStep(item.step);
                } else {
                  completeOnboarding();
                }
              }}
              className={`p-4 rounded-xl border text-left transition-colors flex items-start gap-3 ${
                isCurrent
                  ? 'border-[#1E8A78] bg-white'
                  : item.done
                    ? 'border-[#142A3B]/15 bg-[#F7F9FA]/80 hover:bg-white'
                    : 'border-[#142A3B]/10 bg-[#F7F9FA]/50 opacity-85'
              } ${clickable || item.step === 3 ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {item.done ? (
                <CheckCircle2 className="w-4 h-4 text-[#1E8A78] mt-0.5 shrink-0" />
              ) : (
                <CircleDot
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    isCurrent ? 'text-[#1E8A78]' : 'text-[#627384]'
                  }`}
                />
              )}
              <div className="min-w-0">
                <p className="text-xs font-mono font-semibold text-[#142A3B]">
                  {item.title}
                </p>
                <p className="text-xs text-[#627384] mt-0.5 truncate">{item.sub}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* STEP 1 FORM */}
      {activeStep === 1 && (
        <Card>
          <form onSubmit={handleStep1Submit} className="space-y-6">
            {step1Error && (
              <div
                role="alert"
                className="px-4 py-3 rounded-xl bg-[#B42318]/8 border border-[#B42318]/25 text-xs font-medium text-[#B42318]"
              >
                {step1Error}
              </div>
            )}

            {/* Question 1 & Question 5 (Balance & Currency) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="ob-age"
                  className="block text-xs font-semibold text-[#142A3B] mb-1.5"
                >
                  1. What is your age?
                </label>
                <input
                  id="ob-age"
                  type="number"
                  min={16}
                  max={100}
                  required
                  value={ageInput}
                  onChange={(e) => setAgeInput(e.target.value)}
                  placeholder="e.g., 29"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                />
              </div>

              <div>
                <label
                  htmlFor="ob-currency"
                  className="block text-xs font-semibold text-[#142A3B] mb-1.5"
                >
                  Workspace Currency
                </label>
                <select
                  id="ob-currency"
                  value={currencyInput}
                  onChange={(e) => setCurrencyInput(e.target.value)}
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
                  htmlFor="ob-account-label"
                  className="block text-xs font-semibold text-[#142A3B] mb-1.5"
                >
                  Primary Account Label
                </label>
                <input
                  id="ob-account-label"
                  type="text"
                  maxLength={60}
                  value={accountNameInput}
                  onChange={(e) => setAccountNameInput(e.target.value)}
                  placeholder="Primary Bank Account"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                />
              </div>
            </div>

            {/* Question 2 & 3: Insurance status + types */}
            <div className="pt-4 border-t border-[#142A3B]/10 space-y-4">
              <div>
                <p className="text-xs font-semibold text-[#142A3B]">
                  2. Have you taken any insurance policies?
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-3 max-w-sm">
                  {[
                    { val: true, label: 'Yes, I have insurance' },
                    { val: false, label: 'No insurance yet' },
                  ].map((opt) => {
                    const selected = hasInsurance === opt.val;
                    return (
                      <button
                        key={String(opt.val)}
                        type="button"
                        onClick={() => setHasInsurance(opt.val)}
                        className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#1E8A78] bg-[#1E8A78]/8 text-[#142A3B]'
                            : 'border-[#142A3B]/15 bg-white text-[#425466] hover:border-[#142A3B]/30'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {hasInsurance && (
                <div>
                  <p className="text-xs font-semibold text-[#142A3B] mb-2">
                    3. Which insurances do you currently hold?
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {INSURANCE_CATEGORIES.map((cat) => {
                      const active = insuranceTypes.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleInsuranceType(cat.id)}
                          className={`p-3 rounded-xl border text-left transition-colors flex items-start gap-2.5 cursor-pointer ${
                            active
                              ? 'border-[#1E8A78] bg-[#1E8A78]/8'
                              : 'border-[#142A3B]/12 bg-[#F7F9FA]/60 hover:bg-white'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded mt-0.5 border flex items-center justify-center shrink-0 ${
                              active
                                ? 'bg-[#1E8A78] border-[#1E8A78] text-white'
                                : 'border-[#142A3B]/30 bg-white'
                            }`}
                          >
                            {active && <Check className="w-3 h-3" />}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#142A3B]">
                              {cat.label}
                            </p>
                            <p className="text-[11px] text-[#627384]">{cat.hint}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Question 4 & Question 5: SIP count + Starting Balance */}
            <div className="pt-4 border-t border-[#142A3B]/10 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="ob-sip-count"
                  className="block text-xs font-semibold text-[#142A3B] mb-1.5"
                >
                  4. How many active SIPs do you have?
                </label>
                <input
                  id="ob-sip-count"
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={sipCountInput}
                  onChange={(e) => setSipCountInput(e.target.value)}
                  placeholder="0"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                />
              </div>

              {Number(sipCountInput) > 0 && (
                <div>
                  <label
                    htmlFor="ob-sip-monthly"
                    className="block text-xs font-semibold text-[#142A3B] mb-1.5"
                  >
                    Total Monthly SIP ({currencyInput})
                  </label>
                  <input
                    id="ob-sip-monthly"
                    type="number"
                    min={0}
                    step="100"
                    value={monthlySipInput}
                    onChange={(e) => setMonthlySipInput(e.target.value)}
                    placeholder="e.g., 15000"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="ob-balance"
                  className="block text-xs font-semibold text-[#142A3B] mb-1.5"
                >
                  5. Current bank / cash balance ({currencyInput})
                </label>
                <input
                  id="ob-balance"
                  type="number"
                  min={0}
                  step="any"
                  required
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(e.target.value)}
                  placeholder="e.g., 125000"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#142A3B]/10 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#627384]">
                Your starting balance seeds your Flow cash account cleanly—no placeholder data is added.
              </p>
              <Button type="submit" variant="secondary">
                <span>Save &amp; Continue to Step 2</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* STEP 2: CONNECT GMAIL & SCAN EMIs / EXPENSES */}
      {activeStep === 2 && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="space-y-2 max-w-xl">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#1E8A78]">
                  <Mail className="w-4 h-4" />
                  <span>Read-Only Gmail Financial Scan</span>
                </div>
                <h2 className="text-lg font-bold text-[#142A3B]">
                  Identify EMIs due, EMIs paid, SIP debits &amp; email expenses
                </h2>
                <p className="text-xs text-[#425466] leading-relaxed">
                  Elevate requests strictly <code className="font-mono">gmail.readonly</code> access to read bank/card alerts, loan EMI reminders, and SIP confirmations. Nothing is added to your Flow ledger until you approve it below.
                </p>
                {ob.gmailConnected && (
                  <p className="text-xs font-medium text-[#1E8A78]">
                    Connected inbox: {ob.gmailEmail || user?.email}
                    {ob.lastGmailScanAt
                      ? ` · Last scanned ${new Date(ob.lastGmailScanAt).toLocaleString()}`
                      : ''}
                  </p>
                )}
              </div>

              <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-2">
                {gmailAccessToken ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void handleScanGmail();
                    }}
                    disabled={gmailScanning}
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${gmailScanning ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {gmailScanning ? 'Scanning Inbox…' : 'Scan Gmail Inbox Now'}
                    </span>
                  </Button>
                ) : (
                  <GoogleSignInButton
                    onClick={() => {
                      void handleScanGmail();
                    }}
                    disabled={gmailScanning}
                    label={
                      gmailScanning
                        ? 'Connecting & Scanning…'
                        : 'Connect Gmail & Scan Emails'
                    }
                  />
                )}
              </div>
            </div>

            {gmailError && (
              <div
                role="alert"
                className="mt-4 px-4 py-3 rounded-xl bg-[#B42318]/8 border border-[#B42318]/25 text-xs font-medium text-[#B42318] flex items-center justify-between gap-3"
              >
                <span>{gmailError}</span>
                <button
                  type="button"
                  onClick={clearGmailError}
                  aria-label="Dismiss error"
                  className="p-1 rounded hover:bg-white/60 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {scanSummary && (
              <div className="mt-4 px-4 py-3 rounded-xl bg-[#1E8A78]/10 border border-[#1E8A78]/25 text-xs font-medium text-[#142A3B] flex flex-wrap items-center justify-between gap-2">
                <span>{scanSummary}</span>
                {gmailAnalyzerMode && (
                  <span className="text-[11px] font-mono text-[#627384]">
                    Classifier: {gmailAnalyzerMode}
                  </span>
                )}
              </div>
            )}

            {itemError && (
              <div
                role="alert"
                className="mt-4 px-4 py-3 rounded-xl bg-[#B42318]/8 border border-[#B42318]/25 text-xs font-medium text-[#B42318]"
              >
                {itemError}
              </div>
            )}
          </Card>

          {/* Pending Gmail Alerts Requiring Review */}
          {pendingItems.length > 0 && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#142A3B]/10">
                <div>
                  <h3 className="text-base font-bold text-[#142A3B]">
                    Detected Alerts Ready for Approval ({pendingItems.length})
                  </h3>
                  <p className="text-xs text-[#627384]">
                    EMIs Due are added as Recurring Bills; EMIs Paid, SIP Debits, and Expenses are logged as Flow transactions.
                  </p>
                </div>
                <Button variant="primary" size="sm" onClick={handleApproveAll}>
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve All With Amounts</span>
                </Button>
              </div>

              <div className="mt-4 space-y-5">
                {emiDuePending.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#946C1B] flex items-center gap-1.5 mb-2.5">
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>EMIs Due ({emiDuePending.length})</span>
                    </p>
                    <ul className="divide-y divide-[#142A3B]/10 rounded-xl border border-[#142A3B]/10 bg-[#F7F9FA]/60">
                      {emiDuePending.map((item) => (
                        <GmailAlertRow
                          key={item.id}
                          item={item}
                          overrideValue={amountOverrides[item.id] ?? ''}
                          onOverrideChange={(val) =>
                            setAmountOverrides((prev) => ({
                              ...prev,
                              [item.id]: val,
                            }))
                          }
                          onImport={() => handleImportSingle(item)}
                          onDismiss={() => dismissGmailItem(item.id)}
                        />
                      ))}
                    </ul>
                  </div>
                )}

                {emiPaidOrExpensePending.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[#1E8A78] flex items-center gap-1.5 mb-2.5">
                      <Wallet className="w-3.5 h-3.5" />
                      <span>
                        EMIs Paid, SIP Debits &amp; Email Expenses (
                        {emiPaidOrExpensePending.length})
                      </span>
                    </p>
                    <ul className="divide-y divide-[#142A3B]/10 rounded-xl border border-[#142A3B]/10 bg-[#F7F9FA]/60">
                      {emiPaidOrExpensePending.map((item) => (
                        <GmailAlertRow
                          key={item.id}
                          item={item}
                          overrideValue={amountOverrides[item.id] ?? ''}
                          onOverrideChange={(val) =>
                            setAmountOverrides((prev) => ({
                              ...prev,
                              [item.id]: val,
                            }))
                          }
                          onImport={() => handleImportSingle(item)}
                          onDismiss={() => dismissGmailItem(item.id)}
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          )}

          {importedItems.length > 0 && (
            <Card>
              <p className="text-xs font-semibold text-[#1E8A78] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {importedItems.length} email item(s) already approved and synced into Elevate Flow.
                </span>
              </p>
            </Card>
          )}

          {/* Step 2 Navigation Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setOnboardingStep(1)}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Step 1</span>
            </Button>

            <div className="flex flex-wrap items-center gap-3">
              {!ob.gmailConnected && (
                <Button
                  variant="ghost"
                  onClick={() => completeOnboarding({ skipGmail: true })}
                >
                  Skip Gmail for now
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => completeOnboarding()}
              >
                <span>Finish &amp; Open Step 3: Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Snapshot of Step 1 Choices if on Step 2 */}
      {activeStep === 2 && ob.completedStep1 && (
        <Card className="bg-[#F7F9FA]/70">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[#627384]">Age</span>
              <p className="mt-0.5 font-mono font-semibold text-[#142A3B]">
                {ob.age ?? '—'} yrs
              </p>
            </div>
            <div>
              <span className="text-[#627384] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1E8A78]" />
                <span>Insurance</span>
              </span>
              <p className="mt-0.5 font-semibold text-[#142A3B]">
                {ob.hasInsurance
                  ? `${ob.insuranceTypes.length} type(s)`
                  : 'None reported'}
              </p>
            </div>
            <div>
              <span className="text-[#627384] flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-[#1E8A78]" />
                <span>Active SIPs</span>
              </span>
              <p className="mt-0.5 font-mono font-semibold text-[#142A3B]">
                {ob.sipCount ?? 0}
              </p>
            </div>
            <div>
              <span className="text-[#627384]">Starting Balance</span>
              <p className="mt-0.5 font-mono tabular-nums font-semibold text-[#142A3B]">
                {ob.startingBalance !== null
                  ? formatCurrency(ob.startingBalance, workspace.currency)
                  : '—'}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function GmailAlertRow({
  item,
  overrideValue,
  onOverrideChange,
  onImport,
  onDismiss,
}: {
  item: GmailDetectedItem;
  overrideValue: string;
  onOverrideChange: (val: string) => void;
  onImport: () => void;
  onDismiss: () => void;
}) {
  const needsAmount = item.amount === null || item.amount <= 0;

  return (
    <li className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md border ${
              item.kind === 'emi_due'
                ? 'bg-[#D5A64A]/15 border-[#D5A64A]/40 text-[#946C1B]'
                : item.kind === 'emi_paid'
                  ? 'bg-[#1E8A78]/12 border-[#1E8A78]/30 text-[#1E8A78]'
                  : 'bg-white border-[#142A3B]/15 text-[#142A3B]'
            }`}
          >
            {KIND_LABELS[item.kind]}
          </span>
          <span className="text-xs font-semibold text-[#142A3B] truncate">
            {item.title}
          </span>
        </div>
        <p className="text-[11px] text-[#627384] truncate">
          {item.sender} · {formatDateShort(item.date)}
          {item.dueDate ? ` · Due ${formatDateShort(item.dueDate)}` : ''} · Category: {item.category}
        </p>
        {item.snippet && (
          <p className="text-xs text-[#425466] line-clamp-2">{item.snippet}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {needsAmount ? (
          <input
            type="number"
            min="1"
            step="any"
            value={overrideValue}
            onChange={(e) => onOverrideChange(e.target.value)}
            placeholder={`Amount (${item.currency})`}
            aria-label={`Enter amount for ${item.title}`}
            className="w-28 min-h-[36px] px-2.5 py-1 rounded-lg border border-[#142A3B]/20 bg-white text-xs font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
          />
        ) : (
          <span className="text-xs font-mono font-bold tabular-nums text-[#142A3B] mr-1">
            {formatCurrency(item.amount!, item.currency)}
          </span>
        )}
        <Button variant="secondary" size="sm" onClick={onImport}>
          <Check className="w-3.5 h-3.5" />
          <span>Add to Flow</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          <span>Dismiss</span>
        </Button>
      </div>
    </li>
  );
}
