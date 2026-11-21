import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CreditCard,
  Info,
  Minus,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useElevate } from '../../context/ElevateContext';
import { formatDateShort } from '../../utils/format';
import { Card, CardHeader } from '../ui/Card';
import { StatMetric } from '../ui/StatMetric';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/FeedbackStates';

interface ComparisonRow {
  category: string;
  feature: string;
  basic: string;
  pro: string;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    category: 'Core & Ledger',
    feature: 'Core Dashboard',
    basic: 'Included',
    pro: 'Included',
  },
  {
    category: 'Core & Ledger',
    feature: 'Manual Flow Tracking & Recurring Bills',
    basic: 'Included',
    pro: 'Included',
  },
  {
    category: 'Core & Ledger',
    feature: 'Category Budgets',
    basic: 'Basic (up to 4 categories)',
    pro: 'Unlimited categories',
  },
  {
    category: 'Flow Insights',
    feature: 'Advanced Spending Insights',
    basic: 'Not included',
    pro: 'Included (MoM delta & concentration)',
  },
  {
    category: 'Flow Insights',
    feature: 'Cash-Flow Forecasting',
    basic: 'Not included',
    pro: 'Included (from entered data)',
  },
  {
    category: 'Guide & Goals',
    feature: 'Savings & Investment Goals',
    basic: 'Up to 3 goals total',
    pro: 'Unlimited goals',
  },
  {
    category: 'Guide & Goals',
    feature: 'Guide AI Questions (Server Quota)',
    basic: 'Limited (5 / month)',
    pro: 'Higher fair-use (50 / month)',
  },
  {
    category: 'Guide & Goals',
    feature: 'Scenario Comparisons',
    basic: 'Not included',
    pro: 'Included (Scenario Lab & AI)',
  },
  {
    category: 'Wealth',
    feature: 'Manual Wealth Holdings & Cost Basis',
    basic: 'Included',
    pro: 'Included',
  },
  {
    category: 'Wealth',
    feature: 'Richer Portfolio Analysis & Net Worth Timeline',
    basic: 'Not included',
    pro: 'Included (Target drift & snapshots)',
  },
  {
    category: 'Secure',
    feature: 'Policy Records & Renewal Reminders',
    basic: 'Included',
    pro: 'Included',
  },
  {
    category: 'Secure',
    feature: 'Coverage & Deductible Summaries',
    basic: 'Not included',
    pro: 'Included',
  },
  {
    category: 'Reports',
    feature: 'Downloadable Reports & CSV Exports',
    basic: 'On-screen view only',
    pro: 'Included (Server-authorized)',
  },
];

export function PlansPillar() {
  const {
    entitlement,
    entitlements,
    entitlementLoading,
    entitlementError,
    clearEntitlementError,
    totalGoalsCount,
    workspace,
    changeSubscriptionPlan,
    cancelOrReactivatePlan,
    refreshEntitlement,
  } = useElevate();

  const [downgradeConfirmOpen, setDowngradeConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const currentPlan = entitlement?.plan ?? 'basic';
  const status = entitlement?.status ?? 'active';
  const aiUsed = entitlement?.aiQuestionsUsed ?? 0;
  const aiLimit = entitlement?.aiQuestionsLimit ?? entitlements.aiMonthlyQuota;

  const statusLabel = (() => {
    switch (status) {
      case 'downgrade_scheduled':
        return 'Downgrade Scheduled';
      case 'canceled':
        return 'Canceled (Period-End)';
      case 'ended':
        return 'Ended';
      default:
        return 'Active';
    }
  })();

  const handleUpgradeToPro = async () => {
    setStatusFeedback(null);
    const res = await changeSubscriptionPlan('pro', 'immediate');
    if (res.ok) {
      setDowngradeConfirmOpen(false);
      setCancelConfirmOpen(false);
      setStatusFeedback(
        'Elevate Pro (₹199/month) server entitlements are now active in preview mode. No live payment was processed.'
      );
    }
  };

  const handleDowngradeToBasic = async (timing: 'period_end' | 'immediate') => {
    setStatusFeedback(null);
    const res = await changeSubscriptionPlan('basic', timing);
    if (res.ok) {
      setDowngradeConfirmOpen(false);
      setStatusFeedback(
        timing === 'period_end'
          ? `Downgrade to Elevate Basic (₹99/month) scheduled for ${formatDateShort(entitlement?.currentPeriodEnd ?? '')}. Pro entitlements remain active until then.`
          : 'Switched to Elevate Basic (₹99/month) server entitlements immediately in preview mode.'
      );
    }
  };

  const handleCancel = async (timing: 'period_end' | 'immediate') => {
    setStatusFeedback(null);
    const res = await cancelOrReactivatePlan({ timing });
    if (res.ok) {
      setCancelConfirmOpen(false);
      setStatusFeedback(
        timing === 'period_end'
          ? `Subscription marked canceled; current entitlements stay active until ${formatDateShort(entitlement?.currentPeriodEnd ?? '')}.`
          : 'Subscription ended immediately in preview mode. Pro features and Guide AI are now locked until reactivated.'
      );
    }
  };

  const handleReactivate = async () => {
    setStatusFeedback(null);
    const res = await cancelOrReactivatePlan({ reactivate: true });
    if (res.ok) {
      setCancelConfirmOpen(false);
      setStatusFeedback(
        `Reactivated ${currentPlan === 'pro' ? 'Elevate Pro (₹199/month)' : 'Elevate Basic (₹99/month)'} server entitlements in preview mode.`
      );
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#1E8A78]">
            Plans, Entitlements & Subscription Lifecycle
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
            Elevate Basic & Elevate Pro
          </h1>
          <p className="mt-1.5 text-sm text-[#425466]">
            Compare monthly plans and manage upgrade, downgrade, and cancellation states enforced by the server.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={entitlementLoading}
          onClick={refreshEntitlement}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Entitlements</span>
        </Button>
      </div>

      {/* Explicit Payment Provider Not Integrated Banner */}
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[#D5A64A]/10 border border-[#D5A64A]/40 text-xs text-[#142A3B]">
        <Info className="w-4 h-4 text-[#946C1B] mt-0.5 shrink-0" />
        <p className="leading-relaxed">
          <strong>Billing Preview — Payment Provider Not Integrated:</strong>{' '}
          No payment gateway (card, UPI, or bank billing) is connected yet, and no live payments are charged or claimed. Selecting upgrade, downgrade, or cancel updates your authoritative server-side entitlements for evaluation.
        </p>
      </div>

      {entitlementError && (
        <ErrorBanner message={entitlementError} onDismiss={clearEntitlementError} />
      )}

      {statusFeedback && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#1E8A78]/10 border border-[#1E8A78]/25 text-xs sm:text-sm text-[#142A3B]">
          <span className="font-medium">{statusFeedback}</span>
          <button
            type="button"
            onClick={() => setStatusFeedback(null)}
            className="text-xs font-semibold text-[#1E8A78] hover:underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Current Subscription Status & Usage */}
      <Card>
        <CardHeader
          title="Current Subscription & Server-Enforced Usage"
          subtitle={
            entitlement?.billingNotice ??
            'Authoritative entitlements synced from server session'
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[#142A3B]/10 pb-6 border-b border-[#142A3B]/10">
          <div className="sm:pr-4">
            <StatMetric
              label="Current Plan"
              value={
                status === 'ended'
                  ? 'No Active Plan'
                  : currentPlan === 'pro'
                    ? 'Elevate Pro'
                    : 'Elevate Basic'
              }
              tone={
                status === 'ended'
                  ? 'negative'
                  : currentPlan === 'pro'
                    ? 'teal'
                    : 'default'
              }
              detail={
                status === 'ended'
                  ? `Previously ${currentPlan === 'pro' ? 'Pro' : 'Basic'}`
                  : currentPlan === 'pro'
                    ? '₹199/month · Preview billing'
                    : '₹99/month · Preview billing'
              }
            />
          </div>

          <div className="pt-5 sm:pt-0 sm:px-4">
            <StatMetric
              label="Subscription State"
              value={statusLabel}
              tone={
                status === 'active'
                  ? 'teal'
                  : status === 'ended'
                    ? 'negative'
                    : 'gold'
              }
              detail={
                entitlement?.currentPeriodEnd
                  ? `Cycle end: ${formatDateShort(entitlement.currentPeriodEnd)}`
                  : 'Monthly cycle'
              }
            />
          </div>

          <div className="pt-5 lg:pt-0 lg:px-4">
            <StatMetric
              label="Guide AI Quota Used"
              value={`${aiUsed} / ${aiLimit}`}
              tone={aiLimit > 0 && aiUsed >= aiLimit ? 'gold' : 'default'}
              detail={`Period ${entitlement?.periodKey ?? 'current'}`}
            />
          </div>

          <div className="pt-5 lg:pt-0 lg:pl-4">
            <StatMetric
              label="Goals & Budgets Used"
              value={
                entitlements.maxGoals !== null
                  ? `${totalGoalsCount} / ${entitlements.maxGoals} goals`
                  : `${totalGoalsCount} goals`
              }
              detail={
                entitlements.maxBudgets !== null
                  ? `${workspace.budgets.length} / ${entitlements.maxBudgets} budgets`
                  : `${workspace.budgets.length} budgets · Unlimited`
              }
            />
          </div>
        </div>

        {/* Lifecycle Controls: Upgrade / Downgrade / Keep / Cancel / Reactivate */}
        <div className="pt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {status === 'ended' && (
              <>
                <Button
                  variant="outline"
                  disabled={entitlementLoading}
                  onClick={() => handleDowngradeToBasic('immediate')}
                >
                  <span>Activate Elevate Basic (₹99/mo)</span>
                </Button>
                <Button
                  variant="secondary"
                  disabled={entitlementLoading}
                  onClick={handleUpgradeToPro}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Activate Elevate Pro (₹199/mo)</span>
                </Button>
              </>
            )}

            {status === 'active' && currentPlan === 'basic' && (
              <>
                <Button
                  variant="secondary"
                  disabled={entitlementLoading}
                  onClick={handleUpgradeToPro}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Upgrade to Elevate Pro (₹199/mo)</span>
                </Button>
                <Button
                  variant="outline"
                  disabled={entitlementLoading}
                  onClick={() => {
                    setCancelConfirmOpen((v) => !v);
                    setDowngradeConfirmOpen(false);
                  }}
                >
                  <span>Cancel Subscription</span>
                </Button>
              </>
            )}

            {status === 'active' && currentPlan === 'pro' && (
              <>
                <Button
                  variant="outline"
                  disabled={entitlementLoading}
                  onClick={() => {
                    setDowngradeConfirmOpen((v) => !v);
                    setCancelConfirmOpen(false);
                  }}
                >
                  <ArrowDownRight className="w-4 h-4" />
                  <span>Downgrade to Basic (₹99/mo)</span>
                </Button>
                <Button
                  variant="outline"
                  disabled={entitlementLoading}
                  onClick={() => {
                    setCancelConfirmOpen((v) => !v);
                    setDowngradeConfirmOpen(false);
                  }}
                >
                  <span>Cancel Subscription</span>
                </Button>
              </>
            )}

            {status === 'downgrade_scheduled' && (
              <>
                <Button
                  variant="secondary"
                  disabled={entitlementLoading}
                  onClick={handleUpgradeToPro}
                >
                  <span>Keep Elevate Pro (₹199/mo)</span>
                </Button>
                <Button
                  variant="outline"
                  disabled={entitlementLoading}
                  onClick={() => handleDowngradeToBasic('immediate')}
                >
                  <span>Apply Basic Now (Preview)</span>
                </Button>
                <Button
                  variant="ghost"
                  disabled={entitlementLoading}
                  onClick={() => setCancelConfirmOpen((v) => !v)}
                >
                  <span>Cancel Plan</span>
                </Button>
              </>
            )}

            {status === 'canceled' && (
              <>
                <Button
                  variant="secondary"
                  disabled={entitlementLoading}
                  onClick={handleReactivate}
                >
                  <span>
                    Reactivate {currentPlan === 'pro' ? 'Elevate Pro' : 'Elevate Basic'}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  disabled={entitlementLoading}
                  onClick={() => handleCancel('immediate')}
                >
                  <span>End Access Now (Preview)</span>
                </Button>
              </>
            )}
          </div>

          {/* Downgrade Options Drawer */}
          {downgradeConfirmOpen && (
            <div className="p-4 rounded-xl border border-[#142A3B]/15 bg-[#F7F9FA] space-y-3">
              <p className="text-sm font-semibold text-[#142A3B]">
                Choose how to downgrade from Pro (₹199/mo) to Basic (₹99/mo)
              </p>
              <p className="text-xs text-[#425466] leading-relaxed">
                On Elevate Basic, Guide AI is capped at 5 questions/month, goals cap at 3 new goals (existing goals remain viewable), budgets cap at 4 categories, and Pro insights, forecasting, scenarios, portfolio drift analysis, coverage summaries, and downloadable reports lock.
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={entitlementLoading}
                  onClick={() => handleDowngradeToBasic('period_end')}
                >
                  Schedule at Period End ({formatDateShort(entitlement?.currentPeriodEnd ?? '')})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={entitlementLoading}
                  onClick={() => handleDowngradeToBasic('immediate')}
                >
                  Switch Immediately (Preview)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDowngradeConfirmOpen(false)}
                >
                  Keep Pro
                </Button>
              </div>
            </div>
          )}

          {/* Cancel Options Drawer */}
          {cancelConfirmOpen && (
            <div className="p-4 rounded-xl border border-[#B42318]/25 bg-[#B42318]/6 space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-[#B42318] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#142A3B]">
                    Confirm subscription cancellation
                  </p>
                  <p className="text-xs text-[#425466] mt-0.5 leading-relaxed">
                    Your saved financial records remain intact on your account. Canceling stops renewal at period end or revokes paid AI/Pro entitlements immediately in preview mode.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={entitlementLoading}
                  onClick={() => handleCancel('period_end')}
                >
                  Cancel at Period End
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={entitlementLoading}
                  onClick={() => handleCancel('immediate')}
                >
                  End Access Now (Preview)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCancelConfirmOpen(false)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Side-by-Side Plan Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Elevate Basic */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#425466]">
                  Essential Plan
                </p>
                <h2 className="text-xl font-bold text-[#142A3B] mt-1">
                  Elevate Basic
                </h2>
              </div>
              {status !== 'ended' && currentPlan === 'basic' && (
                <span className="text-xs font-semibold text-[#1E8A78]">
                  Current Plan
                </span>
              )}
            </div>

            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold font-mono tabular-nums text-[#142A3B]">
                ₹99
              </span>
              <span className="text-sm text-[#627384]">/ month</span>
            </div>

            <p className="mt-2 text-sm text-[#425466] leading-relaxed">
              Core dashboard, manual Flow ledger, basic budgets, manual Wealth holdings, up to three goals, Secure policy records & renewal reminders, plus limited Guide AI questions.
            </p>

            <ul className="mt-5 pt-5 border-t border-[#142A3B]/10 space-y-2.5 text-sm text-[#142A3B]">
              {[
                'Core consolidated dashboard',
                'Manual Flow tracking (accounts, transactions, bills)',
                'Basic budgets (up to 4 category limits)',
                'Manual Wealth holdings & cost basis',
                'Up to 3 savings or investment goals',
                'Secure policy records & renewal reminders',
                'Limited Guide AI questions (5 / month)',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#1E8A78] mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 pt-5 border-t border-[#142A3B]/10">
            {status === 'ended' ? (
              <Button
                variant="outline"
                className="w-full"
                disabled={entitlementLoading}
                onClick={() => handleDowngradeToBasic('immediate')}
              >
                <CreditCard className="w-4 h-4" />
                <span>Select Elevate Basic (Preview)</span>
              </Button>
            ) : currentPlan === 'basic' ? (
              <Button variant="outline" className="w-full" disabled>
                <span>Active on Workspace ({statusLabel})</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                disabled={entitlementLoading}
                onClick={() => setDowngradeConfirmOpen(true)}
              >
                <span>Downgrade to Basic (₹99/mo)</span>
              </Button>
            )}
          </div>
        </Card>

        {/* Elevate Pro */}
        <Card className="flex flex-col justify-between border-[#1E8A78]/40">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#1E8A78]">
                  Complete Well-Being Suite
                </p>
                <h2 className="text-xl font-bold text-[#142A3B] mt-1">
                  Elevate Pro
                </h2>
              </div>
              {status !== 'ended' && currentPlan === 'pro' && (
                <span className="text-xs font-semibold text-[#1E8A78]">
                  {status === 'downgrade_scheduled'
                    ? 'Active Until Period End'
                    : 'Current Plan'}
                </span>
              )}
            </div>

            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold font-mono tabular-nums text-[#142A3B]">
                ₹199
              </span>
              <span className="text-sm text-[#627384]">/ month</span>
            </div>

            <p className="mt-2 text-sm text-[#425466] leading-relaxed">
              Adds advanced spending insights, cash-flow forecasting from your entered data, higher fair-use AI allowance, scenario comparisons, richer portfolio analysis, unlimited goals, coverage summaries, and downloadable reports.
            </p>

            <ul className="mt-5 pt-5 border-t border-[#142A3B]/10 space-y-2.5 text-sm text-[#142A3B]">
              {[
                'Everything in Elevate Basic, plus:',
                'Advanced spending insights (MoM deltas & bucket trends)',
                'Cash-flow forecasting strictly from entered data',
                'Higher fair-use Guide AI allowance (50 / month)',
                'Scenario comparisons with visible assumptions',
                'Richer portfolio drift analysis & net worth timeline',
                'Unlimited goals & unlimited category budgets',
                'Cross-category insurance coverage summaries',
                'Downloadable reports & server-verified CSV exports',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#1E8A78] mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 pt-5 border-t border-[#142A3B]/10">
            {currentPlan === 'pro' && status === 'active' ? (
              <Button variant="secondary" className="w-full" disabled>
                <span>Active on Workspace</span>
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="w-full"
                disabled={entitlementLoading}
                onClick={handleUpgradeToPro}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>
                  {status === 'downgrade_scheduled'
                    ? 'Keep Elevate Pro (₹199/mo)'
                    : 'Upgrade to Elevate Pro (₹199/mo)'}
                </span>
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Feature-by-Feature Comparison Matrix */}
      <Card>
        <CardHeader
          title="Feature-by-Feature Plan Comparison"
          subtitle="Clear breakdown of capabilities enforced via server-side entitlements"
        />

        <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-[#142A3B]/12 text-xs font-semibold text-[#627384]">
                <th className="py-3 pr-4">Capability</th>
                <th className="py-3 pr-4">Area</th>
                <th className="py-3 pr-4">Elevate Basic (₹99/mo)</th>
                <th className="py-3">Elevate Pro (₹199/mo)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#142A3B]/8 text-sm">
              {COMPARISON_ROWS.map((row) => {
                const basicMissing =
                  row.basic === 'Not included' ||
                  row.basic === 'On-screen view only';
                return (
                  <tr key={row.feature} className="hover:bg-[#F7F9FA]/70">
                    <td className="py-3 pr-4 font-medium text-[#142A3B]">
                      {row.feature}
                    </td>
                    <td className="py-3 pr-4 text-xs text-[#627384]">
                      {row.category}
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      <span
                        className={`inline-flex items-center gap-1.5 ${
                          basicMissing
                            ? 'text-[#627384]'
                            : 'text-[#142A3B] font-medium'
                        }`}
                      >
                        {basicMissing ? (
                          <Minus className="w-3.5 h-3.5 text-[#627384] shrink-0" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-[#1E8A78] shrink-0" />
                        )}
                        <span>{row.basic}</span>
                      </span>
                    </td>
                    <td className="py-3 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-[#142A3B] font-semibold">
                        <Check className="w-3.5 h-3.5 text-[#1E8A78] shrink-0" />
                        <span>{row.pro}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
