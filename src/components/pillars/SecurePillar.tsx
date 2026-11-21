import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Edit3,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  InsuranceCategory,
  InsurancePolicy,
  PremiumCadence,
} from '../../types/finance';
import { useElevate } from '../../context/ElevateContext';
import {
  annualizePremium,
  daysUntil,
  formatCurrency,
  formatDateShort,
  getTodayISO,
} from '../../utils/format';
import { Card, CardHeader } from '../ui/Card';
import { StatMetric } from '../ui/StatMetric';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ModalSheet } from '../ui/ModalSheet';

const INSURANCE_CATEGORIES: InsuranceCategory[] = [
  'Health',
  'Life',
  'Disability',
  'Auto',
  'Home & Renters',
  'Umbrella / Other',
];

export function SecurePillar() {
  const {
    workspace,
    annualInsurancePremiums,
    monthlyInsuranceEquiv,
    upcomingRenewals,
    addPolicy,
    updatePolicy,
    deletePolicy,
  } = useElevate();

  const currency = workspace.currency;

  const [categoryFilter, setCategoryFilter] = useState<'all' | InsuranceCategory>(
    'all'
  );
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(
    null
  );

  // Form state
  const [policyName, setPolicyName] = useState('');
  const [provider, setProvider] = useState('');
  const [category, setCategory] = useState<InsuranceCategory>('Health');
  const [policyReference, setPolicyReference] = useState('');
  const [coverageLimit, setCoverageLimit] = useState('');
  const [deductible, setDeductible] = useState('');
  const [premiumAmount, setPremiumAmount] = useState('');
  const [premiumCadence, setPremiumCadence] = useState<PremiumCadence>('Monthly');
  const [renewalDate, setRenewalDate] = useState(getTodayISO());
  const [beneficiary, setBeneficiary] = useState('');

  const totalCoverageLimit = useMemo(
    () => workspace.policies.reduce((s, p) => s + (Number(p.coverageLimit) || 0), 0),
    [workspace.policies]
  );

  const openNewPolicy = (defaultCat?: InsuranceCategory) => {
    setEditingPolicy(null);
    setPolicyName('');
    setProvider('');
    setCategory(defaultCat ?? 'Health');
    setPolicyReference('');
    setCoverageLimit('');
    setDeductible('0');
    setPremiumAmount('');
    setPremiumCadence('Monthly');
    setRenewalDate(getTodayISO());
    setBeneficiary('');
    setPolicyModalOpen(true);
  };

  const openEditPolicy = (p: InsurancePolicy) => {
    setEditingPolicy(p);
    setPolicyName(p.policyName);
    setProvider(p.provider);
    setCategory(p.category);
    setPolicyReference(p.policyReference ?? '');
    setCoverageLimit(String(p.coverageLimit));
    setDeductible(String(p.deductible));
    setPremiumAmount(String(p.premiumAmount));
    setPremiumCadence(p.premiumCadence);
    setRenewalDate(p.renewalDate);
    setBeneficiary(p.beneficiaryOrInsured ?? '');
    setPolicyModalOpen(true);
  };

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    const numCov = parseFloat(coverageLimit) || 0;
    const numDed = parseFloat(deductible) || 0;
    const numPrem = parseFloat(premiumAmount) || 0;
    if (!policyName.trim() || !provider.trim()) return;

    const payload: Omit<InsurancePolicy, 'id'> = {
      policyName: policyName.trim(),
      provider: provider.trim(),
      category,
      policyReference: policyReference.trim() || undefined,
      coverageLimit: Math.max(0, numCov),
      deductible: Math.max(0, numDed),
      premiumAmount: Math.max(0, numPrem),
      premiumCadence,
      renewalDate,
      beneficiaryOrInsured: beneficiary.trim() || undefined,
    };

    if (editingPolicy) {
      updatePolicy(editingPolicy.id, payload);
    } else {
      addPolicy(payload);
    }
    setPolicyModalOpen(false);
  };

  const filteredPolicies = useMemo(() => {
    return [...workspace.policies]
      .filter((p) => categoryFilter === 'all' || p.category === categoryFilter)
      .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
  }, [workspace.policies, categoryFilter]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#1E8A78]">
            Elevate Secure · Insurance Organiser
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
            Policy register & coverage overview
          </h1>
          <p className="mt-1.5 text-sm text-[#425466]">
            Store your real policy details, coverage limits, deductibles, and renewal dates — never fabricated quotes or claims.
          </p>
        </div>

        <Button variant="secondary" onClick={() => openNewPolicy()}>
          <Plus className="w-4 h-4" />
          <span>Add Policy</span>
        </Button>
      </div>

      {/* KPI Strip */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[#142A3B]/10">
          <div className="sm:pr-4">
            <StatMetric
              label="Documented Policies"
              value={String(workspace.policies.length)}
              detail="User-logged protection records"
            />
          </div>
          <div className="pt-5 sm:pt-0 sm:px-4">
            <StatMetric
              label="Total Face Coverage"
              value={formatCurrency(totalCoverageLimit, currency)}
              detail="Sum of logged policy limits"
            />
          </div>
          <div className="pt-5 lg:pt-0 lg:px-4">
            <StatMetric
              label="Monthly Equivalent Cost"
              value={formatCurrency(monthlyInsuranceEquiv, currency)}
              tone="gold"
              detail={`${formatCurrency(annualInsurancePremiums, currency)} annualized`}
            />
          </div>
          <div className="pt-5 lg:pt-0 lg:pl-4">
            <StatMetric
              label="Renewals Within 60 Days"
              value={String(upcomingRenewals.length)}
              tone={upcomingRenewals.length > 0 ? 'gold' : 'teal'}
              detail={
                upcomingRenewals.length > 0
                  ? `Next: ${upcomingRenewals[0].policyName}`
                  : 'No immediate renewals due'
              }
            />
          </div>
        </div>
      </Card>

      {/* Coverage Category Matrix */}
      <Card>
        <CardHeader
          title="Protection Coverage Checklist"
          subtitle="Track which core insurance areas have active documented policies"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {INSURANCE_CATEGORIES.map((cat) => {
            const matching = workspace.policies.filter((p) => p.category === cat);
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
                        ? `${matching.length} polic${matching.length === 1 ? 'y' : 'ies'} logged`
                        : 'Not yet logged'}
                    </p>
                  </div>
                </div>

                {!documented && (
                  <button
                    type="button"
                    onClick={() => openNewPolicy(cat)}
                    className="min-h-[36px] px-2.5 py-1 text-xs font-semibold text-[#1E8A78] hover:text-[#142A3B] cursor-pointer shrink-0"
                  >
                    + Add
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Policy Register */}
      <Card>
        <CardHeader
          title="Policy Vault"
          subtitle="Filter by insurance type or review upcoming renewal dates"
        />

        <div className="mb-5">
          <SegmentedControl
            ariaLabel="Filter policies by category"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: 'all', label: 'All Policies' },
              ...INSURANCE_CATEGORIES.map((c) => ({ value: c, label: c })),
            ]}
          />
        </div>

        {filteredPolicies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPolicies.map((pol) => {
              const days = daysUntil(pol.renewalDate);
              const renewingSoon = days !== null && days <= 60;
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
                          {pol.category}
                          {pol.policyReference ? ` · Ref ${pol.policyReference}` : ''}
                        </p>
                        <h3 className="text-base font-semibold text-[#142A3B] mt-0.5 truncate">
                          {pol.policyName}
                        </h3>
                        <p className="text-xs text-[#425466]">{pol.provider}</p>
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
                        <span className="text-[#627384] block">Coverage Limit</span>
                        <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                          {formatCurrency(pol.coverageLimit, currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#627384] block">Deductible</span>
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
                  </div>

                  <div className="pt-3 border-t border-[#142A3B]/8 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#425466]">
                      {pol.beneficiaryOrInsured
                        ? `Insured / Beneficiary: ${pol.beneficiaryOrInsured}`
                        : 'Personal Policy Record'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        renewingSoon ? 'text-[#946C1B] font-semibold' : 'text-[#425466]'
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
            description="Add your health, life, disability, auto, or property policies to keep coverage terms and renewals organized."
            actionLabel="Add Policy"
            onAction={() => openNewPolicy()}
          />
        )}
      </Card>

      {/* Policy Modal */}
      <ModalSheet
        open={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        title={editingPolicy ? 'Edit Policy Record' : 'Add Insurance Policy'}
        subtitle="Record details from your official policy declarations page."
      >
        <form onSubmit={handleSavePolicy} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Policy Name
              </label>
              <input
                type="text"
                required
                value={policyName}
                onChange={(e) => setPolicyName(e.target.value)}
                placeholder="e.g., Term Life 20-Year"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Insurance Carrier / Provider
              </label>
              <input
                type="text"
                required
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g., Carrier Name"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as InsuranceCategory)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              >
                {INSURANCE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Policy Number / Reference
              </label>
              <input
                type="text"
                value={policyReference}
                onChange={(e) => setPolicyReference(e.target.value)}
                placeholder="Optional reference"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Coverage Limit ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={coverageLimit}
                onChange={(e) => setCoverageLimit(e.target.value)}
                placeholder="500000"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Deductible ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={deductible}
                onChange={(e) => setDeductible(e.target.value)}
                placeholder="0"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Premium ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={premiumAmount}
                onChange={(e) => setPremiumAmount(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Billing Cadence
              </label>
              <select
                value={premiumCadence}
                onChange={(e) => setPremiumCadence(e.target.value as PremiumCadence)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Annual">Annual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Renewal Date
              </label>
              <input
                type="date"
                required
                value={renewalDate}
                onChange={(e) => setRenewalDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
              Insured / Beneficiary (Optional)
            </label>
            <input
              type="text"
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
              placeholder="e.g., Household or Named Beneficiary"
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
