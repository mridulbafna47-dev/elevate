import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Compass,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import { SavingsGoal } from '../../types/finance';
import { useElevate } from '../../context/ElevateContext';
import { formatCurrency, formatPercent, getMonthKey } from '../../utils/format';
import { Card, CardHeader } from '../ui/Card';
import { StatMetric } from '../ui/StatMetric';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ModalSheet } from '../ui/ModalSheet';
import { GoalProgressRing } from '../charts/GoalProgressRing';

export function GuidePillar() {
  const {
    workspace,
    totalCashAssets,
    currentMonthKey,
    monthlyIncome,
    monthlyEssentialSpend,
    monthlyExpenses,
    monthlyInsuranceEquiv,
    coachingActions,
    addGoal,
    updateGoal,
    deleteGoal,
    updateGuideSettings,
    toggleCoachingAction,
  } = useElevate();

  const currency = workspace.currency;
  const { emergencyTargetMonths, customMonthlyEssentialBaseline } =
    workspace.guideSettings;

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalSaved, setGoalSaved] = useState('');
  const [goalMonthly, setGoalMonthly] = useState('');

  const [baselineInput, setBaselineInput] = useState(
    customMonthlyEssentialBaseline !== null
      ? String(customMonthlyEssentialBaseline)
      : ''
  );

  // Derived essential baseline: user override -> Flow Needs -> Flow total expenses -> monthly insurance equiv
  const derivedEssentialBaseline =
    monthlyEssentialSpend > 0
      ? monthlyEssentialSpend
      : monthlyExpenses > 0
        ? monthlyExpenses
        : monthlyInsuranceEquiv;

  const activeMonthlyBaseline =
    customMonthlyEssentialBaseline !== null && customMonthlyEssentialBaseline > 0
      ? customMonthlyEssentialBaseline
      : derivedEssentialBaseline;

  const targetReserveAmount = activeMonthlyBaseline * emergencyTargetMonths;
  const runwayMonthsAchieved =
    activeMonthlyBaseline > 0 ? totalCashAssets / activeMonthlyBaseline : 0;
  const reserveProgressPct =
    targetReserveAmount > 0
      ? Math.min(100, (totalCashAssets / targetReserveAmount) * 100)
      : 0;
  const reserveShortfall = Math.max(0, targetReserveAmount - totalCashAssets);

  // 50/30/20 breakdown based on current month Flow transactions
  const allocationBreakdown = useMemo(() => {
    const monthTxs = workspace.transactions.filter(
      (t) => t.type === 'expense' && getMonthKey(t.date) === currentMonthKey
    );
    let needs = 0;
    let wants = 0;
    let savingsDebt = 0;
    for (const tx of monthTxs) {
      if (tx.bucket === 'Wants') wants += tx.amount;
      else if (tx.bucket === 'Savings & Debt') savingsDebt += tx.amount;
      else needs += tx.amount;
    }
    const denominator = monthlyIncome > 0 ? monthlyIncome : needs + wants + savingsDebt;
    return {
      needs,
      wants,
      savingsDebt,
      denominator,
      needsPct: denominator > 0 ? (needs / denominator) * 100 : 0,
      wantsPct: denominator > 0 ? (wants / denominator) * 100 : 0,
      savingsPct: denominator > 0 ? (savingsDebt / denominator) * 100 : 0,
    };
  }, [workspace.transactions, currentMonthKey, monthlyIncome]);

  const openNewGoal = () => {
    setEditingGoal(null);
    setGoalTitle('');
    setGoalTarget('');
    setGoalSaved('0');
    setGoalMonthly('');
    setGoalModalOpen(true);
  };

  const openEditGoal = (g: SavingsGoal) => {
    setEditingGoal(g);
    setGoalTitle(g.title);
    setGoalTarget(String(g.targetAmount));
    setGoalSaved(String(g.currentSaved));
    setGoalMonthly(String(g.monthlyContribution));
    setGoalModalOpen(true);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(goalTarget);
    const saved = parseFloat(goalSaved) || 0;
    const monthly = parseFloat(goalMonthly) || 0;
    if (!goalTitle.trim() || !Number.isFinite(target) || target <= 0) return;

    if (editingGoal) {
      updateGoal(editingGoal.id, {
        title: goalTitle.trim(),
        targetAmount: target,
        currentSaved: Math.max(0, saved),
        monthlyContribution: Math.max(0, monthly),
      });
    } else {
      addGoal({
        title: goalTitle.trim(),
        targetAmount: target,
        currentSaved: Math.max(0, saved),
        monthlyContribution: Math.max(0, monthly),
      });
    }
    setGoalModalOpen(false);
  };

  const handleApplyBaseline = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(baselineInput);
    if (!baselineInput.trim()) {
      updateGuideSettings({ customMonthlyEssentialBaseline: null });
      return;
    }
    if (Number.isFinite(num) && num > 0) {
      updateGuideSettings({ customMonthlyEssentialBaseline: num });
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#946C1B]">
            Elevate Guide · Financial Coach
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
            Runway, allocation & goal coaching
          </h1>
          <p className="mt-1.5 text-sm text-[#425466]">
            Interactive planning calculators grounded strictly in your logged cash reserves, spending, and policy obligations.
          </p>
        </div>

        <Button variant="secondary" onClick={openNewGoal}>
          <Plus className="w-4 h-4" />
          <span>New Savings Goal</span>
        </Button>
      </div>

      {/* Emergency Runway Planner */}
      <Card>
        <CardHeader
          title="Emergency Fund Runway Planner"
          subtitle="Adjust your target reserve horizon to see how your Flow cash assets cover essential monthly living costs"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-5">
            {/* Target Months Slider */}
            <div className="p-4 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10">
              <div className="flex items-center justify-between gap-3 mb-2">
                <label
                  htmlFor="runway-months-slider"
                  className="text-xs font-semibold text-[#142A3B]"
                >
                  Target Emergency Horizon
                </label>
                <span className="text-sm font-mono tabular-nums font-semibold text-[#1E8A78]">
                  {emergencyTargetMonths} months
                </span>
              </div>
              <input
                id="runway-months-slider"
                type="range"
                min={3}
                max={12}
                step={1}
                value={emergencyTargetMonths}
                onChange={(e) =>
                  updateGuideSettings({
                    emergencyTargetMonths: Number(e.target.value),
                  })
                }
                className="w-full accent-[#1E8A78] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-[#627384] mt-1 font-mono tabular-nums">
                <span>3 mo</span>
                <span>6 mo</span>
                <span>9 mo</span>
                <span>12 mo</span>
              </div>
            </div>

            {/* Monthly Essentials Baseline Override */}
            <form
              onSubmit={handleApplyBaseline}
              className="flex flex-col sm:flex-row sm:items-end gap-3"
            >
              <div className="flex-1">
                <label
                  htmlFor="essential-baseline-input"
                  className="block text-xs font-semibold text-[#142A3B] mb-1.5"
                >
                  Monthly Essential Cost Baseline ({currency})
                </label>
                <input
                  id="essential-baseline-input"
                  type="number"
                  step="10"
                  min="0"
                  value={baselineInput}
                  onChange={(e) => setBaselineInput(e.target.value)}
                  placeholder={
                    derivedEssentialBaseline > 0
                      ? `Auto from Flow: ${Math.round(derivedEssentialBaseline)}`
                      : 'Enter monthly essentials (e.g. 3000)'
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button type="submit" variant="outline">
                  Apply Baseline
                </Button>
                {customMonthlyEssentialBaseline !== null && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setBaselineInput('');
                      updateGuideSettings({ customMonthlyEssentialBaseline: null });
                    }}
                  >
                    Use Flow Auto
                  </Button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 p-5 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10">
            <div className="flex items-center justify-between gap-4">
              <StatMetric
                label="Current Cash Runway"
                value={
                  activeMonthlyBaseline > 0
                    ? `${runwayMonthsAchieved.toFixed(1)} mo`
                    : '—'
                }
                tone={
                  runwayMonthsAchieved >= emergencyTargetMonths
                    ? 'teal'
                    : 'gold'
                }
                detail={
                  activeMonthlyBaseline > 0
                    ? `${formatCurrency(totalCashAssets, currency)} cash vs. ${formatCurrency(activeMonthlyBaseline, currency)}/mo`
                    : 'Set an essential monthly baseline'
                }
              />
              <GoalProgressRing
                percent={reserveProgressPct}
                size={64}
                strokeWidth={6}
                color={
                  reserveProgressPct >= 100 ? '#1E8A78' : '#D5A64A'
                }
              />
            </div>

            <div className="pt-3 border-t border-[#142A3B]/10 text-xs text-[#425466] space-y-1">
              <div className="flex justify-between">
                <span>Target Reserve ({emergencyTargetMonths} mo)</span>
                <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                  {formatCurrency(targetReserveAmount, currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Remaining to Target</span>
                <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                  {formatCurrency(reserveShortfall, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 50/30/20 Diagnostic & Action Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="50 / 30 / 20 Allocation Check"
            subtitle={`Comparing ${currentMonthKey} Flow expenses against a standard 50% Needs · 30% Wants · 20% Savings reference`}
          />

          {allocationBreakdown.denominator > 0 ? (
            <div className="space-y-5">
              {[
                {
                  label: 'Needs (Essentials)',
                  actual: allocationBreakdown.needs,
                  actualPct: allocationBreakdown.needsPct,
                  targetPct: 50,
                  barColor: 'bg-[#142A3B]',
                },
                {
                  label: 'Wants (Discretionary)',
                  actual: allocationBreakdown.wants,
                  actualPct: allocationBreakdown.wantsPct,
                  targetPct: 30,
                  barColor: 'bg-[#D5A64A]',
                },
                {
                  label: 'Savings & Debt Paydown',
                  actual: allocationBreakdown.savingsDebt,
                  actualPct: allocationBreakdown.savingsPct,
                  targetPct: 20,
                  barColor: 'bg-[#1E8A78]',
                },
              ].map((row) => (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-[#142A3B]">{row.label}</span>
                    <span className="text-xs font-mono tabular-nums text-[#425466]">
                      <strong className="text-[#142A3B]">
                        {formatPercent(row.actualPct)}
                      </strong>{' '}
                      ({formatCurrency(row.actual, currency)}) · Guide {row.targetPct}%
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full rounded-full bg-[#EEF2F5] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${row.barColor}`}
                      style={{ width: `${Math.min(100, row.actualPct)}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-xs text-[#627384] pt-2 border-t border-[#142A3B]/8">
                Note: Benchmarks are educational reference ratios only. Adjust category buckets in Elevate Flow to refine this view.
              </p>
            </div>
          ) : (
            <EmptyState
              icon={<Compass className="w-5 h-5" />}
              title="No current-month cash flow to analyze"
              description="Log income and categorized expenses for this month in Elevate Flow to review your 50/30/20 allocation."
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Personalized Coaching Checklist"
            subtitle="Live checkpoints connected across Flow, Wealth, and Secure"
          />
          <ul className="divide-y divide-[#142A3B]/8">
            {coachingActions.map((item) => {
              const checked =
                item.autoCompleted ||
                workspace.guideSettings.completedActionIds.includes(item.id);
              return (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => toggleCoachingAction(item.id)}
                    className="w-full text-left flex items-start gap-3 py-1 rounded-lg hover:bg-[#F7F9FA] px-2 -mx-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78]"
                  >
                    {checked ? (
                      <CheckCircle2 className="w-5 h-5 text-[#1E8A78] mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-[#142A3B]/25 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#627384]">
                        <span className="font-semibold text-[#142A3B]">
                          {item.pillar}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {item.autoCompleted
                            ? 'Verified from your records'
                            : `${item.priority} priority`}
                        </span>
                      </div>
                      <p
                        className={`text-sm font-medium mt-0.5 ${
                          checked ? 'text-[#425466] line-through' : 'text-[#142A3B]'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-xs text-[#425466] mt-0.5 leading-relaxed">
                        {item.detail}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Savings Goals */}
      <Card>
        <CardHeader
          title="Savings Goals & Milestone Timelines"
          subtitle="Deterministic projection based on your current balance and planned monthly contribution"
          action={
            <Button variant="outline" size="sm" onClick={openNewGoal}>
              <Plus className="w-4 h-4" />
              <span>Add Goal</span>
            </Button>
          }
        />

        {workspace.goals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workspace.goals.map((g) => {
              const pct = g.targetAmount > 0 ? (g.currentSaved / g.targetAmount) * 100 : 0;
              const remaining = Math.max(0, g.targetAmount - g.currentSaved);
              const monthsNeeded =
                remaining === 0
                  ? 0
                  : g.monthlyContribution > 0
                    ? Math.ceil(remaining / g.monthlyContribution)
                    : null;

              return (
                <div
                  key={g.id}
                  className="p-4 rounded-xl border border-[#142A3B]/10 bg-[#F7F9FA]/60 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <GoalProgressRing
                      percent={pct}
                      size={56}
                      strokeWidth={5}
                      color={pct >= 100 ? '#1E8A78' : '#142A3B'}
                    />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => openEditGoal(g)}
                        className="text-sm font-semibold text-[#142A3B] hover:text-[#1E8A78] text-left truncate block max-w-full cursor-pointer"
                      >
                        {g.title}
                      </button>
                      <p className="text-xs font-mono tabular-nums text-[#425466] mt-0.5">
                        {formatCurrency(g.currentSaved, currency)} /{' '}
                        {formatCurrency(g.targetAmount, currency)}
                      </p>
                      <p className="text-xs text-[#627384] mt-1">
                        {monthsNeeded === 0
                          ? 'Target reached'
                          : monthsNeeded !== null
                            ? `${monthsNeeded} mo at ${formatCurrency(g.monthlyContribution, currency)}/mo`
                            : 'Set a monthly contribution to project timeline'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteGoal(g.id)}
                    aria-label={`Delete ${g.title}`}
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#627384] hover:text-[#B42318] hover:bg-[#B42318]/8 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Target className="w-5 h-5" />}
            title="No savings goals added yet"
            description="Create a concrete goal for an emergency buffer, home fund, or education reserve."
            actionLabel="Create First Goal"
            onAction={openNewGoal}
          />
        )}
      </Card>

      {/* Goal Modal */}
      <ModalSheet
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        title={editingGoal ? 'Edit Savings Goal' : 'Create Savings Goal'}
        subtitle="Track progress toward a specific financial milestone."
      >
        <form onSubmit={handleSaveGoal} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
              Goal Title
            </label>
            <input
              type="text"
              required
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="e.g., 6-Month Emergency Reserve"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Target ({currency})
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Saved ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={goalSaved}
                onChange={(e) => setGoalSaved(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Monthly ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={goalMonthly}
                onChange={(e) => setGoalMonthly(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setGoalModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary">
              {editingGoal ? 'Save Changes' : 'Add Goal'}
            </Button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
}
