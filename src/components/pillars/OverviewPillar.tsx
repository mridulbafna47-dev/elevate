import React from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Compass,
  Plus,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { PillarId } from '../../types/finance';
import { useElevate } from '../../context/ElevateContext';
import { formatCurrency, formatPercent, getMonthKey } from '../../utils/format';
import { Card, CardHeader } from '../ui/Card';
import { StatMetric } from '../ui/StatMetric';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { CashFlowBarChart, MonthlyFlowDatum } from '../charts/CashFlowBarChart';
import {
  AllocationDonutChart,
  ELEVATE_CHART_PALETTE,
} from '../charts/AllocationDonutChart';

interface OverviewPillarProps {
  onNavigate: (pillar: PillarId) => void;
}

export function OverviewPillar({ onNavigate }: OverviewPillarProps) {
  const {
    workspace,
    totalCashAssets,
    netCashBalance,
    totalPortfolioValue,
    portfolioUnrealizedGain,
    portfolioReturnPct,
    totalTrackedNetWorth,
    monthlyIncome,
    monthlyExpenses,
    monthlyNetFlow,
    monthlySavingsRatePct,
    annualInsurancePremiums,
    monthlyInsuranceEquiv,
    upcomingRenewals,
    coachingActions,
    loadSampleTemplate,
  } = useElevate();

  const currency = workspace.currency;
  const isWorkspaceEmpty =
    workspace.accounts.length === 0 &&
    workspace.transactions.length === 0 &&
    workspace.holdings.length === 0 &&
    workspace.policies.length === 0 &&
    workspace.goals.length === 0;

  // Build monthly cash flow series from user transactions
  const monthlySeries: MonthlyFlowDatum[] = React.useMemo(() => {
    const map = new Map<string, { income: number; expenses: number }>();
    for (const tx of workspace.transactions) {
      const mk = getMonthKey(tx.date);
      const curr = map.get(mk) ?? { income: 0, expenses: 0 };
      if (tx.type === 'income') curr.income += tx.amount;
      else curr.expenses += tx.amount;
      map.set(mk, curr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([monthKey, vals]) => ({
        monthKey,
        income: vals.income,
        expenses: vals.expenses,
      }));
  }, [workspace.transactions]);

  // Build asset allocation slices from user holdings
  const wealthSlices = React.useMemo(() => {
    const grouped = new Map<string, number>();
    for (const h of workspace.holdings) {
      grouped.set(
        h.assetClass,
        (grouped.get(h.assetClass) ?? 0) + (Number(h.currentValue) || 0)
      );
    }
    return Array.from(grouped.entries()).map(([label, value], i) => ({
      label,
      value,
      color: ELEVATE_CHART_PALETTE[i % ELEVATE_CHART_PALETTE.length],
    }));
  }, [workspace.holdings]);

  const completedCount = coachingActions.filter(
    (a) => a.autoCompleted || workspace.guideSettings.completedActionIds.includes(a.id)
  ).length;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero Header & Cross-Pillar Net Snapshot */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-[#1E8A78]">
            Connected Personal Finance Workspace
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight text-balance">
            Your entire financial life, elevated.
          </h1>
          <p className="mt-2 text-sm text-[#425466] leading-relaxed">
            Every figure below is computed directly from your own logged accounts, cash flow, valuations, and policies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Button variant="secondary" onClick={() => onNavigate('flow')}>
            <Plus className="w-4 h-4" />
            <span>Log Entry in Flow</span>
          </Button>
          {isWorkspaceEmpty && (
            <Button variant="outline" onClick={loadSampleTemplate}>
              <span>Load Sample Template</span>
            </Button>
          )}
        </div>
      </div>

      {/* 4-Column Top KPI Strip */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[#142A3B]/10">
          <div className="pt-0 sm:pr-4">
            <StatMetric
              label="Total Tracked Position"
              value={formatCurrency(totalTrackedNetWorth, currency)}
              detail={`Net cash ${formatCurrency(netCashBalance, currency)} + investments`}
            />
          </div>
          <div className="pt-5 sm:pt-0 sm:px-4">
            <StatMetric
              label="This Month Net Flow"
              value={formatCurrency(monthlyNetFlow, currency)}
              tone={
                monthlyNetFlow > 0
                  ? 'teal'
                  : monthlyNetFlow < 0
                    ? 'negative'
                    : 'default'
              }
              detail={
                monthlyIncome > 0
                  ? `${formatPercent(monthlySavingsRatePct)} savings rate (${formatCurrency(monthlyExpenses, currency)} spent)`
                  : 'Log income & expenses in Flow'
              }
            />
          </div>
          <div className="pt-5 lg:pt-0 lg:px-4">
            <StatMetric
              label="Tracked Investments"
              value={formatCurrency(totalPortfolioValue, currency)}
              tone={
                portfolioUnrealizedGain > 0
                  ? 'teal'
                  : portfolioUnrealizedGain < 0
                    ? 'negative'
                    : 'default'
              }
              detail={
                workspace.holdings.length > 0
                  ? `${formatCurrency(portfolioUnrealizedGain, currency)} (${formatPercent(portfolioReturnPct, true)}) vs. cost`
                  : 'Add holdings in Wealth'
              }
            />
          </div>
          <div className="pt-5 lg:pt-0 lg:pl-4">
            <StatMetric
              label="Annual Protection Cost"
              value={formatCurrency(annualInsurancePremiums, currency)}
              tone="gold"
              detail={
                workspace.policies.length > 0
                  ? `${formatCurrency(monthlyInsuranceEquiv, currency)}/mo across ${workspace.policies.length} polic${workspace.policies.length === 1 ? 'y' : 'ies'}`
                  : 'Organize policies in Secure'
              }
            />
          </div>
        </div>
      </Card>

      {/* Four Connected Pillars Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#142A3B]">Four Connected Pillars</h2>
          <span className="text-xs text-[#627384]">Select a pillar to manage records</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Elevate Flow */}
          <Card className="flex flex-col justify-between hover:border-[#1E8A78]/50 transition-colors">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1E8A78]/10 text-[#1E8A78] flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#142A3B]">
                      Elevate Flow
                    </h3>
                    <p className="text-xs text-[#425466]">Personal finance manager</p>
                  </div>
                </div>
                <span className="text-sm font-mono tabular-nums font-semibold text-[#142A3B]">
                  {formatCurrency(totalCashAssets, currency)}
                </span>
              </div>
              <p className="mt-3 text-sm text-[#425466] leading-relaxed">
                Track manual account balances, monthly income and spending, and category budgets without third-party bank scraping.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-[#142A3B]/8 flex items-center justify-between gap-3 text-xs">
              <span className="text-[#627384]">
                {workspace.accounts.length} accounts · {workspace.transactions.length} entries
              </span>
              <button
                type="button"
                onClick={() => onNavigate('flow')}
                className="inline-flex items-center gap-1.5 font-semibold text-[#1E8A78] hover:text-[#142A3B] py-2 px-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78] rounded-md"
              >
                <span>Open Flow</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>

          {/* Elevate Guide */}
          <Card className="flex flex-col justify-between hover:border-[#1E8A78]/50 transition-colors">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#D5A64A]/20 text-[#946C1B] flex items-center justify-center shrink-0">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#142A3B]">
                      Elevate Guide
                    </h3>
                    <p className="text-xs text-[#425466]">Financial coach</p>
                  </div>
                </div>
                <span className="text-sm font-mono tabular-nums font-semibold text-[#142A3B]">
                  {completedCount}/{coachingActions.length} checks
                </span>
              </div>
              <p className="mt-3 text-sm text-[#425466] leading-relaxed">
                Stress-test your emergency runway, compare 50/30/20 spending proportions, and map realistic timelines for savings goals.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-[#142A3B]/8 flex items-center justify-between gap-3 text-xs">
              <span className="text-[#627384]">
                {workspace.goals.length} active savings goal{workspace.goals.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => onNavigate('guide')}
                className="inline-flex items-center gap-1.5 font-semibold text-[#1E8A78] hover:text-[#142A3B] py-2 px-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78] rounded-md"
              >
                <span>Open Guide</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>

          {/* Elevate Wealth */}
          <Card className="flex flex-col justify-between hover:border-[#1E8A78]/50 transition-colors">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#142A3B]/8 text-[#142A3B] flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#142A3B]">
                      Elevate Wealth
                    </h3>
                    <p className="text-xs text-[#425466]">Investment tracker</p>
                  </div>
                </div>
                <span className="text-sm font-mono tabular-nums font-semibold text-[#142A3B]">
                  {formatCurrency(totalPortfolioValue, currency)}
                </span>
              </div>
              <p className="mt-3 text-sm text-[#425466] leading-relaxed">
                Monitor asset class mix, cost basis versus your confirmed valuations, and long-term net worth snapshots over time.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-[#142A3B]/8 flex items-center justify-between gap-3 text-xs">
              <span className="text-[#627384]">
                {workspace.holdings.length} holding{workspace.holdings.length === 1 ? '' : 's'} · {workspace.snapshots.length} snapshots
              </span>
              <button
                type="button"
                onClick={() => onNavigate('wealth')}
                className="inline-flex items-center gap-1.5 font-semibold text-[#1E8A78] hover:text-[#142A3B] py-2 px-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78] rounded-md"
              >
                <span>Open Wealth</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>

          {/* Elevate Secure */}
          <Card className="flex flex-col justify-between hover:border-[#1E8A78]/50 transition-colors">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1E8A78]/10 text-[#1E8A78] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#142A3B]">
                      Elevate Secure
                    </h3>
                    <p className="text-xs text-[#425466]">Insurance organiser</p>
                  </div>
                </div>
                <span className="text-sm font-mono tabular-nums font-semibold text-[#142A3B]">
                  {workspace.policies.length} polic{workspace.policies.length === 1 ? 'y' : 'ies'}
                </span>
              </div>
              <p className="mt-3 text-sm text-[#425466] leading-relaxed">
                Keep coverage limits, deductibles, beneficiaries, and upcoming policy renewals organized in one calm register.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-[#142A3B]/8 flex items-center justify-between gap-3 text-xs">
              <span className="text-[#627384]">
                {upcomingRenewals.length > 0
                  ? `${upcomingRenewals.length} renewal within 60 days`
                  : 'No renewals in next 60 days'}
              </span>
              <button
                type="button"
                onClick={() => onNavigate('secure')}
                className="inline-flex items-center gap-1.5 font-semibold text-[#1E8A78] hover:text-[#142A3B] py-2 px-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78] rounded-md"
              >
                <span>Open Secure</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Cross-Pillar Visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Cash Flow Trajectory"
            subtitle="Monthly income vs. expenses from Elevate Flow"
            action={
              <Button variant="ghost" size="sm" onClick={() => onNavigate('flow')}>
                View Flow
              </Button>
            }
          />
          {monthlySeries.length > 0 ? (
            <CashFlowBarChart data={monthlySeries} currency={currency} />
          ) : (
            <EmptyState
              icon={<Wallet className="w-5 h-5" />}
              title="No monthly entries yet"
              description="Log income or expense entries in Elevate Flow to chart your monthly cash flow trajectory."
              actionLabel="Go to Elevate Flow"
              onAction={() => onNavigate('flow')}
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Portfolio Asset Mix"
            subtitle="Distribution of your user-valued holdings in Elevate Wealth"
            action={
              <Button variant="ghost" size="sm" onClick={() => onNavigate('wealth')}>
                View Wealth
              </Button>
            }
          />
          {wealthSlices.length > 0 ? (
            <AllocationDonutChart
              slices={wealthSlices}
              currency={currency}
              centerLabel="Invested"
            />
          ) : (
            <EmptyState
              icon={<TrendingUp className="w-5 h-5" />}
              title="No investment holdings recorded"
              description="Add holdings with your cost basis and confirmed valuation in Elevate Wealth."
              actionLabel="Go to Elevate Wealth"
              onAction={() => onNavigate('wealth')}
            />
          )}
        </Card>
      </div>

      {/* Guide Priorities & Secure Renewals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Next Coaching Checkpoints"
            subtitle="Generated dynamically from your four pillars"
            action={
              <Button variant="ghost" size="sm" onClick={() => onNavigate('guide')}>
                Open Guide
              </Button>
            }
          />
          <ul className="divide-y divide-[#142A3B]/8">
            {coachingActions.slice(0, 4).map((item) => {
              const done =
                item.autoCompleted ||
                workspace.guideSettings.completedActionIds.includes(item.id);
              return (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                  <CheckCircle2
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      done ? 'text-[#1E8A78]' : 'text-[#142A3B]/25'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-[#627384]">
                      <span className="font-medium text-[#142A3B]">{item.pillar}</span>
                      <span aria-hidden="true">·</span>
                      <span>{done ? 'Complete' : `${item.priority} priority`}</span>
                    </div>
                    <p className="text-sm font-medium text-[#142A3B] mt-0.5">
                      {item.title}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Upcoming Policy Renewals"
            subtitle="Policies renewing within 60 days from Elevate Secure"
            action={
              <Button variant="ghost" size="sm" onClick={() => onNavigate('secure')}>
                Open Secure
              </Button>
            }
          />
          {upcomingRenewals.length > 0 ? (
            <ul className="divide-y divide-[#142A3B]/8">
              {upcomingRenewals.map((pol) => (
                <li
                  key={pol.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#142A3B] truncate">
                      {pol.policyName}
                    </p>
                    <p className="text-xs text-[#425466]">
                      {pol.provider} · {pol.category}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="inline-flex items-center gap-1 text-xs font-semibold text-[#946C1B]">
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>
                        {pol.daysRemaining <= 0
                          ? 'Due today or past'
                          : `In ${pol.daysRemaining}d`}
                      </span>
                    </p>
                    <p className="text-xs font-mono tabular-nums text-[#425466]">
                      {formatCurrency(pol.premiumAmount, currency)} / {pol.premiumCadence}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<ShieldCheck className="w-5 h-5" />}
              title={
                workspace.policies.length === 0
                  ? 'No insurance policies logged'
                  : 'No renewals in the next 60 days'
              }
              description={
                workspace.policies.length === 0
                  ? 'Document your health, life, home, or auto coverage in Elevate Secure to monitor renewal dates.'
                  : 'All documented policies are more than 60 days away from their renewal dates.'
              }
              actionLabel="Manage Policies"
              onAction={() => onNavigate('secure')}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
