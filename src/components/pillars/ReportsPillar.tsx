import React, { useMemo, useState } from 'react';
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
  formatMonthLong,
  formatPercent,
  getMonthKey,
  getTodayISO,
  shiftMonthKey,
} from '../../utils/format';
import { Card, CardHeader } from '../ui/Card';
import { StatMetric } from '../ui/StatMetric';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorBanner } from '../ui/FeedbackStates';
import { ProFeatureGate } from '../ui/ProFeatureGate';
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
    currentMonthKey,
    totalCashAssets,
    netCashBalance,
    totalPortfolioValue,
    totalPortfolioCost,
    portfolioUnrealizedGain,
    portfolioReturnPct,
    totalTrackedNetWorth,
    annualInsurancePremiums,
    monthlyRecurringTotal,
    entitlements,
    requestAuthorizedReportExport,
  } = useElevate();

  const currency = workspace.currency;
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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

  const archivedPolicyCount = useMemo(
    () => workspace.policies.filter((p) => p.status === 'Archived').length,
    [workspace.policies]
  );

  const insuranceByCategory = useMemo(() => {
    const grouped = new Map<string, { count: number; annual: number; coverage: number }>();
    for (const p of workspace.policies) {
      if (p.status === 'Archived') continue;
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

  // Pro: 3-month forecast strictly from entered averages & active recurring bills
  const forecastSummary = useMemo(() => {
    const recent = monthlySummary.slice(-6);
    const monthsCount = recent.length;
    const avgIncome =
      monthsCount > 0
        ? recent.reduce((s, m) => s + m.income, 0) / monthsCount
        : 0;
    const avgTxExpense =
      monthsCount > 0
        ? recent.reduce((s, m) => s + m.expenses, 0) / monthsCount
        : 0;
    const estOutflow = avgTxExpense > 0 ? avgTxExpense : monthlyRecurringTotal;
    const estNet = avgIncome - estOutflow;
    return {
      monthsCount,
      avgIncome,
      estOutflow,
      estNet,
      hasData:
        workspace.transactions.length > 0 ||
        workspace.recurringBills.some((b) => b.active),
      projected: [1, 2, 3].map((offset) => ({
        monthKey: shiftMonthKey(currentMonthKey, offset),
        endingCash: netCashBalance + estNet * offset,
      })),
    };
  }, [
    monthlySummary,
    monthlyRecurringTotal,
    workspace.transactions.length,
    workspace.recurringBills,
    currentMonthKey,
    netCashBalance,
  ]);

  const runServerGatedExport = async (
    reportType: string,
    fn: () => void,
    successMsg: string
  ) => {
    setExportError(null);
    setExportSuccess(null);
    setIsExporting(true);
    try {
      const authRes = await requestAuthorizedReportExport(reportType);
      if (!authRes.ok) {
        setExportError(
          authRes.error ||
            'Downloadable reports require Elevate Pro (₹199/month).'
        );
        return;
      }
      fn();
      setExportSuccess(successMsg);
    } finally {
      setIsExporting(false);
    }
  };

  const exportTransactionsCSV = () => {
    void runServerGatedExport(
      'reports_ledger_csv',
      () =>
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
        ),
      `Downloaded ${workspace.transactions.length} Flow ledger row(s) as CSV.`
    );
  };

  const exportHoldingsCSV = () => {
    void runServerGatedExport(
      'reports_holdings_csv',
      () =>
        downloadCSV(
          `elevate-holdings-report-${getTodayISO()}.csv`,
          [
            'Holding',
            'Ticker',
            'Asset Class',
            'Account',
            'Units',
            'Cost Basis',
            'Confirmed Value',
            'Valued At',
          ],
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
        ),
      `Downloaded ${workspace.holdings.length} Wealth holding(s) as CSV.`
    );
  };

  const exportPoliciesCSV = () => {
    void runServerGatedExport(
      'reports_policies_csv',
      () =>
        downloadCSV(
          `elevate-policies-report-${getTodayISO()}.csv`,
          [
            'Policy Name',
            'Provider',
            'Category',
            'Status',
            'Coverage Limit',
            'Deductible',
            'Premium',
            'Cadence',
            'Renewal Date',
          ],
          workspace.policies.map((p) => [
            p.policyName,
            p.provider,
            p.category,
            p.status,
            p.coverageLimit,
            p.deductible,
            p.premiumAmount,
            p.premiumCadence,
            p.renewalDate,
          ])
        ),
      `Downloaded ${workspace.policies.length} Secure policy record(s) as CSV.`
    );
  };

  const exportConsolidatedSummaryCSV = () => {
    void runServerGatedExport(
      'reports_consolidated_summary_csv',
      () =>
        downloadCSV(
          `elevate-consolidated-summary-${getTodayISO()}.csv`,
          ['Pillar', 'Metric', 'Value', 'Currency / Unit', 'Source'],
          [
            ['Flow', 'Cash Assets', totalCashAssets, currency, 'Manual accounts'],
            ['Flow', 'Net Cash Balance', netCashBalance, currency, 'Manual accounts'],
            ['Flow', 'Total Logged Income', totalIncomeLogged, currency, 'Flow ledger'],
            ['Flow', 'Total Logged Expenses', totalExpensesLogged, currency, 'Flow ledger'],
            ['Flow', 'Monthly Recurring Commitments', monthlyRecurringTotal, currency, 'Recurring bills'],
            ['Wealth', 'Manual Portfolio Value', totalPortfolioValue, currency, 'Manual holdings'],
            ['Wealth', 'Manual Cost Basis', totalPortfolioCost, currency, 'Manual holdings'],
            ['Wealth', 'Combined Tracked Net Worth', totalTrackedNetWorth, currency, 'Flow + Wealth'],
            ['Secure', 'Active & Logged Policies', workspace.policies.length, 'count', 'Secure register'],
            ['Secure', 'Annualized Insurance Premiums', annualInsurancePremiums, currency, 'Secure register'],
            ['Guide', 'Tracked Goals (Guide + Wealth)', workspace.goals.length + workspace.investmentGoals.length, 'count', 'Manual goals'],
          ]
        ),
      'Downloaded consolidated cross-pillar financial summary CSV.'
    );
  };

  const hasAnyWorkspaceData =
    workspace.accounts.length > 0 ||
    workspace.transactions.length > 0 ||
    workspace.holdings.length > 0 ||
    workspace.policies.length > 0;

  return (
    <div className="space-y-6 sm:space-y-8">
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
      {exportSuccess && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#1E8A78]/10 border border-[#1E8A78]/25 text-xs sm:text-sm text-[#142A3B]">
          <span className="font-medium">{exportSuccess}</span>
          <button
            type="button"
            onClick={() => setExportSuccess(null)}
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
            variant="secondary"
            size="sm"
            disabled={!hasAnyWorkspaceData || isExporting}
            onClick={exportConsolidatedSummaryCSV}
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {entitlements.downloadableReports ? 'Summary CSV' : 'Summary CSV (Pro)'}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={workspace.transactions.length === 0 || isExporting}
            onClick={exportTransactionsCSV}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ledger CSV</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={workspace.holdings.length === 0 || isExporting}
            onClick={exportHoldingsCSV}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Holdings CSV</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={workspace.policies.length === 0 || isExporting}
            onClick={exportPoliciesCSV}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Policies CSV</span>
          </Button>
        </div>
      </div>

      {!entitlements.downloadableReports && (
        <ProFeatureGate
          title="Downloadable Financial Reports & Forecasting"
          description="On-screen reports are visible on all plans. Server-authorized CSV report exports, 3-month cash-flow forecasting, and full Pro summaries unlock on Elevate Pro (₹199/month)."
          onComparePlans={() => onNavigate('plans')}
        />
      )}

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
              detail={`Net cash: ${formatCurrency(netCashBalance, currency)} (Cash assets ${formatCurrency(totalCashAssets, currency)})`}
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
          subtitle={
            archivedPolicyCount > 0
              ? `Annualized active obligations by category (${archivedPolicyCount} archived policy record(s) excluded)`
              : 'Annualized active obligations by coverage category'
          }
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

      {/* Pro: 3-Month Cash-Flow Forecast & Insights Rollup */}
      {entitlements.cashFlowForecasting ? (
        <Card>
          <CardHeader
            title="Cash-Flow Forecast Rollup (Pro)"
            subtitle="3-month cash balance trajectory computed strictly from your logged Flow averages"
          />
          {forecastSummary.hasData ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10">
                <p className="text-xs text-[#627384]">Baseline Monthly Net</p>
                <p
                  className={`mt-1 text-lg font-bold font-mono tabular-nums ${
                    forecastSummary.estNet >= 0
                      ? 'text-[#1E8A78]'
                      : 'text-[#B42318]'
                  }`}
                >
                  {forecastSummary.estNet >= 0 ? '+' : ''}
                  {formatCurrency(forecastSummary.estNet, currency)}/mo
                </p>
                <p className="text-[11px] text-[#627384] mt-1">
                  Based on {forecastSummary.monthsCount} logged month(s)
                </p>
              </div>
              {forecastSummary.projected.map((item) => (
                <div
                  key={item.monthKey}
                  className="p-4 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10"
                >
                  <p className="text-xs text-[#627384]">
                    {formatMonthLong(item.monthKey)}
                  </p>
                  <p className="mt-1 text-lg font-bold font-mono tabular-nums text-[#142A3B]">
                    {formatCurrency(item.endingCash, currency)}
                  </p>
                  <p className="text-[11px] text-[#627384] mt-1">
                    Projected net cash
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<BarChart3 className="w-5 h-5" />}
              title="No Flow data for forecasting"
              description="Log transactions or recurring bills in Elevate Flow to project your 3-month cash trajectory."
              actionLabel="Open Flow"
              onAction={() => onNavigate('flow')}
            />
          )}
        </Card>
      ) : (
        <ProFeatureGate
          title="Cross-Pillar Cash-Flow Forecast Rollup"
          description="Project 3-month ending cash trajectories from your recorded income, expenses, and recurring bills on Elevate Pro (₹199/month)."
          onComparePlans={() => onNavigate('plans')}
        />
      )}
    </div>
  );
}
