import React from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  Plus,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { NavViewId } from '../../types/finance';
import { useElevate } from '../../context/ElevateContext';
import {
  daysUntil,
  formatCurrency,
  formatDateShort,
  formatPercent,
  getMonthKey,
} from '../../utils/format';
import { Card, CardHeader } from '../ui/Card';
import { StatMetric } from '../ui/StatMetric';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { GoalProgressRing } from '../charts/GoalProgressRing';
import { CashFlowBarChart, MonthlyFlowDatum } from '../charts/CashFlowBarChart';

interface DashboardPillarProps {
  onNavigate: (view: NavViewId) => void;
}

export function DashboardPillar({ onNavigate }: DashboardPillarProps) {
  const {
    user,
    workspace,
    currentMonthKey,
    monthlyIncome,
    monthlyExpenses,
    monthlyNetFlow,
    monthlySavingsRatePct,
    totalMonthlyBudgetLimit,
    totalMonthlyBudgetSpent,
    totalPortfolioValue,
    totalTrackedNetWorth,
    coachingActions,
  } = useElevate();

  const currency = workspace.currency;

  const hasIncomeThisMonth = workspace.transactions.some(
    (t) => t.type === 'income' && getMonthKey(t.date) === currentMonthKey
  );
  const hasExpensesThisMonth = workspace.transactions.some(
    (t) => t.type === 'expense' && getMonthKey(t.date) === currentMonthKey
  );

  // Current month spending per budget category
  const currentMonthSpendByCat = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const tx of workspace.transactions) {
      if (tx.type === 'expense' && getMonthKey(tx.date) === currentMonthKey) {
        const key = tx.category.toLowerCase();
        m.set(key, (m.get(key) ?? 0) + tx.amount);
      }
    }
    return m;
  }, [workspace.transactions, currentMonthKey]);

  // All policies sorted by nearest renewal date
  const sortedRenewals = React.useMemo(() => {
    return [...workspace.policies]
      .map((p) => ({
        ...p,
        daysRemaining: daysUntil(p.renewalDate) ?? 9999,
      }))
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [workspace.policies]);

  // Monthly cash flow chart series
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

  // Pending next actions (prioritize incomplete actions first)
  const orderedActions = React.useMemo(() => {
    return [...coachingActions].sort((a, b) => {
      const aDone =
        a.autoCompleted ||
        workspace.guideSettings.completedActionIds.includes(a.id);
      const bDone =
        b.autoCompleted ||
        workspace.guideSettings.completedActionIds.includes(b.id);
      if (aDone === bDone) return 0;
      return aDone ? 1 : -1;
    });
  }, [coachingActions, workspace.guideSettings.completedActionIds]);

  const budgetUtilizationPct =
    totalMonthlyBudgetLimit > 0
      ? (totalMonthlyBudgetSpent / totalMonthlyBudgetLimit) * 100
      : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Greeting & Quick Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#1E8A78]">
            Welcome, {user?.name ?? 'Member'} · Period {currentMonthKey}
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
            Financial Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-[#425466]">
            Your entire financial life, elevated—built exclusively from the records you enter.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button variant="outline" onClick={() => onNavigate('reports')}>
            <span>View Reports</span>
          </Button>
          <Button variant="secondary" onClick={() => onNavigate('flow')}>
            <Plus className="w-4 h-4" />
            <span>Log Income or Expense</span>
          </Button>
        </div>
      </div>

      {/* Primary KPI Strip: Income, Expenses, Budget Status, Net Position */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[#142A3B]/10">
          <div className="sm:pr-4">
            <StatMetric
              label="This Month Income"
              value={
                hasIncomeThisMonth
                  ? formatCurrency(monthlyIncome, currency)
                  : '—'
              }
              tone={hasIncomeThisMonth ? 'teal' : 'default'}
              detail={
                hasIncomeThisMonth
                  ? `Recorded inflows for ${currentMonthKey}`
                  : 'No income logged this month'
              }
            />
          </div>

          <div className="pt-5 sm:pt-0 sm:px-4">
            <StatMetric
              label="This Month Expenses"
              value={
                hasExpensesThisMonth
                  ? formatCurrency(monthlyExpenses, currency)
                  : '—'
              }
              detail={
                hasIncomeThisMonth || hasExpensesThisMonth
                  ? `Net flow ${formatCurrency(monthlyNetFlow, currency)} (${formatPercent(monthlySavingsRatePct)} saved)`
                  : 'No expenses logged this month'
              }
            />
          </div>

          <div className="pt-5 lg:pt-0 lg:px-4">
            <StatMetric
              label="Budget Status"
              value={
                workspace.budgets.length > 0
                  ? `${Math.round(budgetUtilizationPct)}% used`
                  : '—'
              }
              tone={
                workspace.budgets.length === 0
                  ? 'default'
                  : budgetUtilizationPct > 100
                    ? 'negative'
                    : budgetUtilizationPct >= 85
                      ? 'gold'
                      : 'teal'
              }
              detail={
                workspace.budgets.length > 0
                  ? `${formatCurrency(totalMonthlyBudgetSpent, currency)} of ${formatCurrency(totalMonthlyBudgetLimit, currency)} budgeted`
                  : 'No category budgets configured'
              }
            />
          </div>

          <div className="pt-5 lg:pt-0 lg:pl-4">
            <StatMetric
              label="Tracked Net Position"
              value={
                workspace.accounts.length > 0 || workspace.holdings.length > 0
                  ? formatCurrency(totalTrackedNetWorth, currency)
                  : '—'
              }
              detail={
                workspace.holdings.length > 0
                  ? `Includes ${formatCurrency(totalPortfolioValue, currency)} investments`
                  : 'Add accounts or holdings to track'
              }
            />
          </div>
        </div>
      </Card>

      {/* Income vs. Expenses & Next-Action Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Income & Expenses Card */}
        <Card className="lg:col-span-7">
          <CardHeader
            title="Income & Expenses"
            subtitle="Monthly cash flow derived from Elevate Flow"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('flow')}
              >
                <span>Open Flow</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            }
          />
          {monthlySeries.length > 0 ? (
            <CashFlowBarChart data={monthlySeries} currency={currency} />
          ) : (
            <EmptyState
              icon={<ArrowUpRight className="w-5 h-5" />}
              title="No income or expenses recorded yet"
              description="Add your real income deposits and expenses in Elevate Flow to monitor monthly cash flow and savings rate."
              actionLabel="Record First Entry"
              onAction={() => onNavigate('flow')}
            />
          )}
        </Card>

        {/* Next-Action Area */}
        <Card className="lg:col-span-5">
          <CardHeader
            title="Next Actions"
            subtitle="Recommended setup and follow-ups from your workspace"
          />
          <ul className="divide-y divide-[#142A3B]/8">
            {orderedActions.slice(0, 5).map((item) => {
              const done =
                item.autoCompleted ||
                workspace.guideSettings.completedActionIds.includes(item.id);
              return (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-[#1E8A78] mt-0.5 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-[#D5A64A] mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-[#627384]">
                          {item.pillar} ·{' '}
                          {done ? 'Complete' : `${item.priority} priority`}
                        </p>
                        <p
                          className={`text-sm font-medium mt-0.5 ${
                            done
                              ? 'text-[#627384] line-through'
                              : 'text-[#142A3B]'
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="text-xs text-[#425466] mt-0.5 leading-relaxed">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                    {!done && (
                      <button
                        type="button"
                        onClick={() => onNavigate(item.targetView)}
                        className="min-h-[36px] px-2.5 py-1 text-xs font-semibold text-[#1E8A78] hover:text-[#142A3B] whitespace-nowrap shrink-0 cursor-pointer rounded-lg hover:bg-[#F7F9FA]"
                      >
                        {item.ctaLabel}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Budget Status, Goals, Upcoming Renewals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget Status */}
        <Card>
          <CardHeader
            title="Budget Status"
            subtitle={`Category limits for ${currentMonthKey}`}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('flow')}
              >
                Manage
              </Button>
            }
          />
          {workspace.budgets.length > 0 ? (
            <div className="space-y-4">
              {workspace.budgets.slice(0, 4).map((b) => {
                const spent =
                  currentMonthSpendByCat.get(b.category.toLowerCase()) ?? 0;
                const pct =
                  b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
                const over = spent > b.monthlyLimit;
                const near = !over && pct >= 85;
                const barColor = over
                  ? 'bg-[#B42318]'
                  : near
                    ? 'bg-[#D5A64A]'
                    : 'bg-[#1E8A78]';

                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-[#142A3B] truncate">
                        {b.category}
                      </span>
                      <span className="font-mono tabular-nums text-[#425466] shrink-0">
                        {formatCurrency(spent, currency)} /{' '}
                        {formatCurrency(b.monthlyLimit, currency)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#EEF2F5] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Wallet className="w-5 h-5" />}
              title="No budgets configured"
              description="Set monthly spending limits in Elevate Flow to monitor category pacing."
              actionLabel="Set Budgets"
              onAction={() => onNavigate('flow')}
            />
          )}
        </Card>

        {/* Savings Goals */}
        <Card>
          <CardHeader
            title="Goals"
            subtitle="Savings milestones from Elevate Guide"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('guide')}
              >
                Manage
              </Button>
            }
          />
          {workspace.goals.length > 0 ? (
            <ul className="space-y-4">
              {workspace.goals.slice(0, 4).map((g) => {
                const pct =
                  g.targetAmount > 0
                    ? (g.currentSaved / g.targetAmount) * 100
                    : 0;
                return (
                  <li
                    key={g.id}
                    className="flex items-center justify-between gap-3 pb-3 border-b border-[#142A3B]/8 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <GoalProgressRing
                        percent={pct}
                        size={44}
                        strokeWidth={4}
                        color={pct >= 100 ? '#1E8A78' : '#142A3B'}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#142A3B] truncate">
                          {g.title}
                        </p>
                        <p className="text-xs font-mono tabular-nums text-[#425466]">
                          {formatCurrency(g.currentSaved, currency)} /{' '}
                          {formatCurrency(g.targetAmount, currency)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<Target className="w-5 h-5" />}
              title="No savings goals yet"
              description="Define emergency fund or major purchase goals in Elevate Guide."
              actionLabel="Add Goal"
              onAction={() => onNavigate('guide')}
            />
          )}
        </Card>

        {/* Upcoming Renewals */}
        <Card>
          <CardHeader
            title="Upcoming Renewals"
            subtitle="Policy dates from Elevate Secure"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('secure')}
              >
                Manage
              </Button>
            }
          />
          {sortedRenewals.length > 0 ? (
            <ul className="divide-y divide-[#142A3B]/8">
              {sortedRenewals.slice(0, 4).map((pol) => {
                const soon = pol.daysRemaining <= 60;
                return (
                  <li
                    key={pol.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#142A3B] truncate">
                        {pol.policyName}
                      </p>
                      <p className="text-xs text-[#627384] truncate">
                        {pol.provider} · {pol.category}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          soon ? 'text-[#946C1B]' : 'text-[#425466]'
                        }`}
                      >
                        <CalendarClock className="w-3.5 h-3.5" />
                        <span>
                          {pol.daysRemaining <= 0
                            ? 'Due'
                            : `${pol.daysRemaining}d`}
                        </span>
                      </p>
                      <p className="text-[11px] font-mono tabular-nums text-[#627384]">
                        {formatDateShort(pol.renewalDate)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<ShieldCheck className="w-5 h-5" />}
              title="No insurance policies logged"
              description="Add your policy records in Elevate Secure to monitor upcoming renewal dates."
              actionLabel="Add Policy"
              onAction={() => onNavigate('secure')}
            />
          )}
        </Card>
      </div>

      {/* Connected Pillars Shortcut Strip */}
      <Card>
        <CardHeader
          title="Explore Connected Pillars"
          subtitle="Jump into detailed tracking for investments, coaching, or cross-pillar reports"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              id: 'flow' as NavViewId,
              title: 'Elevate Flow',
              desc: `${workspace.accounts.length} account(s) · ${workspace.transactions.length} entries`,
              icon: Wallet,
            },
            {
              id: 'guide' as NavViewId,
              title: 'Elevate Guide',
              desc: `${workspace.goals.length} goal(s) · Runway planner`,
              icon: Target,
            },
            {
              id: 'wealth' as NavViewId,
              title: 'Elevate Wealth',
              desc: `${workspace.holdings.length} holding(s) · ${formatCurrency(totalPortfolioValue, currency)}`,
              icon: TrendingUp,
            },
            {
              id: 'secure' as NavViewId,
              title: 'Elevate Secure',
              desc: `${workspace.policies.length} polic${workspace.policies.length === 1 ? 'y' : 'ies'} documented`,
              icon: ShieldCheck,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="p-4 rounded-xl border border-[#142A3B]/10 bg-[#F7F9FA]/70 hover:bg-white hover:border-[#1E8A78]/50 text-left transition-colors flex items-start gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78]"
              >
                <Icon className="w-4 h-4 text-[#1E8A78] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#142A3B]">
                    {item.title}
                  </p>
                  <p className="text-xs text-[#627384] mt-0.5 truncate">
                    {item.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
