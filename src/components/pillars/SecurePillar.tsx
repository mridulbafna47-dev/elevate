import React, { useMemo, useState } from 'react';
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Circle,
  Download,
  Edit3,
  Info,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  InsuranceCategory,
  InsurancePolicy,
  NavViewId,
  PolicyStatus,
  PremiumCadence,
} from '../../types/finance';
import { useElevate } from '../../context/ElevateContext';
import {
  annualizePremium,
  daysUntil,
  downloadCSV,
  formatCurrency,
  formatDateShort,
  getTodayISO,
  isValidISODate,
} from '../../utils/format';
import { Card, CardHeader } from '../ui/Card';
import { StatMetric } from '../ui/StatMetric';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ModalSheet } from '../ui/ModalSheet';
import { ErrorBanner, FlowLoadingSkeleton } from '../ui/FeedbackStates';
import { ProFeatureGate } from '../ui/ProFeatureGate';

const INSURANCE_CATEGORIES: InsuranceCategory[] = [
  'Health',
  'Life',
  'Disability',
  'Auto',
  'Home & Renters',
  'Umbrella / Other',
];

const PROTECTION_REVIEW_TASKS = [
  {
    id: 'sec_beneficiaries',
    title: 'Confirm named beneficiaries and insured parties',
    detail: 'Verify beneficiary details on your life and workplace coverage records.',
  },
  {
    id: 'sec_declarations',
    title: 'Store declaration page & policy number references',
    detail: 'Record official policy numbers and carrier contact details for fast reference.',
  },
  {
    id: 'sec_deductibles',
    title: 'Compare highest deductible against your cash reserve',
    detail: 'Ensure your Elevate Flow emergency savings cover your largest active deductible.',
  },
  {
    id: 'sec_household',
    title: 'Share policy register summary with trusted household contact',
    detail: 'Export a CSV or JSON copy so key contacts know where policies are held.',
  },
];

interface FieldErrors {
  [key: string]: string | undefined;
}

interface SecurePillarProps {
  onNavigate: (view: NavViewId) => void;
}

export function SecurePillar({ onNavigate }: SecurePillarProps) {
  const {
    isHydrating,
    storageError,
    clearStorageError,
    workspace,
    totalCashAssets,
    annualInsurancePremiums,
    monthlyInsuranceEquiv,
    activePolicyReminders,
    entitlements,
    requestAuthorizedReportExport,
    addPolicy,
    updatePolicy,
    deletePolicy,
    renewPolicyOneYear,
    toggleSecureChecklist,
  } = useElevate();

  const currency = workspace.currency;

  const [categoryFilter, setCategoryFilter] = useState<'all' | InsuranceCategory>(
    'all'
  );
  const [statusFilter, setStatusFilter] = useState<'all' | PolicyStatus>('all');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(
    null
  );
  const [policyErrors, setPolicyErrors] = useState<FieldErrors>({});

  // Form state
  const [policyName, setPolicyName] = useState('');
  const [provider, setProvider] = useState('');
  const [category, setCategory] = useState<InsuranceCategory>('Health');
  const [status, setStatus] = useState<PolicyStatus>('Active');
  const [policyReference, setPolicyReference] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [coverageLimit, setCoverageLimit] = useState('');
  const [deductible, setDeductible] = useState('');
  const [premiumAmount, setPremiumAmount] = useState('');
  const [premiumCadence, setPremiumCadence] = useState<PremiumCadence>('Monthly');
  const [renewalDate, setRenewalDate] = useState(getTodayISO());
  const [reminderLeadDays, setReminderLeadDays] = useState('30');
  const [beneficiary, setBeneficiary] = useState('');
  const [agentOrContact, setAgentOrContact] = useState('');
  const [notes, setNotes] = useState('');

  const activePolicies = useMemo(
    () => workspace.policies.filter((p) => p.status !== 'Archived'),
    [workspace.policies]
  );

  const totalCoverageLimit = useMemo(
    () => activePolicies.reduce((s, p) => s + (Number(p.coverageLimit) || 0), 0),
    [activePolicies]
  );

  const premiumCadenceTotals = useMemo(() => {
    const totals: Record<PremiumCadence, number> = {
      Monthly: 0,
      Quarterly: 0,
      Annual: 0,
    };
    for (const p of activePolicies) {
      totals[p.premiumCadence] += p.premiumAmount;
    }
    return totals;
  }, [activePolicies]);

  // Pro: Cross-category coverage & deductible summary computed strictly from manual policy records
  const coverageSummary = useMemo(() => {
    const map = new Map<
      InsuranceCategory,
      {
        count: number;
        coverageLimit: number;
        annualPremium: number;
        maxDeductible: number;
      }
    >();
    let highestDeductible = 0;

    for (const p of activePolicies) {
      const annual = annualizePremium(p.premiumAmount, p.premiumCadence);
      const curr = map.get(p.category) ?? {
        count: 0,
        coverageLimit: 0,
        annualPremium: 0,
        maxDeductible: 0,
      };
      curr.count += 1;
      curr.coverageLimit += Number(p.coverageLimit) || 0;
      curr.annualPremium += annual;
      curr.maxDeductible = Math.max(curr.maxDeductible, Number(p.deductible) || 0);
      highestDeductible = Math.max(highestDeductible, Number(p.deductible) || 0);
      map.set(p.category, curr);
    }

    const rows = Array.from(map.entries())
      .map(([catName, vals]) => ({
        category: catName,
        ...vals,
        premiumSharePct:
          annualInsurancePremiums > 0
            ? (vals.annualPremium / annualInsurancePremiums) * 100
            : 0,
      }))
      .sort((a, b) => b.annualPremium - a.annualPremium);

    return {
      rows,
      highestDeductible,
      cashCoversHighestDeductible:
        workspace.accounts.length > 0 && highestDeductible > 0
          ? totalCashAssets >= highestDeductible
          : null,
    };
  }, [
    activePolicies,
    annualInsurancePremiums,
    workspace.accounts.length,
    totalCashAssets,
  ]);

  const openNewPolicy = (defaultCat?: InsuranceCategory) => {
    setEditingPolicy(null);
    setPolicyName('');
    setProvider('');
    setCategory(defaultCat ?? 'Health');
    setStatus('Active');
    setPolicyReference('');
    setEffectiveDate('');
    setCoverageLimit('');
    setDeductible('0');
    setPremiumAmount('');
    setPremiumCadence('Monthly');
    setRenewalDate(getTodayISO());
    setReminderLeadDays('30');
    setBeneficiary('');
    setAgentOrContact('');
    setNotes('');
    setPolicyErrors({});
    setPolicyModalOpen(true);
  };

  const openEditPolicy = (p: InsurancePolicy) => {
    setEditingPolicy(p);
    setPolicyName(p.policyName);
    setProvider(p.provider);
    setCategory(p.category);
    setStatus(p.status ?? 'Active');
    setPolicyReference(p.policyReference ?? '');
    setEffectiveDate(p.effectiveDate ?? '');
    setCoverageLimit(String(p.coverageLimit));
    setDeductible(String(p.deductible));
    setPremiumAmount(String(p.premiumAmount));
    setPremiumCadence(p.premiumCadence);
    setRenewalDate(p.renewalDate);
    setReminderLeadDays(String(p.reminderLeadDays ?? 30));
    setBeneficiary(p.beneficiaryOrInsured ?? '');
    setAgentOrContact(p.agentOrContact ?? '');
    setNotes(p.notes ?? '');
    setPolicyErrors({});
    setPolicyModalOpen(true);
  };

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {};
    const numCov = parseFloat(coverageLimit);
    const numDed = deductible.trim() ? parseFloat(deductible) : 0;
    const numPrem = parseFloat(premiumAmount);
    const numLead = parseInt(reminderLeadDays, 10);

    if (!policyName.trim()) {
      errors.policyName = 'Policy name is required.';
    }
    if (!provider.trim()) {
      errors.provider = 'Carrier or provider name is required.';
    }
    if (!Number.isFinite(numCov) || numCov < 0) {
      errors.coverageLimit = 'Coverage limit must be 0 or greater.';
    }
    if (deductible.trim() && (!Number.isFinite(numDed) || numDed < 0)) {
      errors.deductible = 'Deductible must be 0 or greater.';
    }
    if (!Number.isFinite(numPrem) || numPrem < 0) {
      errors.premiumAmount = 'Premium amount must be 0 or greater.';
    }
    if (!isValidISODate(renewalDate)) {
      errors.renewalDate = 'Enter a valid renewal date (YYYY-MM-DD).';
    }
    if (effectiveDate.trim() && !isValidISODate(effectiveDate)) {
      errors.effectiveDate = 'Enter a valid effective date (YYYY-MM-DD).';
    }
    if (!Number.isFinite(numLead) || numLead < 1 || numLead > 365) {
      errors.reminderLeadDays = 'Reminder lead days must be between 1 and 365.';
    }

    if (Object.keys(errors).length > 0) {
      setPolicyErrors(errors);
      return;
    }

    const payload: Omit<InsurancePolicy, 'id'> = {
      policyName: policyName.trim(),
      provider: provider.trim(),
      category,
      status,
      policyReference: policyReference.trim() || undefined,
      effectiveDate: effectiveDate.trim() || undefined,
      coverageLimit: Math.round(numCov * 100) / 100,
      deductible: Math.max(0, Math.round(numDed * 100) / 100),
      premiumAmount: Math.round(numPrem * 100) / 100,
      premiumCadence,
      renewalDate,
      reminderLeadDays: numLead,
      beneficiaryOrInsured: beneficiary.trim() || undefined,
      agentOrContact: agentOrContact.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (editingPolicy) {
      updatePolicy(editingPolicy.id, payload);
      setActionMessage(`Updated manual policy "${payload.policyName}".`);
    } else {
      addPolicy(payload);
      setActionMessage(`Added manual policy "${payload.policyName}".`);
    }
    setPolicyModalOpen(false);
  };

  const filteredPolicies = useMemo(() => {
    return [...workspace.policies]
      .filter((p) => {
        if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
        if (statusFilter !== 'all' && (p.status ?? 'Active') !== statusFilter)
          return false;
        return true;
      })
      .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
  }, [workspace.policies, categoryFilter, statusFilter]);

  const handleExportPoliciesCSV = async () => {
    setExportError(null);
    if (workspace.policies.length === 0) {
      setExportError('No manual policies available to export.');
      return;
    }
    setIsExporting(true);
    try {
      const authRes = await requestAuthorizedReportExport('secure_csv');
      if (!authRes.ok) {
        setExportError(
          authRes.error || 'CSV export requires Elevate Pro (₹199/month).'
        );
        return;
      }
      downloadCSV(
        `elevate-secure-policies-${getTodayISO()}.csv`,
        [
          'Policy Name',
          'Provider',
          'Category',
          'Status',
          'Reference',
          'Effective Date',
          'Manual Coverage Limit',
          'Manual Deductible',
          'Premium',
          'Cadence',
          'Annualized Premium',
          'Renewal Date',
          'Reminder Lead Days',
          'Beneficiary / Insured',
          'Agent / Contact',
          'Notes',
        ],
        workspace.policies.map((p) => [
          p.policyName,
          p.provider,
          p.category,
          p.status ?? 'Active',
          p.policyReference ?? '',
          p.effectiveDate ?? '',
          p.coverageLimit,
          p.deductible,
          p.premiumAmount,
          p.premiumCadence,
          annualizePremium(p.premiumAmount, p.premiumCadence),
          p.renewalDate,
          p.reminderLeadDays ?? 30,
          p.beneficiaryOrInsured ?? '',
          p.agentOrContact ?? '',
          p.notes ?? '',
        ])
      );
      setActionMessage(`Exported ${workspace.policies.length} policy record(s) to CSV.`);
    } finally {
      setIsExporting(false);
    }
  };

  if (isHydrating) {
    return <FlowLoadingSkeleton />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {storageError && (
        <ErrorBanner message={storageError} onDismiss={clearStorageError} />
      )}
      {exportError && (
        <div className="space-y-2">
          <ErrorBanner message={exportError} onDismiss={() => setExportError(null)} />
          {!entitlements.downloadableReports && (
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigate('plans')}
              >
                Compare Plans · Elevate Pro
              </Button>
            </div>
          )}
        </div>
      )}
      {actionMessage && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#1E8A78]/10 border border-[#1E8A78]/25 text-xs sm:text-sm text-[#142A3B]">
          <span className="font-medium">{actionMessage}</span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-xs font-semibold text-[#1E8A78] hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#1E8A78]">
            Elevate Secure · Manual Insurance Organiser
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
            Policy register, reminders & protection checklist
          </h1>
          <p className="mt-1.5 text-sm text-[#425466]">
            Keep policy metadata, deductibles, premiums, and renewal reminders organized from your own documents.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            disabled={isExporting}
            onClick={handleExportPoliciesCSV}
          >
            <Download className="w-4 h-4" />
            <span>
              {isExporting
                ? 'Verifying...'
                : entitlements.downloadableReports
                  ? 'Export CSV'
                  : 'Export CSV (Pro)'}
            </span>
          </Button>
          <Button variant="secondary" onClick={() => openNewPolicy()}>
            <Plus className="w-4 h-4" />
            <span>Add Policy</span>
          </Button>
        </div>
      </div>

      {/* Explicit Manual Data Disclosure */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white border border-[#142A3B]/12 text-xs text-[#425466]">
        <Info className="w-4 h-4 text-[#142A3B] mt-0.5 shrink-0" />
        <p className="leading-relaxed">
          <strong className="text-[#142A3B]">Manual records only:</strong> Policy coverage limits, deductibles, premiums, and renewal dates reflect only what you manually transcribe from your policy declarations. Elevate never fabricates coverage sufficiency, quotes, or carrier verification.
        </p>
      </div>

      {/* KPI Strip */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[#142A3B]/10">
          <div className="sm:pr-4">
            <StatMetric
              label="Manual Policies Logged"
              value={String(activePolicies.length)}
              detail={`${workspace.policies.length - activePolicies.length} archived`}
            />
          </div>
          <div className="pt-5 sm:pt-0 sm:px-4">
            <StatMetric
              label="Entered Coverage Sum"
              value={
                activePolicies.length > 0
                  ? formatCurrency(totalCoverageLimit, currency)
                  : '—'
              }
              detail="Sum of user-entered limits"
            />
          </div>
          <div className="pt-5 lg:pt-0 lg:px-4">
            <StatMetric
              label="Monthly Equivalent Cost"
              value={
                activePolicies.length > 0
                  ? formatCurrency(monthlyInsuranceEquiv, currency)
                  : '—'
              }
              tone="gold"
              detail={
                activePolicies.length > 0
                  ? `${formatCurrency(annualInsurancePremiums, currency)} annualized`
                  : 'No active premiums logged'
              }
            />
          </div>
          <div className="pt-5 lg:pt-0 lg:pl-4">
            <StatMetric
              label="Active Renewal Reminders"
              value={String(activePolicyReminders.length)}
              tone={activePolicyReminders.length > 0 ? 'gold' : 'teal'}
              detail={
                activePolicyReminders.length > 0
                  ? `Next: ${activePolicyReminders[0].policyName}`
                  : 'No policies in reminder window'
              }
            />
          </div>
        </div>
      </Card>

      {/* Renewal Reminders + Premium Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <CardHeader
            title="Renewal Reminders Queue"
            subtitle="Policies entering their user-configured reminder lead window"
          />
          {activePolicyReminders.length > 0 ? (
            <ul className="divide-y divide-[#142A3B]/8">
              {activePolicyReminders.map((pol) => (
                <li
                  key={pol.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[#946C1B] font-semibold">
                      <BellRing className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {pol.daysRemaining <= 0
                          ? 'Renewal date reached or past'
                          : `Due in ${pol.daysRemaining} day(s)`}
                      </span>
                      <span className="text-[#627384] font-normal">
                        · {pol.reminderLeadDays}d lead reminder
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#142A3B] mt-0.5 truncate">
                      {pol.policyName}
                    </p>
                    <p className="text-xs text-[#425466]">
                      {pol.provider} · Renews {formatDateShort(pol.renewalDate)} ·{' '}
                      <span className="font-mono tabular-nums">
                        {formatCurrency(pol.premiumAmount, currency)} /{' '}
                        {pol.premiumCadence}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        renewPolicyOneYear(pol.id);
                        setActionMessage(
                          `Advanced "${pol.policyName}" renewal date by 1 year.`
                        );
                      }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Mark Renewed (+1 Yr)</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<BellRing className="w-5 h-5" />}
              title={
                activePolicies.length === 0
                  ? 'No renewal reminders active'
                  : 'No policies within reminder window'
              }
              description={
                activePolicies.length === 0
                  ? 'Add policies with renewal dates and lead-time reminders to see upcoming alerts here.'
                  : 'All active policies are outside their configured renewal reminder windows.'
              }
              actionLabel={activePolicies.length === 0 ? 'Add Policy' : undefined}
              onAction={activePolicies.length === 0 ? () => openNewPolicy() : undefined}
            />
          )}
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader
            title="Premium Billing Cadence"
            subtitle="Active manual premiums grouped by payment frequency"
          />
          {activePolicies.length > 0 ? (
            <div className="space-y-4">
              {(['Monthly', 'Quarterly', 'Annual'] as PremiumCadence[]).map(
                (cadence) => (
                  <div
                    key={cadence}
                    className="flex items-center justify-between gap-3 py-2.5 border-b border-[#142A3B]/8 last:border-0 text-sm"
                  >
                    <span className="text-[#425466]">{cadence} Billing</span>
                    <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                      {formatCurrency(premiumCadenceTotals[cadence], currency)}
                    </span>
                  </div>
                )
              )}
              <div className="p-3.5 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10 flex items-center justify-between text-sm">
                <span className="font-semibold text-[#142A3B]">
                  Annualized Total (Manual)
                </span>
                <span className="font-mono tabular-nums font-semibold text-[#946C1B]">
                  {formatCurrency(annualInsurancePremiums, currency)} / yr
                </span>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<CalendarClock className="w-5 h-5" />}
              title="No active premiums logged"
              description="Premium billing schedules calculate automatically once policies are entered."
            />
          )}
        </Card>
      </div>

      {/* Pro: Cross-Category Coverage & Deductible Summary */}
      {entitlements.coverageSummaries ? (
        <Card>
          <CardHeader
            title="Coverage & Deductible Summary"
            subtitle="Aggregated strictly from your manually entered active policies and Flow cash balances"
          />
          {coverageSummary.rows.length > 0 ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[#627384]">
                    Highest Active Policy Deductible:{' '}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                    {formatCurrency(coverageSummary.highestDeductible, currency)}
                  </span>
                </div>
                <div className="font-medium">
                  {coverageSummary.cashCoversHighestDeductible === null ? (
                    <span className="text-[#627384]">
                      Log cash accounts in Flow to compare against your highest deductible.
                    </span>
                  ) : coverageSummary.cashCoversHighestDeductible ? (
                    <span className="text-[#1E8A78]">
                      Flow cash assets ({formatCurrency(totalCashAssets, currency)}) cover your highest logged deductible.
                    </span>
                  ) : (
                    <span className="text-[#946C1B]">
                      Flow cash assets ({formatCurrency(totalCashAssets, currency)}) are below your highest logged deductible.
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
                <table className="w-full text-left border-collapse min-w-[560px]">
                  <thead>
                    <tr className="border-b border-[#142A3B]/10 text-xs font-medium text-[#627384]">
                      <th className="py-2 pr-4">Coverage Category</th>
                      <th className="py-2 pr-4 text-right">Policies</th>
                      <th className="py-2 pr-4 text-right">Entered Coverage Sum</th>
                      <th className="py-2 pr-4 text-right">Max Deductible</th>
                      <th className="py-2 text-right">Annualized Cost (Share)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#142A3B]/8 text-sm">
                    {coverageSummary.rows.map((row) => (
                      <tr key={row.category}>
                        <td className="py-2.5 pr-4 font-medium text-[#142A3B]">
                          {row.category}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#425466]">
                          {row.count}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#142A3B]">
                          {formatCurrency(row.coverageLimit, currency)}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#425466]">
                          {formatCurrency(row.maxDeductible, currency)}
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-[#946C1B]">
                          {formatCurrency(row.annualPremium, currency)} (
                          {row.premiumSharePct.toFixed(0)}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<ShieldCheck className="w-5 h-5" />}
              title="No active policies to summarize"
              description="Add your active insurance policies above to view category-level coverage limits, premium shares, and deductible readiness."
              actionLabel="Add Policy"
              onAction={() => openNewPolicy()}
            />
          )}
        </Card>
      ) : (
        <ProFeatureGate
          title="Cross-Category Coverage & Deductible Summaries"
          description="View category-level coverage totals, annualized premium shares, and highest-deductible cash reserve comparisons on Elevate Pro (₹199/month)."
          onComparePlans={() => onNavigate('plans')}
        />
      )}

      {/* Protection Checklist (Coverage Categories + Readiness Tasks) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <CardHeader
            title="Coverage Category Checklist"
            subtitle="Core insurance types with user-logged records"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {INSURANCE_CATEGORIES.map((cat) => {
              const matching = activePolicies.filter((p) => p.category === cat);
              const documented = matching.length > 0;
              return (
                <div
                  key={cat}
                  className="p-4 rounded-xl border border-[#142A3B]/10 bg-[#F7F9FA]/70 flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {documented ? (
                      <CheckCircle2 className="w-4 h-4 text-[#1E8A78] mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-[#142A3B]/25 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#142A3B] truncate">
                        {cat}
                      </p>
                      <p className="text-xs text-[#627384]">
                        {documented
                          ? `${matching.length} manual record(s)`
                          : 'Not yet logged'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openNewPolicy(cat)}
                    className="min-h-[36px] px-2.5 py-1 text-xs font-semibold text-[#1E8A78] hover:text-[#142A3B] cursor-pointer shrink-0"
                  >
                    + Add
                  </button>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader
            title="Protection Review Checklist"
            subtitle="Track manual administrative verification steps"
          />
          <ul className="divide-y divide-[#142A3B]/8">
            {PROTECTION_REVIEW_TASKS.map((task) => {
              const checked = workspace.secureChecklistIds.includes(task.id);
              return (
                <li key={task.id} className="py-2.5 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => toggleSecureChecklist(task.id)}
                    className="w-full text-left flex items-start gap-3 py-1 px-2 -mx-2 rounded-lg hover:bg-[#F7F9FA] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78]"
                  >
                    {checked ? (
                      <CheckCircle2 className="w-4 h-4 text-[#1E8A78] mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-[#142A3B]/25 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          checked
                            ? 'text-[#627384] line-through'
                            : 'text-[#142A3B]'
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="text-xs text-[#627384] mt-0.5 leading-relaxed">
                        {task.detail}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Policy Vault */}
      <Card>
        <CardHeader
          title="Manual Policy Vault"
          subtitle="Full policy metadata, limits, deductibles, and contacts"
        />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
          <SegmentedControl
            ariaLabel="Filter policies by category"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: 'all', label: 'All Categories' },
              ...INSURANCE_CATEGORIES.map((c) => ({ value: c, label: c })),
            ]}
          />

          <SegmentedControl
            ariaLabel="Filter policies by status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'Active', label: 'Active' },
              { value: 'Pending Renewal', label: 'Pending Renewal' },
              { value: 'Archived', label: 'Archived' },
            ]}
          />
        </div>

        {filteredPolicies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPolicies.map((pol) => {
              const days = daysUntil(pol.renewalDate);
              const lead = pol.reminderLeadDays || 30;
              const renewingSoon =
                (pol.status ?? 'Active') !== 'Archived' &&
                days !== null &&
                days <= lead;
              const annual = annualizePremium(
                pol.premiumAmount,
                pol.premiumCadence
              );

              return (
                <div
                  key={pol.id}
                  className="p-5 rounded-xl border border-[#142A3B]/10 bg-white flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-[#627384]">
                          {pol.category} · {pol.status ?? 'Active'} · Manual record
                        </p>
                        <h3 className="text-base font-semibold text-[#142A3B] mt-0.5 truncate">
                          {pol.policyName}
                        </h3>
                        <p className="text-xs text-[#425466]">
                          {pol.provider}
                          {pol.policyReference ? ` · Policy #${pol.policyReference}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditPolicy(pol)}
                          aria-label={`Edit ${pol.policyName}`}
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#425466] hover:text-[#142A3B] hover:bg-[#F7F9FA] cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePolicy(pol.id)}
                          aria-label={`Delete ${pol.policyName}`}
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#627384] hover:text-[#B42318] hover:bg-[#B42318]/8 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#142A3B]/8 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[#627384] block">
                          Manual Coverage Limit
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                          {formatCurrency(pol.coverageLimit, currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#627384] block">
                          Manual Deductible
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                          {formatCurrency(pol.deductible, currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#627384] block">Premium</span>
                        <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                          {formatCurrency(pol.premiumAmount, currency)} /{' '}
                          {pol.premiumCadence}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#627384] block">Annualized</span>
                        <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                          {formatCurrency(annual, currency)} / yr
                        </span>
                      </div>
                    </div>

                    {(pol.effectiveDate || pol.agentOrContact || pol.notes) && (
                      <div className="mt-3 pt-2.5 border-t border-[#142A3B]/6 text-xs text-[#425466] space-y-1">
                        {pol.effectiveDate && (
                          <p>Effective: {formatDateShort(pol.effectiveDate)}</p>
                        )}
                        {pol.agentOrContact && (
                          <p>Contact: {pol.agentOrContact}</p>
                        )}
                        {pol.notes && (
                          <p className="text-[#627384]">{pol.notes}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#142A3B]/8 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#425466]">
                      {pol.beneficiaryOrInsured
                        ? `Insured / Beneficiary: ${pol.beneficiaryOrInsured}`
                        : 'Personal Manual Record'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        renewingSoon
                          ? 'text-[#946C1B] font-semibold'
                          : 'text-[#425466]'
                      }`}
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>
                        Renews {formatDateShort(pol.renewalDate)}
                        {renewingSoon && days !== null
                          ? days <= 0
                            ? ' (Due)'
                            : ` (${days}d)`
                          : ''}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<ShieldCheck className="w-5 h-5" />}
            title="No policies in this view"
            description="Record details from your health, life, disability, auto, or property policy documents."
            actionLabel="Add Policy"
            onAction={() => openNewPolicy()}
          />
        )}
      </Card>

      {/* Policy Modal */}
      <ModalSheet
        open={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        title={editingPolicy ? 'Edit Manual Policy Record' : 'Add Insurance Policy'}
        subtitle="Transcribe metadata from your policy declarations page. All fields are saved privately to your account."
      >
        <form onSubmit={handleSavePolicy} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="pol-name"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Policy Name
              </label>
              <input
                id="pol-name"
                type="text"
                value={policyName}
                aria-invalid={Boolean(policyErrors.policyName)}
                onChange={(e) => {
                  setPolicyName(e.target.value);
                  setPolicyErrors((p) => ({ ...p, policyName: undefined }));
                }}
                placeholder="e.g., Term Life 20-Year"
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  policyErrors.policyName
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {policyErrors.policyName && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {policyErrors.policyName}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="pol-provider"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Insurance Carrier / Provider
              </label>
              <input
                id="pol-provider"
                type="text"
                value={provider}
                aria-invalid={Boolean(policyErrors.provider)}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setPolicyErrors((p) => ({ ...p, provider: undefined }));
                }}
                placeholder="e.g., Carrier Name"
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  policyErrors.provider
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {policyErrors.provider && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {policyErrors.provider}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="pol-cat"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Category
              </label>
              <select
                id="pol-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as InsuranceCategory)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              >
                {INSURANCE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="pol-status"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Status
              </label>
              <select
                id="pol-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as PolicyStatus)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              >
                <option value="Active">Active</option>
                <option value="Pending Renewal">Pending Renewal</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="pol-ref"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Policy # / Ref
              </label>
              <input
                id="pol-ref"
                type="text"
                value={policyReference}
                onChange={(e) => setPolicyReference(e.target.value)}
                placeholder="Optional"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="pol-limit"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Manual Coverage Limit ({currency})
              </label>
              <input
                id="pol-limit"
                type="number"
                min="0"
                step="1"
                value={coverageLimit}
                aria-invalid={Boolean(policyErrors.coverageLimit)}
                onChange={(e) => {
                  setCoverageLimit(e.target.value);
                  setPolicyErrors((p) => ({ ...p, coverageLimit: undefined }));
                }}
                placeholder="500000"
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  policyErrors.coverageLimit
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {policyErrors.coverageLimit && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {policyErrors.coverageLimit}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="pol-ded"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Manual Deductible ({currency})
              </label>
              <input
                id="pol-ded"
                type="number"
                min="0"
                step="1"
                value={deductible}
                aria-invalid={Boolean(policyErrors.deductible)}
                onChange={(e) => {
                  setDeductible(e.target.value);
                  setPolicyErrors((p) => ({ ...p, deductible: undefined }));
                }}
                placeholder="0"
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  policyErrors.deductible
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {policyErrors.deductible && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {policyErrors.deductible}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="pol-prem"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Premium ({currency})
              </label>
              <input
                id="pol-prem"
                type="number"
                min="0"
                step="0.01"
                value={premiumAmount}
                aria-invalid={Boolean(policyErrors.premiumAmount)}
                onChange={(e) => {
                  setPremiumAmount(e.target.value);
                  setPolicyErrors((p) => ({ ...p, premiumAmount: undefined }));
                }}
                placeholder="0.00"
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  policyErrors.premiumAmount
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {policyErrors.premiumAmount && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {policyErrors.premiumAmount}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="pol-cadence"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Billing Cadence
              </label>
              <select
                id="pol-cadence"
                value={premiumCadence}
                onChange={(e) =>
                  setPremiumCadence(e.target.value as PremiumCadence)
                }
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Annual">Annual</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="pol-lead"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Reminder Lead (Days)
              </label>
              <input
                id="pol-lead"
                type="number"
                min="1"
                max="365"
                value={reminderLeadDays}
                aria-invalid={Boolean(policyErrors.reminderLeadDays)}
                onChange={(e) => {
                  setReminderLeadDays(e.target.value);
                  setPolicyErrors((p) => ({
                    ...p,
                    reminderLeadDays: undefined,
                  }));
                }}
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  policyErrors.reminderLeadDays
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {policyErrors.reminderLeadDays && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {policyErrors.reminderLeadDays}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="pol-eff"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Effective Date (Optional)
              </label>
              <input
                id="pol-eff"
                type="date"
                value={effectiveDate}
                aria-invalid={Boolean(policyErrors.effectiveDate)}
                onChange={(e) => {
                  setEffectiveDate(e.target.value);
                  setPolicyErrors((p) => ({ ...p, effectiveDate: undefined }));
                }}
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  policyErrors.effectiveDate
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {policyErrors.effectiveDate && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {policyErrors.effectiveDate}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="pol-renew"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Renewal Date
              </label>
              <input
                id="pol-renew"
                type="date"
                value={renewalDate}
                aria-invalid={Boolean(policyErrors.renewalDate)}
                onChange={(e) => {
                  setRenewalDate(e.target.value);
                  setPolicyErrors((p) => ({ ...p, renewalDate: undefined }));
                }}
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  policyErrors.renewalDate
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {policyErrors.renewalDate && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {policyErrors.renewalDate}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="pol-ben"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Insured / Beneficiary
              </label>
              <input
                id="pol-ben"
                type="text"
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
                placeholder="e.g., Household"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
            <div>
              <label
                htmlFor="pol-agent"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Agent / Claims Contact
              </label>
              <input
                id="pol-agent"
                type="text"
                value={agentOrContact}
                onChange={(e) => setAgentOrContact(e.target.value)}
                placeholder="Optional phone or portal note"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="pol-notes"
              className="block text-xs font-semibold text-[#142A3B] mb-1.5"
            >
              Notes (Optional)
            </label>
            <input
              id="pol-notes"
              type="text"
              maxLength={140}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Document location or coverage notes"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setPolicyModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary">
              {editingPolicy ? 'Save Policy' : 'Add Policy'}
            </Button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
}
