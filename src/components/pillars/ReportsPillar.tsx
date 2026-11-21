import React, { useMemo } from 'react';
import {
  BarChart3,
  Download,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { NavViewId } from '../../types/finance';
import { useElevate } from '../../context/ElevateContext';
import {
  annualizePremium,
  downloadCSV,
  formatCurrency,
  formatMonthLabel,
  formatPercent,
  getMonthKey,
  getTodayISO,
} from '../../utils/format';
import { Card, CardHeader } from '../ui/Card';
import { StatMetric } from '../ui/StatMetric';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { CashFlowBarChart, MonthlyFlowDatum } from '../charts/CashFlowBarChart';
import {
  AllocationDonutChart,
  ELEVATE_CHART_PALETTE,
} from '../charts/AllocationDonutChart';
import { NetWorthTimelineChart } from '../charts/NetWorthTimelineChart';

interface ReportsPillarProps {
  onNavigate: (view: NavViewId) => void;
}

export function ReportsPillar({ onNavigate }: ReportsPillarProps) {
  const {
    workspace,
    totalCashAssets,
    totalPortfolioValue,
    totalPortfolioCost,
    portfolioUnrealizedGain,
    portfolioReturnPct,
    totalTrackedNetWorth,
    annualInsurancePremiums,
  } = useElevate();

  const currency = workspace.currency;

  const monthlySummary = useMemo(() => {
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
      .map(([monthKey, vals]) => ({
        monthKey,
        income: vals.income,
        expenses: vals.expenses,
        net: vals.income - vals.expenses,
        savingsRate:
          vals.income > 0 ? ((vals.income - vals.expenses) / vals.income) * 100 : 0,
      }));
  }, [workspace.transactions]);

  const chartSeries: MonthlyFlowDatum[] = useMemo(
    () =>
      monthlySummary.slice(-6).map((m) => ({
        monthKey: m.monthKey,
        income: m.income,
        expenses: m.expenses,
      })),
    [monthlySummary]
  );

  const allTimeExpenseSlices = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const tx of workspace.transactions) {
      if (tx.type === 'expense') {
        grouped.set(tx.category, (grouped.get(tx.category) ?? 0) + tx.amount);
      }
    }
    return Array.from(grouped.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value], i) => ({
        label,
        value,
        color: ELEVATE_CHART_PALETTE[i % ELEVATE_CHART_PALETTE.length],
      }));
  }, [workspace.transactions]);

  const wealthSlices = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const h of workspace.holdings) {
      grouped.set(h.assetClass, (grouped.get(h.assetClass) ?? 0) + h.currentValue);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({
        label,
        value,
        color: ELEVATE_CHART_PALETTE[i % ELEVATE_CHART_PALETTE.length],
      }));
  }, [workspace.holdings]);

  const insuranceByCategory = useMemo(() => {
    const grouped = new Map<string, { count: number; annual: number; coverage: number }>();
    for (const p of workspace.policies) {
      const curr = grouped.get(p.category) ?? { count: 0, annual: 0, coverage: 0 };
      curr.count += 1;
      curr.annual += annualizePremium(p.premiumAmount, p.premiumCadence);
      curr.coverage += p.coverageLimit;
      grouped.set(p.category, curr);
    }
    return Array.from(grouped.entries()).map(([category, vals]) => ({
      category,
      ...vals,
    }));
  }, [workspace.policies]);

  const totalIncomeLogged = monthlySummary.reduce((s, m) => s + m.income, 0);
  const totalExpensesLogged = monthlySummary.reduce((s, m) => s + m.expenses, 0);

  const exportTransactionsCSV = () => {
    downloadCSV(
      `elevate-transactions-report-${getTodayISO()}.csv`,
      ['Date', 'Description', 'Category', 'Type', 'Bucket', 'Amount'],
      workspace.transactions.map((t) => [
        t.date,
        t.description,
        t.category,
        t.type,
        t.bucket ?? '',
        t.type === 'expense' ? -t.amount : t.amount,
      ])
    );
  };

  const exportHoldingsCSV = () => {
    downloadCSV(
      `elevate-holdings-report-${getTodayISO()}.csv`,
      ['Holding', 'Ticker', 'Asset Class', 'Account', 'Units', 'Cost Basis', 'Confirmed Value', 'Valued At'],
      workspace.holdings.map((h) => [
        h.name,
        h.symbol ?? '',
        h.assetClass,
        h.accountLabel,
        h.units,
        h.costBasis,
        h.currentValue,
        h.valuedAt,
      ])
    );
  };

  const exportPoliciesCSV = () => {
    downloadCSV(
      `elevate-policies-report-${getTodayISO()}.csv`,
      ['Policy Name', 'Provider', 'Category', 'Coverage Limit', 'Deductible', 'Premium', 'Cadence', 'Renewal Date'],
      workspace.policies.map((p) => [
        p.policyName,
        p.provider,
        p.category,
        p.coverageLimit,
        p.deductible,
        p.premiumAmount,
        p.premiumCadence,
        p.renewalDate,
      ])
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#1E8A78]">
            Cross-Pillar Analytics & Statements
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
            Financial Reports
          </h1>
          <p className="mt-1.5 text-sm text-[#425466]">
            Consolidated summaries compiled strictly from your logged Flow, Wealth, and Secure records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled={workspace.transactions.length === 0}
            onClick={exportTransactionsCSV}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ledger CSV</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={workspace.holdings.length === 0}
            onClick={exportHoldingsCSV}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Holdings CSV</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={workspace.policies.length === 0}
            onClick={exportPoliciesCSV}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Policies CSV</span>
          </Button>
        </div>
      </div>

      {/* Consolidated Totals */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[#142A3B]/10">
          <div className="sm:pr-4">
            <StatMetric
              label="Total Logged Income"
              value={
                workspace.transactions.length > 0
                  ? formatCurrency(totalIncomeLogged, currency)
                  : '—'
              }
              tone="teal"
              detail={`${monthlySummary.length} active month(s)`}
            />
          </div>
          <div className="pt-5 sm:pt-0 sm:px-4">
            <StatMetric
              label="Total Logged Expenses"
              value={
                workspace.transactions.length > 0
                  ? formatCurrency(totalExpensesLogged, currency)
                  : '—'
              }
              detail={`Cash assets: ${formatCurrency(totalCashAssets, currency)}`}
            />
          </div>
          <div className="pt-5 lg:pt-0 lg:px-4">
            <StatMetric
              label="Portfolio Return vs. Cost"
              value={
                workspace.holdings.length > 0
                  ? formatCurrency(portfolioUnrealizedGain, currency)
                  : '—'
              }
              tone={
                portfolioUnrealizedGain > 0
                  ? 'teal'
                  : portfolioUnrealizedGain < 0
                    ? 'negative'
                    : 'default'
              }
              detail={
                workspace.holdings.length > 0
                  ? `${formatPercent(portfolioReturnPct, true)} on ${formatCurrency(totalPortfolioCost, currency)} cost`
                  : 'No holdings entered'
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
              detail={`Annual insurance: ${formatCurrency(annualInsurancePremiums, currency)}`}
            />
          </div>
        </div>
      </Card>

      {/* Cash Flow Statement & Category Spend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Monthly Cash Flow Summary"
            subtitle="Income vs. expenses across recorded months"
          />
          {chartSeries.length > 0 ? (
            <CashFlowBarChart data={chartSeries} currency={currency} />
          ) : (
            <EmptyState
              icon={<BarChart3 className="w-5 h-5" />}
              title="No cash flow data to chart"
              description="Record income and expenses in Elevate Flow to generate monthly cash flow comparisons."
              actionLabel="Open Flow"
              onAction={() => onNavigate('flow')}
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Top Spending Categories"
            subtitle="Cumulative expenses by category"
          />
          {allTimeExpenseSlices.length > 0 ? (
            <AllocationDonutChart
              slices={allTimeExpenseSlices}
              currency={currency}
              centerLabel="Expenses"
            />
          ) : (
            <EmptyState
              icon={<Wallet className="w-5 h-5" />}
              title="No expense categories logged"
              description="Once you log expenses in Elevate Flow, your top spending categories appear here."
              actionLabel="Log Expense"
              onAction={() => onNavigate('flow')}
            />
          )}
        </Card>
      </div>

      {/* Monthly Statement Table */}
      <Card>
        <CardHeader
          title="Monthly Ledger Statement"
          subtitle="Period-by-period cash flow and savings rate"
        />
        {monthlySummary.length > 0 ? (
          <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
            <table className="w-full text-left border-collapse min-w-[520px]">
              <thead>
                <tr className="border-b border-[#142A3B]/10 text-xs font-medium text-[#627384]">
                  <th className="py-2.5 pr-4">Month</th>
                  <th className="py-2.5 pr-4 text-right">Income</th>
                  <th className="py-2.5 pr-4 text-right">Expenses</th>
                  <th className="py-2.5 pr-4 text-right">Net Flow</th>
                  <th className="py-2.5 text-right">Savings Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#142A3B]/8 text-sm">
                {[...monthlySummary].reverse().map((m) => (
                  <tr key={m.monthKey} className="hover:bg-[#F7F9FA]/70">
                    <td className="py-3 pr-4 font-medium text-[#142A3B]">
                      {formatMonthLabel(m.monthKey)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-[#1E8A78]">
                      {formatCurrency(m.income, currency)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-[#142A3B]">
                      {formatCurrency(m.expenses, currency)}
                    </td>
                    <td
                      className={`py-3 pr-4 text-right font-mono tabular-nums font-semibold ${
                        m.net >= 0 ? 'text-[#1E8A78]' : 'text-[#B42318]'
                      }`}
                    >
                      {formatCurrency(m.net, currency)}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums text-[#425466]">
                      {m.income > 0 ? formatPercent(m.savingsRate) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<BarChart3 className="w-5 h-5" />}
            title="No monthly statement rows yet"
            description="Your monthly statement table populates automatically as you record transactions in Flow."
          />
        )}
      </Card>

      {/* Wealth Allocation & Net Worth Snapshots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Investment Allocation Report"
            subtitle={`Confirmed value: ${formatCurrency(totalPortfolioValue, currency)}`}
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
              description="Record holdings in Elevate Wealth to include asset allocation in your reports."
              actionLabel="Open Wealth"
              onAction={() => onNavigate('wealth')}
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Net Worth Snapshot Progression"
            subtitle="User-recorded valuation checkpoints"
          />
          {workspace.snapshots.length > 0 ? (
            <NetWorthTimelineChart
              snapshots={workspace.snapshots}
              currency={currency}
            />
          ) : (
            <EmptyState
              icon={<TrendingUp className="w-5 h-5" />}
              title="No net worth snapshots recorded"
              description="Capture point-in-time snapshots in Elevate Wealth to plot net worth progress."
              actionLabel="Open Wealth"
              onAction={() => onNavigate('wealth')}
            />
          )}
        </Card>
      </div>

      {/* Insurance Cost Summary */}
      <Card>
        <CardHeader
          title="Insurance Protection & Premium Summary"
          subtitle="Annualized obligations by coverage category"
        />
        {insuranceByCategory.length > 0 ? (
          <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
            <table className="w-full text-left border-collapse min-w-[480px]">
              <thead>
                <tr className="border-b border-[#142A3B]/10 text-xs font-medium text-[#627384]">
                  <th className="py-2.5 pr-4">Category</th>
                  <th className="py-2.5 pr-4 text-right">Policies</th>
                  <th className="py-2.5 pr-4 text-right">Coverage Limit</th>
                  <th className="py-2.5 text-right">Annualized Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#142A3B]/8 text-sm">
                {insuranceByCategory.map((row) => (
                  <tr key={row.category} className="hover:bg-[#F7F9FA]/70">
                    <td className="py-3 pr-4 font-medium text-[#142A3B]">
                      {row.category}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-[#425466]">
                      {row.count}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-[#142A3B]">
                      {formatCurrency(row.coverage, currency)}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums font-semibold text-[#946C1B]">
                      {formatCurrency(row.annual, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<ShieldCheck className="w-5 h-5" />}
            title="No insurance policies logged"
            description="Document policies in Elevate Secure to review total protection limits and annualized premium costs."
            actionLabel="Open Secure"
            onAction={() => onNavigate('secure')}
          />
        )}
      </Card>
    </div>
  );
}
