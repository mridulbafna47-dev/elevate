import React, { useMemo, useState } from 'react';
import {
  Camera,
  Download,
  Edit3,
  Info,
  Plus,
  SlidersHorizontal,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  AssetClass,
  InvestmentGoal,
  InvestmentHolding,
  NavViewId,
  TargetAllocations,
} from '../../types/finance';
import { useElevate } from '../../context/ElevateContext';
import {
  downloadCSV,
  formatCurrency,
  formatDateShort,
  formatPercent,
  getTodayISO,
  isValidISODate,
} from '../../utils/format';
import { Card, CardHeader } from '../ui/Card';
import { StatMetric } from '../ui/StatMetric';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ModalSheet } from '../ui/ModalSheet';
import { ErrorBanner, FlowLoadingSkeleton } from '../ui/FeedbackStates';
import { ProFeatureGate } from '../ui/ProFeatureGate';
import { GoalProgressRing } from '../charts/GoalProgressRing';
import {
  AllocationDonutChart,
  ELEVATE_CHART_PALETTE,
} from '../charts/AllocationDonutChart';
import { NetWorthTimelineChart } from '../charts/NetWorthTimelineChart';

const ASSET_CLASSES: AssetClass[] = [
  'Equities & Index Funds',
  'Fixed Income & Bonds',
  'Cash & Treasury',
  'Real Estate',
  'Alternative / Other',
];

interface FieldErrors {
  [key: string]: string | undefined;
}

interface WealthPillarProps {
  onNavigate: (view: NavViewId) => void;
}

export function WealthPillar({ onNavigate }: WealthPillarProps) {
  const {
    isHydrating,
    storageError,
    clearStorageError,
    workspace,
    totalPortfolioValue,
    totalPortfolioCost,
    portfolioUnrealizedGain,
    portfolioReturnPct,
    totalTrackedNetWorth,
    entitlements,
    totalGoalsCount,
    canAddMoreGoals,
    requestAuthorizedReportExport,
    addHolding,
    updateHolding,
    deleteHolding,
    addInvestmentGoal,
    updateInvestmentGoal,
    deleteInvestmentGoal,
    setTargetAllocations,
    recordSnapshot,
    deleteSnapshot,
  } = useElevate();

  const currency = workspace.currency;

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [goalLimitNotice, setGoalLimitNotice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Holding Modal
  const [holdingModalOpen, setHoldingModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<InvestmentHolding | null>(
    null
  );
  const [holdingErrors, setHoldingErrors] = useState<FieldErrors>({});

  // Goal Modal
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<InvestmentGoal | null>(null);
  const [goalErrors, setGoalErrors] = useState<FieldErrors>({});

  // Target Allocation Modal
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [targetInputs, setTargetInputs] = useState<Record<AssetClass, string>>({
    'Equities & Index Funds': '',
    'Fixed Income & Bonds': '',
    'Cash & Treasury': '',
    'Real Estate': '',
    'Alternative / Other': '',
  });
  const [targetErrors, setTargetErrors] = useState<string | null>(null);

  const [snapshotNote, setSnapshotNote] = useState('');

  // Holding form fields
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass>(
    'Equities & Index Funds'
  );
  const [accountLabel, setAccountLabel] = useState('');
  const [units, setUnits] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [valuedAt, setValuedAt] = useState(getTodayISO());
  const [holdingNotes, setHoldingNotes] = useState('');

  // Investment Goal form fields
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTargetAmount, setGoalTargetAmount] = useState('');
  const [goalScope, setGoalScope] = useState<'All Holdings' | AssetClass | 'Manual'>(
    'All Holdings'
  );
  const [goalManualValue, setGoalManualValue] = useState('');
  const [goalMonthlyContrib, setGoalMonthlyContrib] = useState('');
  const [goalTargetDate, setGoalTargetDate] = useState('');

  const openNewHolding = () => {
    setEditingHolding(null);
    setName('');
    setSymbol('');
    setAssetClass('Equities & Index Funds');
    setAccountLabel('');
    setUnits('');
    setCostBasis('');
    setCurrentValue('');
    setValuedAt(getTodayISO());
    setHoldingNotes('');
    setHoldingErrors({});
    setHoldingModalOpen(true);
  };

  const openEditHolding = (h: InvestmentHolding) => {
    setEditingHolding(h);
    setName(h.name);
    setSymbol(h.symbol ?? '');
    setAssetClass(h.assetClass);
    setAccountLabel(h.accountLabel);
    setUnits(String(h.units));
    setCostBasis(String(h.costBasis));
    setCurrentValue(String(h.currentValue));
    setValuedAt(h.valuedAt || getTodayISO());
    setHoldingNotes(h.notes ?? '');
    setHoldingErrors({});
    setHoldingModalOpen(true);
  };

  const handleSaveHolding = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {};
    const numCost = parseFloat(costBasis);
    const numVal = parseFloat(currentValue);
    const numUnits = units.trim() ? parseFloat(units) : 0;

    if (!name.trim()) {
      errors.name = 'Holding name is required.';
    } else if (name.trim().length > 80) {
      errors.name = 'Holding name must be 80 characters or fewer.';
    }
    if (!Number.isFinite(numCost) || numCost < 0) {
      errors.costBasis = 'Cost basis must be 0 or greater.';
    }
    if (!Number.isFinite(numVal) || numVal < 0) {
      errors.currentValue = 'Entered valuation must be 0 or greater.';
    }
    if (units.trim() && (!Number.isFinite(numUnits) || numUnits < 0)) {
      errors.units = 'Units must be 0 or greater.';
    }
    if (!isValidISODate(valuedAt)) {
      errors.valuedAt = 'Enter a valid valuation date (YYYY-MM-DD).';
    }

    if (Object.keys(errors).length > 0) {
      setHoldingErrors(errors);
      return;
    }

    const payload = {
      name: name.trim(),
      symbol: symbol.trim().toUpperCase() || undefined,
      assetClass,
      accountLabel: accountLabel.trim() || 'Manual Investment Account',
      units: Math.max(0, numUnits),
      costBasis: Math.round(numCost * 100) / 100,
      currentValue: Math.round(numVal * 100) / 100,
      valuedAt,
      notes: holdingNotes.trim() || undefined,
    };

    if (editingHolding) {
      updateHolding(editingHolding.id, payload);
      setActionMessage(`Updated manual valuation for "${payload.name}".`);
    } else {
      addHolding(payload);
      setActionMessage(`Added "${payload.name}" (manual entry).`);
    }
    setHoldingModalOpen(false);
  };

  const openNewGoal = () => {
    if (!canAddMoreGoals) {
      setGoalLimitNotice(
        `Elevate Basic includes up to ${entitlements.maxGoals} total goals across Guide and Wealth (${totalGoalsCount} used). Upgrade to Elevate Pro (₹199/month) for unlimited goals.`
      );
      return;
    }
    setGoalLimitNotice(null);
    setEditingGoal(null);
    setGoalTitle('');
    setGoalTargetAmount('');
    setGoalScope('All Holdings');
    setGoalManualValue('0');
    setGoalMonthlyContrib('');
    setGoalTargetDate('');
    setGoalErrors({});
    setGoalModalOpen(true);
  };

  const openEditGoal = (g: InvestmentGoal) => {
    setGoalLimitNotice(null);
    setEditingGoal(g);
    setGoalTitle(g.title);
    setGoalTargetAmount(String(g.targetAmount));
    setGoalScope(g.trackingScope);
    setGoalManualValue(String(g.manualCurrentValue ?? 0));
    setGoalMonthlyContrib(String(g.monthlyContribution));
    setGoalTargetDate(g.targetDate ?? '');
    setGoalErrors({});
    setGoalModalOpen(true);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {};
    const target = parseFloat(goalTargetAmount);
    const monthly = goalMonthlyContrib.trim() ? parseFloat(goalMonthlyContrib) : 0;
    const manualVal = goalManualValue.trim() ? parseFloat(goalManualValue) : 0;

    if (!goalTitle.trim()) {
      errors.title = 'Goal title is required.';
    }
    if (!Number.isFinite(target) || target <= 0) {
      errors.targetAmount = 'Target amount must be greater than 0.';
    }
    if (goalScope === 'Manual' && (!Number.isFinite(manualVal) || manualVal < 0)) {
      errors.manualCurrentValue = 'Current value must be 0 or greater.';
    }
    if (goalMonthlyContrib.trim() && (!Number.isFinite(monthly) || monthly < 0)) {
      errors.monthlyContribution = 'Monthly contribution must be 0 or greater.';
    }
    if (goalTargetDate.trim() && !isValidISODate(goalTargetDate)) {
      errors.targetDate = 'Enter a valid target date (YYYY-MM-DD).';
    }

    if (Object.keys(errors).length > 0) {
      setGoalErrors(errors);
      return;
    }

    if (!editingGoal && !canAddMoreGoals) {
      setGoalLimitNotice(
        `Elevate Basic includes up to ${entitlements.maxGoals} total goals across Guide and Wealth.`
      );
      setGoalModalOpen(false);
      return;
    }

    const payload: Omit<InvestmentGoal, 'id'> = {
      title: goalTitle.trim(),
      targetAmount: Math.round(target * 100) / 100,
      trackingScope: goalScope,
      manualCurrentValue:
        goalScope === 'Manual' ? Math.round(manualVal * 100) / 100 : undefined,
      monthlyContribution: Math.max(0, Math.round(monthly * 100) / 100),
      targetDate: goalTargetDate.trim() || undefined,
    };

    if (editingGoal) {
      updateInvestmentGoal(editingGoal.id, payload);
    } else {
      addInvestmentGoal(payload);
    }
    setGoalModalOpen(false);
  };

  const openTargetModal = () => {
    if (!entitlements.richerPortfolioAnalysis) {
      onNavigate('plans');
      return;
    }
    const next: Record<AssetClass, string> = {
      'Equities & Index Funds': '',
      'Fixed Income & Bonds': '',
      'Cash & Treasury': '',
      'Real Estate': '',
      'Alternative / Other': '',
    };
    for (const ac of ASSET_CLASSES) {
      const val = workspace.targetAllocations[ac];
      next[ac] = typeof val === 'number' && val > 0 ? String(val) : '';
    }
    setTargetInputs(next);
    setTargetErrors(null);
    setTargetModalOpen(true);
  };

  const handleSaveTargets = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed: TargetAllocations = {};
    let sum = 0;
    for (const ac of ASSET_CLASSES) {
      const raw = targetInputs[ac].trim();
      if (!raw) continue;
      const num = parseFloat(raw);
      if (!Number.isFinite(num) || num < 0 || num > 100) {
        setTargetErrors(`Target percentage for ${ac} must be between 0 and 100.`);
        return;
      }
      if (num > 0) {
        parsed[ac] = Math.round(num * 10) / 10;
        sum += parsed[ac] ?? 0;
      }
    }
    if (sum > 0 && Math.abs(sum - 100) > 0.1) {
      setTargetErrors(
        `Configured target weights currently sum to ${sum.toFixed(1)}%. Adjust them to equal 100%, or clear all fields to remove targets.`
      );
      return;
    }
    setTargetAllocations(parsed);
    setTargetModalOpen(false);
    setActionMessage(
      sum > 0 ? 'Updated target asset allocation weights.' : 'Cleared target asset weights.'
    );
  };

  const valueByAssetClass = useMemo(() => {
    const grouped = new Map<AssetClass, number>();
    for (const h of workspace.holdings) {
      grouped.set(h.assetClass, (grouped.get(h.assetClass) ?? 0) + h.currentValue);
    }
    return grouped;
  }, [workspace.holdings]);

  const allocationSlices = useMemo(() => {
    return Array.from(valueByAssetClass.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({
        label,
        value,
        color: ELEVATE_CHART_PALETTE[i % ELEVATE_CHART_PALETTE.length],
      }));
  }, [valueByAssetClass]);

  const hasTargetWeights = useMemo(
    () =>
      Object.values(workspace.targetAllocations).some(
        (v) => typeof v === 'number' && v > 0
      ),
    [workspace.targetAllocations]
  );

  const handleExportHoldingsCSV = async () => {
    setExportError(null);
    if (workspace.holdings.length === 0) {
      setExportError('No manual holdings available to export.');
      return;
    }
    setIsExporting(true);
    try {
      const authRes = await requestAuthorizedReportExport('wealth_csv');
      if (!authRes.ok) {
        setExportError(
          authRes.error || 'CSV export requires Elevate Pro (₹199/month).'
        );
        return;
      }
      downloadCSV(
        `elevate-wealth-holdings-${getTodayISO()}.csv`,
        [
          'Holding',
          'Ticker',
          'Asset Class',
          'Account',
          'Units',
          'Manual Cost Basis',
          'Manual Confirmed Value',
          'Difference vs Cost',
          'Valued At',
          'Notes',
        ],
        workspace.holdings.map((h) => [
          h.name,
          h.symbol ?? '',
          h.assetClass,
          h.accountLabel,
          h.units,
          h.costBasis,
          h.currentValue,
          h.currentValue - h.costBasis,
          h.valuedAt,
          h.notes ?? '',
        ])
      );
      setActionMessage(
        `Exported ${workspace.holdings.length} manual holding(s) to CSV.`
      );
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
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#1E8A78]">
            Elevate Wealth · Manual Investment Tracker
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
            Holdings, allocation & investment goals
          </h1>
          <p className="mt-1.5 text-sm text-[#425466]">
            Manual valuation ledger — every position, allocation weight, and goal progress bar is calculated strictly from your statement entries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button variant="outline" onClick={openTargetModal}>
            <SlidersHorizontal className="w-4 h-4" />
            <span>
              {entitlements.richerPortfolioAnalysis
                ? 'Target Allocation'
                : 'Target Allocation (Pro)'}
            </span>
          </Button>
          <Button variant="outline" onClick={openNewGoal}>
            <Target className="w-4 h-4" />
            <span>Add Goal</span>
          </Button>
          <Button variant="secondary" onClick={openNewHolding}>
            <Plus className="w-4 h-4" />
            <span>Add Holding</span>
          </Button>
        </div>
      </div>

      {/* Explicit Manual Data Disclosure */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white border border-[#142A3B]/12 text-xs text-[#425466]">
        <Info className="w-4 h-4 text-[#142A3B] mt-0.5 shrink-0" />
        <p className="leading-relaxed">
          <strong className="text-[#142A3B]">Manual data only:</strong> Elevate does not fetch live market quotes or invent projected investment returns. Gains and losses show only the difference between your entered cost basis and your latest manually confirmed valuation date.
        </p>
      </div>

      {/* KPI Strip */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[#142A3B]/10">
          <div className="sm:pr-4">
            <StatMetric
              label="Manual Portfolio Value"
              value={
                workspace.holdings.length > 0
                  ? formatCurrency(totalPortfolioValue, currency)
                  : '—'
              }
              detail={`${workspace.holdings.length} manual holding(s)`}
            />
          </div>
          <div className="pt-5 sm:pt-0 sm:px-4">
            <StatMetric
              label="Entered Cost Basis"
              value={
                workspace.holdings.length > 0
                  ? formatCurrency(totalPortfolioCost, currency)
                  : '—'
              }
              detail="User-entered principal"
            />
          </div>
          <div className="pt-5 lg:pt-0 lg:px-4">
            <StatMetric
              label="Difference vs. Cost Basis"
              value={
                workspace.holdings.length > 0
                  ? formatCurrency(portfolioUnrealizedGain, currency)
                  : '—'
              }
              tone={
                workspace.holdings.length === 0
                  ? 'default'
                  : portfolioUnrealizedGain > 0
                    ? 'teal'
                    : portfolioUnrealizedGain < 0
                      ? 'negative'
                      : 'default'
              }
              detail={
                workspace.holdings.length > 0
                  ? `${formatPercent(portfolioReturnPct, true)} from manual entries`
                  : 'No valuations entered'
              }
            />
          </div>
          <div className="pt-5 lg:pt-0 lg:pl-4">
            <StatMetric
              label="Combined Net Worth"
              value={
                workspace.accounts.length > 0 || workspace.holdings.length > 0
                  ? formatCurrency(totalTrackedNetWorth, currency)
                  : '—'
              }
              detail="Manual Flow cash + Wealth holdings"
            />
          </div>
        </div>
      </Card>

      {/* Asset Allocation + Target Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-6">
          <CardHeader
            title="Asset Allocation (User-Entered)"
            subtitle="Distribution of your manually confirmed holdings"
            action={
              entitlements.richerPortfolioAnalysis ? (
                <Button variant="ghost" size="sm" onClick={openTargetModal}>
                  Set Targets
                </Button>
              ) : null
            }
          />
          {allocationSlices.length > 0 ? (
            <div className="space-y-6">
              <AllocationDonutChart
                slices={allocationSlices}
                currency={currency}
                centerLabel="Manual Total"
              />

              {entitlements.richerPortfolioAnalysis ? (
                hasTargetWeights && (
                  <div className="pt-4 border-t border-[#142A3B]/10 space-y-2.5">
                    <p className="text-xs font-semibold text-[#142A3B]">
                      Actual vs. Your Target Allocation
                    </p>
                    {ASSET_CLASSES.map((ac) => {
                      const targetPct = workspace.targetAllocations[ac] ?? 0;
                      const actualVal = valueByAssetClass.get(ac) ?? 0;
                      const actualPct =
                        totalPortfolioValue > 0
                          ? (actualVal / totalPortfolioValue) * 100
                          : 0;
                      if (targetPct === 0 && actualVal === 0) return null;
                      const diffPct = actualPct - targetPct;
                      return (
                        <div
                          key={ac}
                          className="flex items-center justify-between gap-2 text-xs py-1 border-b border-[#142A3B]/6 last:border-0"
                        >
                          <span className="text-[#425466] truncate">{ac}</span>
                          <span className="font-mono tabular-nums text-[#142A3B] shrink-0">
                            {formatPercent(actualPct)} / Target{' '}
                            {formatPercent(targetPct)} ({diffPct >= 0 ? '+' : ''}
                            {diffPct.toFixed(1)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <ProFeatureGate
                  title="Target Allocation Drift Analysis"
                  description="Compare actual asset-class weights against personal targets to spot portfolio drift on Elevate Pro (₹199/month)."
                  onComparePlans={() => onNavigate('plans')}
                />
              )}
            </div>
          ) : (
            <EmptyState
              icon={<TrendingUp className="w-5 h-5" />}
              title="No manual holdings logged"
              description="Add your equity funds, bonds, treasury bills, or real estate entries to see your asset allocation."
              actionLabel="Add First Holding"
              onAction={openNewHolding}
            />
          )}
        </Card>

        {/* Investment Goals & Progress Tracking */}
        <Card className="lg:col-span-6">
          <CardHeader
            title="Investment Goals & Progress"
            subtitle={
              entitlements.maxGoals !== null
                ? `Linked to manual holdings · ${totalGoalsCount} / ${entitlements.maxGoals} total goals used on Basic`
                : 'Linked directly to your manual holdings or custom balance'
            }
            action={
              <Button variant="ghost" size="sm" onClick={openNewGoal}>
                <Plus className="w-4 h-4" />
                <span>Add Goal</span>
              </Button>
            }
          />
          {goalLimitNotice && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#D5A64A]/12 border border-[#D5A64A]/35 flex flex-wrap items-center justify-between gap-3 text-xs text-[#142A3B]">
              <span>{goalLimitNotice}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigate('plans')}
              >
                Compare Plans · Elevate Pro
              </Button>
            </div>
          )}

          {workspace.investmentGoals.length > 0 ? (
            <div className="space-y-4">
              {workspace.investmentGoals.map((g) => {
                const currentVal =
                  g.trackingScope === 'All Holdings'
                    ? totalPortfolioValue
                    : g.trackingScope === 'Manual'
                      ? g.manualCurrentValue ?? 0
                      : valueByAssetClass.get(g.trackingScope) ?? 0;

                const pct =
                  g.targetAmount > 0 ? (currentVal / g.targetAmount) * 100 : 0;
                const remaining = Math.max(0, g.targetAmount - currentVal);
                const monthsLinear =
                  remaining === 0
                    ? 0
                    : g.monthlyContribution > 0
                      ? Math.ceil(remaining / g.monthlyContribution)
                      : null;

                return (
                  <div
                    key={g.id}
                    className="p-4 rounded-xl border border-[#142A3B]/10 bg-[#F7F9FA]/70 flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <GoalProgressRing
                        percent={pct}
                        size={52}
                        strokeWidth={5}
                        color={pct >= 100 ? '#1E8A78' : '#142A3B'}
                      />
                      <div className="min-w-0">
                        <p className="text-xs text-[#627384]">
                          Manual source: {g.trackingScope}
                        </p>
                        <button
                          type="button"
                          onClick={() => openEditGoal(g)}
                          className="text-sm font-semibold text-[#142A3B] hover:text-[#1E8A78] text-left truncate block max-w-full cursor-pointer"
                        >
                          {g.title}
                        </button>
                        <p className="text-xs font-mono tabular-nums text-[#425466] mt-0.5">
                          {formatCurrency(currentVal, currency)} /{' '}
                          {formatCurrency(g.targetAmount, currency)}
                        </p>
                        <p className="text-[11px] text-[#627384] mt-1">
                          {monthsLinear === 0
                            ? 'Target reached'
                            : monthsLinear !== null
                              ? `${monthsLinear} mo via ${formatCurrency(g.monthlyContribution, currency)}/mo contributions (0% assumed return)`
                              : 'Add planned monthly contribution to see linear timeline'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditGoal(g)}
                        aria-label={`Edit ${g.title}`}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#425466] hover:text-[#142A3B] cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteInvestmentGoal(g.id)}
                        aria-label={`Delete ${g.title}`}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#627384] hover:text-[#B42318] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Target className="w-5 h-5" />}
              title="No investment goals set"
              description="Create a target portfolio or asset-class milestone linked to your manual holdings."
              actionLabel="Create Investment Goal"
              onAction={openNewGoal}
            />
          )}
        </Card>
      </div>

      {/* Holdings Register */}
      <Card>
        <CardHeader
          title="Manual Holdings Register"
          subtitle="All rows reflect user-entered statement values — click edit to update any valuation"
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isExporting}
                onClick={handleExportHoldingsCSV}
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {isExporting
                    ? 'Verifying...'
                    : entitlements.downloadableReports
                      ? 'Export CSV'
                      : 'Export CSV (Pro)'}
                </span>
              </Button>
              <Button variant="secondary" size="sm" onClick={openNewHolding}>
                <Plus className="w-3.5 h-3.5" />
                <span>Add Holding</span>
              </Button>
            </div>
          }
        />

        {workspace.holdings.length > 0 ? (
          <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-[#142A3B]/10 text-xs font-medium text-[#627384]">
                  <th className="py-2.5 pr-4">Holding (Manual)</th>
                  <th className="py-2.5 pr-4">Asset Class</th>
                  <th className="py-2.5 pr-4 text-right">Units</th>
                  <th className="py-2.5 pr-4 text-right">Manual Cost Basis</th>
                  <th className="py-2.5 pr-4 text-right">Manual Value</th>
                  <th className="py-2.5 pr-4 text-right">Vs. Cost</th>
                  <th className="py-2.5 pr-4">Confirmed Date</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#142A3B]/8 text-sm">
                {workspace.holdings.map((h) => {
                  const diff = h.currentValue - h.costBasis;
                  const pct = h.costBasis > 0 ? (diff / h.costBasis) * 100 : 0;
                  return (
                    <tr
                      key={h.id}
                      className="hover:bg-[#F7F9FA]/70 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <p className="font-medium text-[#142A3B]">
                          {h.name}
                          {h.symbol ? ` (${h.symbol})` : ''}
                        </p>
                        <p className="text-xs text-[#627384]">
                          {h.accountLabel} · Manual entry
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-xs text-[#425466]">
                        {h.assetClass}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums text-[#425466]">
                        {h.units > 0 ? h.units.toLocaleString('en-US') : '—'}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums text-[#425466]">
                        {formatCurrency(h.costBasis, currency)}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold text-[#142A3B]">
                        {formatCurrency(h.currentValue, currency)}
                      </td>
                      <td
                        className={`py-3 pr-4 text-right font-mono tabular-nums text-xs font-semibold ${
                          diff > 0
                            ? 'text-[#1E8A78]'
                            : diff < 0
                              ? 'text-[#B42318]'
                              : 'text-[#425466]'
                        }`}
                      >
                        {formatCurrency(diff, currency)} ({formatPercent(pct, true)})
                      </td>
                      <td className="py-3 pr-4 text-xs font-mono tabular-nums text-[#627384] whitespace-nowrap">
                        {formatDateShort(h.valuedAt)}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEditHolding(h)}
                          aria-label={`Edit ${h.name}`}
                          className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-[#425466] hover:text-[#142A3B] hover:bg-[#142A3B]/5 cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteHolding(h.id)}
                          aria-label={`Delete ${h.name}`}
                          className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-[#627384] hover:text-[#B42318] hover:bg-[#B42318]/8 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<TrendingUp className="w-5 h-5" />}
            title="Your manual holdings register is empty"
            description="Record investment positions using figures from your brokerage or retirement statements."
            actionLabel="Add Holding"
            onAction={openNewHolding}
          />
        )}
      </Card>

      {/* Net Worth Snapshots (Pro Richer Portfolio Analysis) */}
      {entitlements.richerPortfolioAnalysis ? (
        <Card>
          <CardHeader
            title="Manual Net Worth Snapshots"
            subtitle="Record dated checkpoints combining your manual Flow cash and Wealth holdings"
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              recordSnapshot(snapshotNote);
              setSnapshotNote('');
              setActionMessage('Recorded manual net worth snapshot.');
            }}
            className="flex flex-col sm:flex-row gap-2.5 mb-5"
          >
            <input
              type="text"
              maxLength={80}
              value={snapshotNote}
              onChange={(e) => setSnapshotNote(e.target.value)}
              placeholder="Snapshot note (e.g., Monthly statement check-in)"
              className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
            />
            <Button type="submit" variant="primary" size="md">
              <Camera className="w-4 h-4" />
              <span>Record Snapshot</span>
            </Button>
          </form>

          {workspace.snapshots.length > 0 ? (
            <div className="space-y-4">
              <NetWorthTimelineChart
                snapshots={workspace.snapshots}
                currency={currency}
              />
              <ul className="divide-y divide-[#142A3B]/8 text-xs">
                {[...workspace.snapshots]
                  .reverse()
                  .slice(0, 5)
                  .map((s) => (
                    <li
                      key={s.id}
                      className="py-2 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-[#142A3B]">
                          {formatDateShort(s.date)}
                        </span>
                        <span className="text-[#627384] ml-2">
                          {s.note} · Manual snapshot
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                          {formatCurrency(
                            s.totalCashValue + s.totalInvestedValue,
                            currency
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteSnapshot(s.id)}
                          aria-label={`Delete snapshot from ${s.date}`}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#627384] hover:text-[#B42318] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              icon={<Camera className="w-5 h-5" />}
              title="No snapshots recorded"
              description="Click Record Snapshot whenever you reconcile statements to build an accurate net worth history."
            />
          )}
        </Card>
      ) : (
        <ProFeatureGate
          title="Richer Portfolio Analysis & Net Worth Timeline"
          description="Track dated net worth snapshots across cash and investments alongside asset-class target drift analysis on Elevate Pro (₹199/month)."
          onComparePlans={() => onNavigate('plans')}
        />
      )}

      {/* Holding Modal */}
      <ModalSheet
        open={holdingModalOpen}
        onClose={() => setHoldingModalOpen(false)}
        title={editingHolding ? 'Edit Manual Holding' : 'Add Manual Holding'}
        subtitle="Enter figures directly from your statement. No live market data is fetched."
      >
        <form onSubmit={handleSaveHolding} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="hold-name"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Holding Name
              </label>
              <input
                id="hold-name"
                type="text"
                value={name}
                aria-invalid={Boolean(holdingErrors.name)}
                onChange={(e) => {
                  setName(e.target.value);
                  setHoldingErrors((p) => ({ ...p, name: undefined }));
                }}
                placeholder="e.g., Total Market Index Fund"
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  holdingErrors.name ? 'border-[#B42318]' : 'border-[#142A3B]/15'
                }`}
              />
              {holdingErrors.name && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {holdingErrors.name}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="hold-symbol"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Ticker / Ref
              </label>
              <input
                id="hold-symbol"
                type="text"
                maxLength={16}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="Optional"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="hold-class"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Asset Class
              </label>
              <select
                id="hold-class"
                value={assetClass}
                onChange={(e) => setAssetClass(e.target.value as AssetClass)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              >
                {ASSET_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="hold-acct"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Account / Custodian Label
              </label>
              <input
                id="hold-acct"
                type="text"
                value={accountLabel}
                onChange={(e) => setAccountLabel(e.target.value)}
                placeholder="e.g., Retirement Account"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="hold-units"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Units / Shares
              </label>
              <input
                id="hold-units"
                type="number"
                min="0"
                step="any"
                value={units}
                aria-invalid={Boolean(holdingErrors.units)}
                onChange={(e) => {
                  setUnits(e.target.value);
                  setHoldingErrors((p) => ({ ...p, units: undefined }));
                }}
                placeholder="0"
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  holdingErrors.units ? 'border-[#B42318]' : 'border-[#142A3B]/15'
                }`}
              />
              {holdingErrors.units && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {holdingErrors.units}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="hold-cost"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Cost Basis ({currency})
              </label>
              <input
                id="hold-cost"
                type="number"
                min="0"
                step="0.01"
                value={costBasis}
                aria-invalid={Boolean(holdingErrors.costBasis)}
                onChange={(e) => {
                  setCostBasis(e.target.value);
                  setHoldingErrors((p) => ({ ...p, costBasis: undefined }));
                }}
                placeholder="0.00"
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  holdingErrors.costBasis
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {holdingErrors.costBasis && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {holdingErrors.costBasis}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="hold-val"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Confirmed Value ({currency})
              </label>
              <input
                id="hold-val"
                type="number"
                min="0"
                step="0.01"
                value={currentValue}
                aria-invalid={Boolean(holdingErrors.currentValue)}
                onChange={(e) => {
                  setCurrentValue(e.target.value);
                  setHoldingErrors((p) => ({ ...p, currentValue: undefined }));
                }}
                placeholder="0.00"
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  holdingErrors.currentValue
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {holdingErrors.currentValue && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {holdingErrors.currentValue}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="hold-date"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Statement Valuation Date
              </label>
              <input
                id="hold-date"
                type="date"
                value={valuedAt}
                aria-invalid={Boolean(holdingErrors.valuedAt)}
                onChange={(e) => {
                  setValuedAt(e.target.value);
                  setHoldingErrors((p) => ({ ...p, valuedAt: undefined }));
                }}
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  holdingErrors.valuedAt
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {holdingErrors.valuedAt && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {holdingErrors.valuedAt}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="hold-notes"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Notes (Optional)
              </label>
              <input
                id="hold-notes"
                type="text"
                maxLength={120}
                value={holdingNotes}
                onChange={(e) => setHoldingNotes(e.target.value)}
                placeholder="Statement source or memo"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setHoldingModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary">
              {editingHolding ? 'Save Valuation' : 'Add Holding'}
            </Button>
          </div>
        </form>
      </ModalSheet>

      {/* Investment Goal Modal */}
      <ModalSheet
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        title={editingGoal ? 'Edit Investment Goal' : 'Create Investment Goal'}
        subtitle="Track progress against your manually entered portfolio or a custom figure."
      >
        <form onSubmit={handleSaveGoal} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="ig-title"
              className="block text-xs font-semibold text-[#142A3B] mb-1.5"
            >
              Goal Title
            </label>
            <input
              id="ig-title"
              type="text"
              value={goalTitle}
              aria-invalid={Boolean(goalErrors.title)}
              onChange={(e) => {
                setGoalTitle(e.target.value);
                setGoalErrors((p) => ({ ...p, title: undefined }));
              }}
              placeholder="e.g., Retirement Core Milestone"
              className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                goalErrors.title ? 'border-[#B42318]' : 'border-[#142A3B]/15'
              }`}
            />
            {goalErrors.title && (
              <p className="mt-1 text-xs text-[#B42318]">{goalErrors.title}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="ig-scope"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Progress Tracking Source
              </label>
              <select
                id="ig-scope"
                value={goalScope}
                onChange={(e) =>
                  setGoalScope(
                    e.target.value as 'All Holdings' | AssetClass | 'Manual'
                  )
                }
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              >
                <option value="All Holdings">All Manual Holdings</option>
                {ASSET_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    Asset Class: {c}
                  </option>
                ))}
                <option value="Manual">Manual Amount</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="ig-target"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Target Value ({currency})
              </label>
              <input
                id="ig-target"
                type="number"
                min="1"
                step="1"
                value={goalTargetAmount}
                aria-invalid={Boolean(goalErrors.targetAmount)}
                onChange={(e) => {
                  setGoalTargetAmount(e.target.value);
                  setGoalErrors((p) => ({ ...p, targetAmount: undefined }));
                }}
                placeholder="100000"
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  goalErrors.targetAmount
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {goalErrors.targetAmount && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {goalErrors.targetAmount}
                </p>
              )}
            </div>
          </div>

          {goalScope === 'Manual' && (
            <div>
              <label
                htmlFor="ig-manual"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Current Manual Progress ({currency})
              </label>
              <input
                id="ig-manual"
                type="number"
                min="0"
                step="0.01"
                value={goalManualValue}
                aria-invalid={Boolean(goalErrors.manualCurrentValue)}
                onChange={(e) => {
                  setGoalManualValue(e.target.value);
                  setGoalErrors((p) => ({
                    ...p,
                    manualCurrentValue: undefined,
                  }));
                }}
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  goalErrors.manualCurrentValue
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {goalErrors.manualCurrentValue && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {goalErrors.manualCurrentValue}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="ig-monthly"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Planned Monthly Contribution ({currency})
              </label>
              <input
                id="ig-monthly"
                type="number"
                min="0"
                step="1"
                value={goalMonthlyContrib}
                aria-invalid={Boolean(goalErrors.monthlyContribution)}
                onChange={(e) => {
                  setGoalMonthlyContrib(e.target.value);
                  setGoalErrors((p) => ({
                    ...p,
                    monthlyContribution: undefined,
                  }));
                }}
                placeholder="0"
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  goalErrors.monthlyContribution
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {goalErrors.monthlyContribution && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {goalErrors.monthlyContribution}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="ig-date"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Target Date (Optional)
              </label>
              <input
                id="ig-date"
                type="date"
                value={goalTargetDate}
                aria-invalid={Boolean(goalErrors.targetDate)}
                onChange={(e) => {
                  setGoalTargetDate(e.target.value);
                  setGoalErrors((p) => ({ ...p, targetDate: undefined }));
                }}
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  goalErrors.targetDate
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {goalErrors.targetDate && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {goalErrors.targetDate}
                </p>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setGoalModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary">
              {editingGoal ? 'Save Goal' : 'Create Goal'}
            </Button>
          </div>
        </form>
      </ModalSheet>

      {/* Target Allocation Modal */}
      <ModalSheet
        open={targetModalOpen}
        onClose={() => setTargetModalOpen(false)}
        title="Configure Target Asset Allocation"
        subtitle="Optionally enter your personal target percentage per asset class (must total 100%, or leave all blank)."
      >
        <form onSubmit={handleSaveTargets} noValidate className="space-y-4">
          {targetErrors && <ErrorBanner message={targetErrors} />}
          <div className="space-y-3">
            {ASSET_CLASSES.map((ac) => (
              <div
                key={ac}
                className="flex items-center justify-between gap-4"
              >
                <label
                  htmlFor={`target-${ac}`}
                  className="text-sm font-medium text-[#142A3B]"
                >
                  {ac}
                </label>
                <div className="flex items-center gap-1.5 w-28">
                  <input
                    id={`target-${ac}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={targetInputs[ac]}
                    onChange={(e) => {
                      setTargetInputs((prev) => ({
                        ...prev,
                        [ac]: e.target.value,
                      }));
                      setTargetErrors(null);
                    }}
                    placeholder="0"
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                  />
                  <span className="text-xs text-[#627384]">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setTargetModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary">
              Save Target Weights
            </Button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
}
