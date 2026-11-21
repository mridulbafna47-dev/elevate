import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Check,
  CheckCircle2,
  Circle,
  Compass,
  Info,
  Lock,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import {
  GuideAskResponse,
  GuideAuthorizationScopes,
  GuidePillarScope,
  MonthlyReviewResponse,
  ProposedGuideAction,
  SavingsGoal,
} from '../../types/finance';
import { useElevate } from '../../context/ElevateContext';
import { formatCurrency, formatPercent, getMonthKey } from '../../utils/format';
import { Card, CardHeader } from '../ui/Card';
import { StatMetric } from '../ui/StatMetric';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ModalSheet } from '../ui/ModalSheet';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ErrorBanner } from '../ui/FeedbackStates';
import { GoalProgressRing } from '../charts/GoalProgressRing';

type GuideTab = 'ask' | 'scenarios' | 'review' | 'runway';

interface ConversationTurn {
  id: string;
  role: 'user' | 'model';
  text: string;
  response?: GuideAskResponse;
  actionStatus?: 'pending' | 'approved' | 'declined';
}

interface PendingApprovalItem {
  id: string;
  sourceLabel: string;
  action: ProposedGuideAction;
  status: 'pending' | 'approved' | 'declined';
}

const CONCEPT_TOPICS = [
  {
    id: 'compound',
    title: 'Compound vs. simple growth',
    subtitle: 'How time and reinvestment affect balances',
    prompt:
      'Explain compound growth versus simple interest in plain language using a concrete, easy-to-follow example.',
  },
  {
    id: 'emergency_vs_invest',
    title: 'Emergency reserve vs. investing',
    subtitle: 'Balancing liquidity before market risk',
    prompt:
      'How do people generally balance building an emergency cash reserve versus putting extra money toward long-term investing? Please include general trade-offs without recommending specific products.',
  },
  {
    id: 'deductibles',
    title: 'Deductibles vs. premiums',
    subtitle: 'Understanding out-of-pocket trade-offs',
    prompt:
      'Explain in everyday terms how insurance deductibles relate to monthly premiums and how someone compares higher-deductible versus lower-deductible scenarios.',
  },
  {
    id: 'allocation',
    title: 'Asset allocation basics',
    subtitle: 'Why diversification spreads concentration risk',
    prompt:
      'Explain asset allocation and diversification concepts in plain language, without recommending any specific funds or securities.',
  },
];

const PILLAR_METADATA: Array<{
  key: GuidePillarScope;
  label: string;
  title: string;
  scopeDescription: string;
}> = [
  {
    key: 'flow',
    label: 'Elevate Flow',
    title: 'Cash Flow, Budgets & Bills',
    scopeDescription:
      'Current-month income, expenses, net flow, cash account totals, active budget limits, and recurring bill totals.',
  },
  {
    key: 'wealth',
    label: 'Elevate Wealth',
    title: 'Manual Holdings & Allocation',
    scopeDescription:
      'Total manual portfolio value, cost basis, holding count, and asset class breakdown percentages.',
  },
  {
    key: 'secure',
    label: 'Elevate Secure',
    title: 'Policies & Renewal Calendar',
    scopeDescription:
      'Active policy count, annualized premium total, and count of policies renewing within 60 days.',
  },
  {
    key: 'guide',
    label: 'Elevate Guide',
    title: 'Runway Target & Savings Goals',
    scopeDescription:
      'Target emergency reserve months, monthly essential baseline, and active savings goal progress.',
  },
];

function futureValueMonthly(
  startingBalance: number,
  monthlyContribution: number,
  annualRatePct: number,
  months: number
): number {
  const r = annualRatePct / 100 / 12;
  if (months <= 0) return startingBalance;
  if (r === 0) {
    return startingBalance + monthlyContribution * months;
  }
  const growthFactor = Math.pow(1 + r, months);
  return (
    startingBalance * growthFactor +
    monthlyContribution * ((growthFactor - 1) / r)
  );
}

function ActionApprovalCard({
  action,
  currency,
  status,
  sourceLabel,
  onApprove,
  onDecline,
}: {
  action: ProposedGuideAction;
  currency: string;
  status: 'pending' | 'approved' | 'declined';
  sourceLabel: string;
  onApprove: () => void;
  onDecline: () => void;
}) {
  if (!action || action.actionType === 'none') return null;

  const describeFields = (): Array<{ label: string; value: string }> => {
    switch (action.actionType) {
      case 'create_savings_goal':
        return [
          { label: 'Action', value: 'Create Savings Goal in Guide' },
          { label: 'Goal Title', value: action.title?.trim() || 'Savings Goal' },
          {
            label: 'Target Amount',
            value: formatCurrency(Math.max(100, Number(action.amount) || 1000), currency),
          },
          {
            label: 'Planned Monthly Contribution',
            value: formatCurrency(Math.max(0, Number(action.monthlyContribution) || 0), currency),
          },
        ];
      case 'set_emergency_months':
        return [
          { label: 'Action', value: 'Update Emergency Runway Target' },
          {
            label: 'Target Horizon',
            value: `${Math.min(12, Math.max(3, Math.round(Number(action.months) || 6)))} months`,
          },
        ];
      case 'set_essential_baseline':
        return [
          { label: 'Action', value: 'Set Monthly Essential Baseline' },
          {
            label: 'Monthly Essential Cost',
            value: formatCurrency(Math.max(1, Number(action.amount) || 0), currency),
          },
        ];
      case 'upsert_budget':
        return [
          { label: 'Action', value: 'Create or Update Flow Budget' },
          { label: 'Category', value: action.category?.trim() || 'Groceries & Dining' },
          {
            label: 'Monthly Limit',
            value: formatCurrency(Math.max(1, Number(action.amount) || 0), currency),
          },
        ];
      default:
        return [];
    }
  };

  const fields = describeFields();

  return (
    <div className="mt-4 p-4 rounded-xl border border-[#D5A64A]/45 bg-[#D5A64A]/8 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <ShieldAlert className="w-4 h-4 text-[#946C1B] mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#946C1B]">
              Approval Required Before Editing Workspace · {sourceLabel}
            </p>
            <p className="text-sm font-medium text-[#142A3B] mt-0.5">
              {action.summary?.trim() ||
                'Elevate Guide proposed a workspace update. Review the exact values below before applying.'}
            </p>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-lg bg-white border border-[#142A3B]/10 text-xs">
        {fields.map((f) => (
          <div key={f.label}>
            <dt className="text-[#627384]">{f.label}</dt>
            <dd className="font-semibold text-[#142A3B] font-mono tabular-nums mt-0.5">
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      {status === 'pending' ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="secondary" size="sm" onClick={onApprove}>
            <Check className="w-3.5 h-3.5" />
            <span>Approve & Apply</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onDecline}>
            <X className="w-3.5 h-3.5" />
            <span>Decline</span>
          </Button>
        </div>
      ) : status === 'approved' ? (
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E8A78]">
          <CheckCircle2 className="w-4 h-4" />
          <span>Approved and applied to your Elevate workspace.</span>
        </p>
      ) : (
        <p className="text-xs font-medium text-[#627384]">
          Declined — no changes were made to your workspace.
        </p>
      )}
    </div>
  );
}

export function GuidePillar() {
  const {
    workspace,
    totalCashAssets,
    netCashBalance,
    totalPortfolioValue,
    totalPortfolioCost,
    currentMonthKey,
    monthlyIncome,
    monthlyEssentialSpend,
    monthlyExpenses,
    monthlyNetFlow,
    totalMonthlyBudgetLimit,
    totalMonthlyBudgetSpent,
    monthlyRecurringTotal,
    annualInsurancePremiums,
    monthlyInsuranceEquiv,
    upcomingRenewals,
    coachingActions,
    addGoal,
    updateGoal,
    deleteGoal,
    updateGuideSettings,
    toggleCoachingAction,
    upsertBudget,
  } = useElevate();

  const currency = workspace.currency;
  const { emergencyTargetMonths, customMonthlyEssentialBaseline, guideAuthorizations } =
    workspace.guideSettings;

  const [activeTab, setActiveTab] = useState<GuideTab>('ask');

  // --- Ask & Learn State ---
  const [questionInput, setQuestionInput] = useState('');
  const [includeAuthorizedInAsk, setIncludeAuthorizedInAsk] = useState(false);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  // --- Scenario Lab State ---
  const [scenarioMode, setScenarioMode] = useState<'contribution' | 'runway'>(
    'contribution'
  );
  const [scenStart, setScenStart] = useState(() =>
    String(Math.round(totalCashAssets > 0 ? totalCashAssets : 1000))
  );
  const [scenMonthlyA, setScenMonthlyA] = useState('250');
  const [scenMonthlyB, setScenMonthlyB] = useState('450');
  const [scenYears, setScenYears] = useState('5');
  const [scenRateA, setScenRateA] = useState('0');
  const [scenRateB, setScenRateB] = useState('0');
  const [scenGoalTitle, setScenGoalTitle] = useState('Scenario B Savings Target');

  const [runwayExtraMonthly, setRunwayExtraMonthly] = useState('300');
  const [runwayExpenseReductionPct, setRunwayExpenseReductionPct] = useState('10');
  const [scenarioPendingApproval, setScenarioPendingApproval] =
    useState<PendingApprovalItem | null>(null);

  // --- Monthly Review State ---
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [monthlyReview, setMonthlyReview] = useState<MonthlyReviewResponse | null>(
    null
  );
  const [reviewActionStatus, setReviewActionStatus] = useState<
    'pending' | 'approved' | 'declined'
  >('pending');

  // --- Runway & Goals State ---
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
  const [runwayPendingApproval, setRunwayPendingApproval] =
    useState<PendingApprovalItem | null>(null);

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

  // Asset allocation summary (used ONLY when Wealth is explicitly authorized)
  const wealthAllocationBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of workspace.holdings) {
      map.set(h.assetClass, (map.get(h.assetClass) ?? 0) + h.currentValue);
    }
    return Array.from(map.entries()).map(([assetClass, value]) => ({
      assetClass,
      value,
      sharePct: totalPortfolioValue > 0 ? (value / totalPortfolioValue) * 100 : 0,
    }));
  }, [workspace.holdings, totalPortfolioValue]);

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

  const authorizedScopeList = useMemo(
    () =>
      (Object.keys(guideAuthorizations) as GuidePillarScope[]).filter(
        (k) => guideAuthorizations[k]
      ),
    [guideAuthorizations]
  );

  const toggleAuthorization = (scope: GuidePillarScope) => {
    updateGuideSettings({
      guideAuthorizations: {
        ...guideAuthorizations,
        [scope]: !guideAuthorizations[scope],
      },
    });
  };

  const setAllAuthorizations = (value: boolean) => {
    updateGuideSettings({
      guideAuthorizations: {
        flow: value,
        wealth: value,
        secure: value,
        guide: value,
      },
    });
  };

  // Builds ONLY authorized user data; unauthorized pillars are strictly omitted
  const buildAuthorizedPayload = (scopes: GuideAuthorizationScopes) => {
    const data: Record<string, unknown> = {};

    if (scopes.flow) {
      data.flow = {
        monthKey: currentMonthKey,
        accountsCount: workspace.accounts.length,
        totalCashAssets,
        netCashBalance,
        monthlyIncome,
        monthlyExpenses,
        monthlyNetFlow,
        monthlyEssentialSpend,
        configuredBudgetsCount: workspace.budgets.length,
        totalMonthlyBudgetLimit,
        totalMonthlyBudgetSpent,
        activeRecurringBillsMonthlyTotal: monthlyRecurringTotal,
      };
    }

    if (scopes.wealth) {
      data.wealth = {
        holdingsCount: workspace.holdings.length,
        totalPortfolioValue,
        totalPortfolioCost,
        allocationBreakdown: wealthAllocationBreakdown,
        investmentGoalsCount: workspace.investmentGoals.length,
      };
    }

    if (scopes.secure) {
      const activePolicies = workspace.policies.filter(
        (p) => p.status !== 'Archived'
      );
      data.secure = {
        activePoliciesCount: activePolicies.length,
        annualInsurancePremiums,
        monthlyInsuranceEquiv,
        renewalsWithin60Days: upcomingRenewals.length,
        completedChecklistCount: workspace.secureChecklistIds.length,
      };
    }

    if (scopes.guide) {
      data.guide = {
        emergencyTargetMonths,
        customMonthlyEssentialBaseline,
        activeMonthlyEssentialBaseline: activeMonthlyBaseline,
        savingsGoalsCount: workspace.goals.length,
        goalsSummary: workspace.goals.map((g) => ({
          title: g.title,
          currentSaved: g.currentSaved,
          targetAmount: g.targetAmount,
          monthlyContribution: g.monthlyContribution,
        })),
      };
    }

    return data;
  };

  // Execute an explicitly approved workspace action
  const applyApprovedAction = (action: ProposedGuideAction) => {
    switch (action.actionType) {
      case 'create_savings_goal': {
        const title = action.title?.trim() || 'Savings Goal';
        const targetAmount = Math.max(1, Number(action.amount) || 1000);
        const monthlyContribution = Math.max(0, Number(action.monthlyContribution) || 0);
        addGoal({
          title,
          targetAmount,
          currentSaved: 0,
          monthlyContribution,
        });
        break;
      }
      case 'set_emergency_months': {
        const months = Math.min(12, Math.max(3, Math.round(Number(action.months) || 6)));
        updateGuideSettings({ emergencyTargetMonths: months });
        break;
      }
      case 'set_essential_baseline': {
        const amount = Number(action.amount);
        if (Number.isFinite(amount) && amount > 0) {
          updateGuideSettings({ customMonthlyEssentialBaseline: amount });
          setBaselineInput(String(amount));
        }
        break;
      }
      case 'upsert_budget': {
        const categoryName = action.category?.trim() || 'Groceries & Dining';
        const limit = Math.max(1, Number(action.amount) || 200);
        const existingCat = workspace.categories.find(
          (c) => c.name.toLowerCase() === categoryName.toLowerCase()
        );
        upsertBudget({
          category: existingCat ? existingCat.name : categoryName,
          monthlyLimit: limit,
          bucket: existingCat?.bucket ?? 'Needs',
        });
        break;
      }
      default:
        break;
    }
  };

  // --- Ask Elevate Guide Handler ---
  const submitQuestion = async (promptText: string) => {
    const clean = promptText.trim();
    if (!clean || isAsking) return;

    setAskError(null);
    const userTurn: ConversationTurn = {
      id: `turn_${Date.now()}_u`,
      role: 'user',
      text: clean,
    };

    const nextHistory = [...conversation, userTurn];
    setConversation(nextHistory);
    setQuestionInput('');
    setIsAsking(true);

    try {
      const authorizedContext =
        includeAuthorizedInAsk && authorizedScopeList.length > 0
          ? {
              currency,
              authorizedScopes: authorizedScopeList,
              authorizedData: buildAuthorizedPayload(guideAuthorizations),
            }
          : null;

      const res = await fetch('/api/guide/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: clean,
          history: nextHistory.slice(-6).map((m) => ({
            role: m.role,
            text: m.text,
          })),
          authorizedContext,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          body?.error || `Elevate Guide request failed (${res.status}).`
        );
      }

      const data = body as GuideAskResponse;
      const modelTurn: ConversationTurn = {
        id: `turn_${Date.now()}_m`,
        role: 'model',
        text: data.answer,
        response: data,
        actionStatus:
          data.proposedAction && data.proposedAction.actionType !== 'none'
            ? 'pending'
            : undefined,
      };
      setConversation((prev) => [...prev, modelTurn]);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to reach Elevate Guide right now.';
      setAskError(msg);
    } finally {
      setIsAsking(false);
    }
  };

  // --- Monthly Review Handler ---
  const handleGenerateMonthlyReview = async () => {
    if (authorizedScopeList.length === 0 || isGeneratingReview) return;
    setReviewError(null);
    setIsGeneratingReview(true);

    try {
      const authorizedData = buildAuthorizedPayload(guideAuthorizations);
      const res = await fetch('/api/guide/monthly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthKey: currentMonthKey,
          currency,
          authorizedScopes: authorizedScopeList,
          authorizedData,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          body?.error || `Monthly Review failed (${res.status}).`
        );
      }

      setMonthlyReview(body as MonthlyReviewResponse);
      setReviewActionStatus('pending');
    } catch (err: unknown) {
      setReviewError(
        err instanceof Error
          ? err.message
          : 'Could not generate Monthly Review.'
      );
    } finally {
      setIsGeneratingReview(false);
    }
  };

  // --- Scenario Lab Calculations ---
  const scenarioCalc = useMemo(() => {
    const start = Math.max(0, parseFloat(scenStart) || 0);
    const mA = Math.max(0, parseFloat(scenMonthlyA) || 0);
    const mB = Math.max(0, parseFloat(scenMonthlyB) || 0);
    const years = Math.min(35, Math.max(1, parseInt(scenYears, 10) || 1));
    const months = years * 12;
    const rateA = Math.min(15, Math.max(0, parseFloat(scenRateA) || 0));
    const rateB = Math.min(15, Math.max(0, parseFloat(scenRateB) || 0));

    const totalContributedA = start + mA * months;
    const totalContributedB = start + mB * months;
    const endA = futureValueMonthly(start, mA, rateA, months);
    const endB = futureValueMonthly(start, mB, rateB, months);
    const maxVal = Math.max(endA, endB, 1);

    return {
      start,
      mA,
      mB,
      years,
      months,
      rateA,
      rateB,
      totalContributedA,
      totalContributedB,
      endA,
      endB,
      difference: endB - endA,
      barPctA: (endA / maxVal) * 100,
      barPctB: (endB / maxVal) * 100,
    };
  }, [scenStart, scenMonthlyA, scenMonthlyB, scenYears, scenRateA, scenRateB]);

  const runwayScenarioCalc = useMemo(() => {
    const baseMonthly = activeMonthlyBaseline > 0 ? activeMonthlyBaseline : 3000;
    const reductionPct = Math.min(
      50,
      Math.max(0, parseFloat(runwayExpenseReductionPct) || 0)
    );
    const extraSave = Math.max(0, parseFloat(runwayExtraMonthly) || 0);
    const adjustedMonthly = baseMonthly * (1 - reductionPct / 100);
    const currentRunway = baseMonthly > 0 ? totalCashAssets / baseMonthly : 0;
    const adjustedImmediateRunway =
      adjustedMonthly > 0 ? totalCashAssets / adjustedMonthly : 0;

    const currentTarget = baseMonthly * emergencyTargetMonths;
    const adjustedTarget = adjustedMonthly * emergencyTargetMonths;

    const currentShortfall = Math.max(0, currentTarget - totalCashAssets);
    const adjustedShortfall = Math.max(0, adjustedTarget - totalCashAssets);

    const baselineMonthlySurplus = Math.max(0, monthlyNetFlow);
    const adjustedMonthlySave = baselineMonthlySurplus + extraSave;

    const monthsToTargetA =
      currentShortfall === 0
        ? 0
        : baselineMonthlySurplus > 0
          ? Math.ceil(currentShortfall / baselineMonthlySurplus)
          : null;
    const monthsToTargetB =
      adjustedShortfall === 0
        ? 0
        : adjustedMonthlySave > 0
          ? Math.ceil(adjustedShortfall / adjustedMonthlySave)
          : null;

    return {
      baseMonthly,
      adjustedMonthly,
      reductionPct,
      extraSave,
      currentRunway,
      adjustedImmediateRunway,
      currentTarget,
      adjustedTarget,
      baselineMonthlySurplus,
      adjustedMonthlySave,
      monthsToTargetA,
      monthsToTargetB,
      usesFallbackBaseline: activeMonthlyBaseline <= 0,
    };
  }, [
    activeMonthlyBaseline,
    totalCashAssets,
    emergencyTargetMonths,
    monthlyNetFlow,
    runwayExpenseReductionPct,
    runwayExtraMonthly,
  ]);

  // --- Runway & Goals Handlers ---
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

  const handleStageBaselineApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!baselineInput.trim()) {
      updateGuideSettings({ customMonthlyEssentialBaseline: null });
      setRunwayPendingApproval(null);
      return;
    }
    const num = parseFloat(baselineInput);
    if (!Number.isFinite(num) || num <= 0) return;

    setRunwayPendingApproval({
      id: `runway_${Date.now()}`,
      sourceLabel: 'Emergency Runway Planner',
      action: {
        actionType: 'set_essential_baseline',
        summary: `Set your monthly essential cost baseline to ${formatCurrency(num, currency)}.`,
        amount: num,
      },
      status: 'pending',
    });
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#946C1B]">
            Elevate Guide · Educational Financial Coach
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
            Plain-language coaching, scenarios & monthly review
          </h1>
          <p className="mt-1.5 text-sm text-[#425466]">
            Learn core concepts, compare scenarios with explicit assumptions, and review authorized pillars on your terms.
          </p>
        </div>

        <SegmentedControl<GuideTab>
          ariaLabel="Elevate Guide sections"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'ask', label: 'Ask & Learn' },
            { value: 'scenarios', label: 'Scenario Lab' },
            { value: 'review', label: 'Monthly Review' },
            { value: 'runway', label: 'Runway & Goals' },
          ]}
        />
      </div>

      {/* Educational Boundary Notice */}
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10 text-xs text-[#425466]">
        <Info className="w-4 h-4 text-[#1E8A78] mt-0.5 shrink-0" />
        <p className="leading-relaxed">
          <strong className="text-[#142A3B]">Educational Coach Boundary:</strong>{' '}
          Elevate Guide is an educational assistant, not a licensed financial adviser, broker, or tax professional. It never guarantees returns, never makes product or security recommendations, only accesses pillars you explicitly authorize, and always asks your approval before editing workspace records.
        </p>
      </div>

      {/* ==================== TAB 1: ASK & LEARN ==================== */}
      {activeTab === 'ask' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Concept Starters + Context Toggle */}
          <div className="lg:col-span-4 space-y-6">
            <Card>
              <CardHeader
                title="Concept Library"
                subtitle="Tap a topic for a plain-language explanation"
              />
              <div className="space-y-2.5">
                {CONCEPT_TOPICS.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    disabled={isAsking}
                    onClick={() => submitQuestion(topic.prompt)}
                    className="w-full text-left p-3.5 rounded-xl border border-[#142A3B]/10 bg-[#F7F9FA]/70 hover:bg-white hover:border-[#1E8A78]/50 transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#142A3B]">
                          {topic.title}
                        </p>
                        <p className="text-xs text-[#627384] mt-0.5">
                          {topic.subtitle}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#1E8A78] mt-0.5 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Question Data Scope"
                subtitle="Control whether authorized numbers accompany your questions"
              />
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-[#142A3B]/10 bg-[#F7F9FA] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAuthorizedInAsk}
                    onChange={(e) => setIncludeAuthorizedInAsk(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#1E8A78] rounded cursor-pointer"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-[#142A3B]">
                      Share authorized pillar summaries
                    </p>
                    <p className="text-[#425466] mt-0.5 leading-relaxed">
                      {authorizedScopeList.length > 0
                        ? `Authorized right now: ${authorizedScopeList.map((s) => s.toUpperCase()).join(', ')}.`
                        : 'No pillars authorized yet. Authorize pillars under Monthly Review.'}
                    </p>
                  </div>
                </label>

                {includeAuthorizedInAsk && authorizedScopeList.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('review')}
                    className="text-xs font-semibold text-[#1E8A78] hover:underline cursor-pointer"
                  >
                    Configure pillar authorizations in Monthly Review →
                  </button>
                )}
              </div>
            </Card>
          </div>

          {/* Right: Q&A Coaching Workspace */}
          <Card className="lg:col-span-8">
            <CardHeader
              title="Ask Elevate Guide"
              subtitle="Ask about budgeting frameworks, savings trade-offs, insurance terms, or side-by-side scenarios"
              action={
                conversation.length > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setConversation([]);
                      setAskError(null);
                    }}
                  >
                    Clear Thread
                  </Button>
                ) : null
              }
            />

            {askError && (
              <div className="mb-4">
                <ErrorBanner
                  message={askError}
                  onDismiss={() => setAskError(null)}
                />
              </div>
            )}

            {conversation.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="w-5 h-5" />}
                title="Ask any personal finance concept question"
                description="Pick a topic from the Concept Library or type a question below—for example, 'Compare saving $300/mo vs $500/mo over 3 years' or 'Explain how a high-yield cash reserve differs from equity investing.'"
              />
            ) : (
              <div className="space-y-4 mb-6 max-h-[560px] overflow-y-auto pr-1">
                {conversation.map((turn) => {
                  if (turn.role === 'user') {
                    return (
                      <div key={turn.id} className="flex justify-end">
                        <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-[#142A3B] text-white text-sm leading-relaxed">
                          {turn.text}
                        </div>
                      </div>
                    );
                  }

                  const resp = turn.response;
                  const scenario = resp?.scenarioComparison;

                  return (
                    <div
                      key={turn.id}
                      className="p-4 sm:p-5 rounded-2xl border border-[#142A3B]/10 bg-[#F7F9FA]/80 space-y-3"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#1E8A78]">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Elevate Guide</span>
                      </div>

                      <p className="text-sm text-[#142A3B] leading-relaxed whitespace-pre-line">
                        {resp?.answer ?? turn.text}
                      </p>

                      {resp?.keyTakeaways && resp.keyTakeaways.length > 0 && (
                        <div className="pt-2 border-t border-[#142A3B]/10">
                          <p className="text-xs font-semibold text-[#425466] mb-1.5">
                            Key Takeaways
                          </p>
                          <ul className="space-y-1 text-xs text-[#142A3B]">
                            {resp.keyTakeaways.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-[#1E8A78] font-bold">·</span>
                                <span className="leading-relaxed">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {scenario?.hasScenario && (
                        <div className="p-3.5 rounded-xl bg-white border border-[#142A3B]/10 space-y-3">
                          <p className="text-xs font-semibold text-[#142A3B]">
                            {scenario.title || 'Scenario Comparison'}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-[#F7F9FA] border border-[#142A3B]/10">
                              <p className="text-xs text-[#627384]">
                                {scenario.optionALabel || 'Scenario A'}
                              </p>
                              <p className="text-base font-bold font-mono tabular-nums text-[#142A3B] mt-0.5">
                                {scenario.optionAMetric || '—'}
                              </p>
                              {scenario.optionASummary && (
                                <p className="text-xs text-[#425466] mt-1 leading-relaxed">
                                  {scenario.optionASummary}
                                </p>
                              )}
                            </div>
                            <div className="p-3 rounded-lg bg-[#1E8A78]/6 border border-[#1E8A78]/25">
                              <p className="text-xs text-[#1E8A78] font-medium">
                                {scenario.optionBLabel || 'Scenario B'}
                              </p>
                              <p className="text-base font-bold font-mono tabular-nums text-[#142A3B] mt-0.5">
                                {scenario.optionBMetric || '—'}
                              </p>
                              {scenario.optionBSummary && (
                                <p className="text-xs text-[#425466] mt-1 leading-relaxed">
                                  {scenario.optionBSummary}
                                </p>
                              )}
                            </div>
                          </div>
                          {scenario.assumptions && scenario.assumptions.length > 0 && (
                            <div className="text-[11px] text-[#627384] border-t border-[#142A3B]/8 pt-2">
                              <span className="font-semibold text-[#425466]">
                                Visible assumptions:{' '}
                              </span>
                              {scenario.assumptions.join(' · ')}
                            </div>
                          )}
                        </div>
                      )}

                      {resp?.proposedAction &&
                        resp.proposedAction.actionType !== 'none' && (
                          <ActionApprovalCard
                            action={resp.proposedAction}
                            currency={currency}
                            status={turn.actionStatus ?? 'pending'}
                            sourceLabel="Ask Elevate Guide"
                            onApprove={() => {
                              applyApprovedAction(resp.proposedAction);
                              setConversation((prev) =>
                                prev.map((m) =>
                                  m.id === turn.id
                                    ? { ...m, actionStatus: 'approved' }
                                    : m
                                )
                              );
                            }}
                            onDecline={() => {
                              setConversation((prev) =>
                                prev.map((m) =>
                                  m.id === turn.id
                                    ? { ...m, actionStatus: 'declined' }
                                    : m
                                )
                              );
                            }}
                          />
                        )}

                      {resp?.educationalNote && (
                        <p className="text-[11px] text-[#627384] pt-1">
                          {resp.educationalNote}
                        </p>
                      )}
                    </div>
                  );
                })}

                {isAsking && (
                  <div className="p-4 rounded-2xl border border-[#142A3B]/10 bg-[#F7F9FA] text-xs text-[#425466] animate-pulse">
                    Elevate Guide is preparing a plain-language response...
                  </div>
                )}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitQuestion(questionInput);
              }}
              className="mt-4 pt-4 border-t border-[#142A3B]/10 space-y-2.5"
            >
              <label htmlFor="guide-ask-input" className="sr-only">
                Ask Elevate Guide a financial question
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  id="guide-ask-input"
                  type="text"
                  maxLength={1500}
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="Ask a question or request a scenario comparison (e.g., Compare saving $300/mo vs $500/mo)..."
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={isAsking || !questionInput.trim()}
                >
                  <Send className="w-4 h-4" />
                  <span>{isAsking ? 'Thinking...' : 'Ask Guide'}</span>
                </Button>
              </div>
              <p className="text-[11px] text-[#627384]">
                Tip: If you ask Guide to draft a savings goal or budget, it will always show an approval card before writing to your workspace.
              </p>
            </form>
          </Card>
        </div>
      )}

      {/* ==================== TAB 2: SCENARIO LAB ==================== */}
      {activeTab === 'scenarios' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#142A3B]">
                Scenario Comparisons with Visible Assumptions
              </h2>
              <p className="text-xs text-[#425466]">
                Every number below is computed deterministically from your explicit inputs—zero hidden assumptions or guaranteed returns.
              </p>
            </div>
            <SegmentedControl<'contribution' | 'runway'>
              ariaLabel="Scenario comparison mode"
              value={scenarioMode}
              onChange={setScenarioMode}
              options={[
                { value: 'contribution', label: 'Savings Horizon What-If' },
                { value: 'runway', label: 'Runway Buffer What-If' },
              ]}
            />
          </div>

          {scenarioMode === 'contribution' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Inputs */}
              <Card className="lg:col-span-5">
                <CardHeader
                  title="Scenario Inputs"
                  subtitle="Compare two contribution paths over the same horizon"
                />

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="scen-start"
                        className="block text-xs font-semibold text-[#142A3B] mb-1.5"
                      >
                        Starting Amount ({currency})
                      </label>
                      <input
                        id="scen-start"
                        type="number"
                        min="0"
                        step="50"
                        value={scenStart}
                        onChange={(e) => setScenStart(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="scen-years"
                        className="block text-xs font-semibold text-[#142A3B] mb-1.5"
                      >
                        Horizon (Years)
                      </label>
                      <input
                        id="scen-years"
                        type="number"
                        min="1"
                        max="35"
                        step="1"
                        value={scenYears}
                        onChange={(e) => setScenYears(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10 space-y-3">
                    <p className="text-xs font-semibold text-[#142A3B]">
                      Scenario A · Baseline Path
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="scen-monthly-a"
                          className="block text-[11px] font-medium text-[#425466] mb-1"
                        >
                          Monthly ({currency})
                        </label>
                        <input
                          id="scen-monthly-a"
                          type="number"
                          min="0"
                          step="25"
                          value={scenMonthlyA}
                          onChange={(e) => setScenMonthlyA(e.target.value)}
                          className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="scen-rate-a"
                          className="block text-[11px] font-medium text-[#425466] mb-1"
                        >
                          Illustrative Rate (%/yr)
                        </label>
                        <input
                          id="scen-rate-a"
                          type="number"
                          min="0"
                          max="15"
                          step="0.5"
                          value={scenRateA}
                          onChange={(e) => setScenRateA(e.target.value)}
                          className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#1E8A78]/6 border border-[#1E8A78]/25 space-y-3">
                    <p className="text-xs font-semibold text-[#1E8A78]">
                      Scenario B · Adjusted Path
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="scen-monthly-b"
                          className="block text-[11px] font-medium text-[#425466] mb-1"
                        >
                          Monthly ({currency})
                        </label>
                        <input
                          id="scen-monthly-b"
                          type="number"
                          min="0"
                          step="25"
                          value={scenMonthlyB}
                          onChange={(e) => setScenMonthlyB(e.target.value)}
                          className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="scen-rate-b"
                          className="block text-[11px] font-medium text-[#425466] mb-1"
                        >
                          Illustrative Rate (%/yr)
                        </label>
                        <input
                          id="scen-rate-b"
                          type="number"
                          min="0"
                          max="15"
                          step="0.5"
                          value={scenRateB}
                          onChange={(e) => setScenRateB(e.target.value)}
                          className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#142A3B]/10 space-y-2.5">
                    <label
                      htmlFor="scen-goal-title"
                      className="block text-xs font-semibold text-[#142A3B]"
                    >
                      Optional: Turn Scenario B into a Savings Goal
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="scen-goal-title"
                        type="text"
                        value={scenGoalTitle}
                        onChange={(e) => setScenGoalTitle(e.target.value)}
                        className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-[#142A3B]/15 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setScenarioPendingApproval({
                            id: `scen_${Date.now()}`,
                            sourceLabel: 'Scenario Lab',
                            action: {
                              actionType: 'create_savings_goal',
                              summary: `Create a savings goal from Scenario B (${scenarioCalc.years}-year illustration at ${formatCurrency(scenarioCalc.mB, currency)}/mo).`,
                              title: scenGoalTitle.trim() || 'Scenario B Goal',
                              amount: Math.round(scenarioCalc.endB),
                              monthlyContribution: Math.round(scenarioCalc.mB),
                            },
                            status: 'pending',
                          })
                        }
                      >
                        Propose Goal
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Results + Visible Assumptions Ledger */}
              <Card className="lg:col-span-7">
                <CardHeader
                  title="Side-by-Side Outcome & Visible Assumptions"
                  subtitle={`Comparing ${scenarioCalc.years}-year (${scenarioCalc.months}-month) cumulative balances`}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10 mb-5">
                  <StatMetric
                    label="Scenario A Total"
                    value={formatCurrency(scenarioCalc.endA, currency)}
                    detail={`Contributed ${formatCurrency(scenarioCalc.totalContributedA, currency)}`}
                  />
                  <StatMetric
                    label="Scenario B Total"
                    value={formatCurrency(scenarioCalc.endB, currency)}
                    tone="teal"
                    detail={`Contributed ${formatCurrency(scenarioCalc.totalContributedB, currency)}`}
                  />
                  <StatMetric
                    label="Scenario Difference (B − A)"
                    value={`${scenarioCalc.difference >= 0 ? '+' : ''}${formatCurrency(scenarioCalc.difference, currency)}`}
                    tone={scenarioCalc.difference >= 0 ? 'teal' : 'gold'}
                    detail={`Over ${scenarioCalc.months} months`}
                  />
                </div>

                {/* Comparison Bars */}
                <div className="space-y-4 mb-6">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-[#142A3B]">
                        Scenario A ({formatCurrency(scenarioCalc.mA, currency)}/mo · {scenarioCalc.rateA}% assumed)
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                        {formatCurrency(scenarioCalc.endA, currency)}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-[#EEF2F5] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#142A3B]"
                        style={{ width: `${scenarioCalc.barPctA}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-[#1E8A78]">
                        Scenario B ({formatCurrency(scenarioCalc.mB, currency)}/mo · {scenarioCalc.rateB}% assumed)
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                        {formatCurrency(scenarioCalc.endB, currency)}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-[#EEF2F5] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#1E8A78]"
                        style={{ width: `${scenarioCalc.barPctB}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Explicit Visible Assumptions Table */}
                <div className="border-t border-[#142A3B]/10 pt-4">
                  <p className="text-xs font-semibold text-[#142A3B] mb-2.5">
                    Visible Assumptions Ledger
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#F7F9FA] flex justify-between gap-2">
                      <span className="text-[#627384]">Starting Balance</span>
                      <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                        {formatCurrency(scenarioCalc.start, currency)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F7F9FA] flex justify-between gap-2">
                      <span className="text-[#627384]">Compounding Cadence</span>
                      <span className="font-semibold text-[#142A3B]">
                        Monthly ({scenarioCalc.months} periods)
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F7F9FA] flex justify-between gap-2">
                      <span className="text-[#627384]">Assumed Annual Rates</span>
                      <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                        A: {scenarioCalc.rateA}% · B: {scenarioCalc.rateB}%
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F7F9FA] flex justify-between gap-2">
                      <span className="text-[#627384]">Taxes, Fees & Inflation</span>
                      <span className="font-semibold text-[#142A3B]">
                        Not deducted (0% assumed)
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#627384] mt-3 leading-relaxed">
                    Any non-zero rate entered above is strictly a hypothetical mathematical illustration, not a market forecast or guaranteed return.
                  </p>
                </div>

                {scenarioPendingApproval && (
                  <ActionApprovalCard
                    action={scenarioPendingApproval.action}
                    currency={currency}
                    status={scenarioPendingApproval.status}
                    sourceLabel={scenarioPendingApproval.sourceLabel}
                    onApprove={() => {
                      applyApprovedAction(scenarioPendingApproval.action);
                      setScenarioPendingApproval((prev) =>
                        prev ? { ...prev, status: 'approved' } : null
                      );
                    }}
                    onDecline={() => {
                      setScenarioPendingApproval((prev) =>
                        prev ? { ...prev, status: 'declined' } : null
                      );
                    }}
                  />
                )}
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <Card className="lg:col-span-5">
                <CardHeader
                  title="Runway What-If Inputs"
                  subtitle="Test how trimming monthly costs or adding savings affects your cash runway"
                />
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="runway-trim-pct"
                      className="block text-xs font-semibold text-[#142A3B] mb-1.5"
                    >
                      Hypothetical Essential Cost Trim (%)
                    </label>
                    <input
                      id="runway-trim-pct"
                      type="number"
                      min="0"
                      max="50"
                      step="1"
                      value={runwayExpenseReductionPct}
                      onChange={(e) => setRunwayExpenseReductionPct(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="runway-extra-save"
                      className="block text-xs font-semibold text-[#142A3B] mb-1.5"
                    >
                      Additional Monthly Reserve Contribution ({currency})
                    </label>
                    <input
                      id="runway-extra-save"
                      type="number"
                      min="0"
                      step="25"
                      value={runwayExtraMonthly}
                      onChange={(e) => setRunwayExtraMonthly(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                    />
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10 text-xs text-[#425466] space-y-1">
                    <p className="font-semibold text-[#142A3B]">
                      Visible Baseline Assumptions
                    </p>
                    <p>
                      · Cash balance used:{' '}
                      <span className="font-mono tabular-nums font-semibold">
                        {formatCurrency(totalCashAssets, currency)}
                      </span>
                    </p>
                    <p>
                      · Monthly essential baseline:{' '}
                      <span className="font-mono tabular-nums font-semibold">
                        {formatCurrency(runwayScenarioCalc.baseMonthly, currency)}
                      </span>{' '}
                      {runwayScenarioCalc.usesFallbackBaseline
                        ? '(illustrative fallback because no expenses/override are logged)'
                        : '(from your Flow / Guide records)'}
                    </p>
                    <p>
                      · Target horizon: {emergencyTargetMonths} months · Interest assumed: 0%
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="lg:col-span-7">
                <CardHeader
                  title="Baseline vs. Adjusted Runway Scenario"
                  subtitle="Side-by-side cash coverage and time to target reserve"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10 space-y-2">
                    <p className="text-xs font-semibold text-[#627384]">
                      Scenario A · Current Baseline
                    </p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-[#142A3B]">
                      {runwayScenarioCalc.currentRunway.toFixed(1)} mo
                    </p>
                    <p className="text-xs text-[#425466]">
                      Essential burn:{' '}
                      <span className="font-mono tabular-nums font-semibold">
                        {formatCurrency(runwayScenarioCalc.baseMonthly, currency)}/mo
                      </span>
                    </p>
                    <p className="text-xs text-[#425466]">
                      Target ({emergencyTargetMonths} mo):{' '}
                      <span className="font-mono tabular-nums font-semibold">
                        {formatCurrency(runwayScenarioCalc.currentTarget, currency)}
                      </span>
                    </p>
                    <p className="text-xs text-[#627384]">
                      {runwayScenarioCalc.monthsToTargetA === 0
                        ? 'Target currently met'
                        : runwayScenarioCalc.monthsToTargetA !== null
                          ? `~${runwayScenarioCalc.monthsToTargetA} mo at current net flow`
                          : 'No positive monthly net flow logged'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#1E8A78]/6 border border-[#1E8A78]/25 space-y-2">
                    <p className="text-xs font-semibold text-[#1E8A78]">
                      Scenario B · Adjusted What-If
                    </p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-[#142A3B]">
                      {runwayScenarioCalc.adjustedImmediateRunway.toFixed(1)} mo
                    </p>
                    <p className="text-xs text-[#425466]">
                      Adjusted burn ({runwayScenarioCalc.reductionPct}% trim):{' '}
                      <span className="font-mono tabular-nums font-semibold">
                        {formatCurrency(runwayScenarioCalc.adjustedMonthly, currency)}/mo
                      </span>
                    </p>
                    <p className="text-xs text-[#425466]">
                      Adjusted target ({emergencyTargetMonths} mo):{' '}
                      <span className="font-mono tabular-nums font-semibold">
                        {formatCurrency(runwayScenarioCalc.adjustedTarget, currency)}
                      </span>
                    </p>
                    <p className="text-xs text-[#1E8A78] font-medium">
                      {runwayScenarioCalc.monthsToTargetB === 0
                        ? 'Adjusted target already met'
                        : runwayScenarioCalc.monthsToTargetB !== null
                          ? `~${runwayScenarioCalc.monthsToTargetB} mo saving ${formatCurrency(runwayScenarioCalc.adjustedMonthlySave, currency)}/mo`
                          : 'Add monthly contribution above'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: MONTHLY REVIEW ==================== */}
      {activeTab === 'review' && (
        <div className="space-y-6">
          {/* Step 1: Authorization Controls */}
          <Card>
            <CardHeader
              title="Monthly Review Data Authorizations"
              subtitle="Elevate Guide only sees the pillars you explicitly authorize below. Unchecked pillars are excluded completely."
              action={
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAllAuthorizations(true)}
                  >
                    Authorize All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAllAuthorizations(false)}
                  >
                    Revoke All
                  </Button>
                </div>
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {PILLAR_METADATA.map((pillar) => {
                const enabled = guideAuthorizations[pillar.key];
                return (
                  <label
                    key={pillar.key}
                    className={`flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                      enabled
                        ? 'border-[#1E8A78]/50 bg-[#1E8A78]/5'
                        : 'border-[#142A3B]/10 bg-[#F7F9FA]/70 hover:bg-[#F7F9FA]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleAuthorization(pillar.key)}
                      className="mt-1 h-4 w-4 accent-[#1E8A78] rounded cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[#142A3B]">
                          {pillar.label}
                        </span>
                        <span
                          className={`text-[11px] font-semibold ${
                            enabled ? 'text-[#1E8A78]' : 'text-[#627384]'
                          }`}
                        >
                          {enabled ? 'Authorized' : 'Not authorized'}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[#425466] mt-0.5">
                        {pillar.title}
                      </p>
                      <p className="text-xs text-[#627384] mt-1 leading-relaxed">
                        {pillar.scopeDescription}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </Card>

          {/* Step 2: Authorized Snapshot Preview + Generate */}
          <Card>
            <CardHeader
              title={`Authorized Scope Preview · ${currentMonthKey}`}
              subtitle={
                authorizedScopeList.length > 0
                  ? `Showing only the ${authorizedScopeList.length} pillar(s) you authorized`
                  : 'Authorize at least one pillar above to preview metrics and generate your Monthly Review'
              }
              action={
                <Button
                  variant="secondary"
                  disabled={authorizedScopeList.length === 0 || isGeneratingReview}
                  onClick={handleGenerateMonthlyReview}
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span>
                    {isGeneratingReview
                      ? 'Generating Review...'
                      : 'Generate Monthly Review'}
                  </span>
                </Button>
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Flow Preview */}
              <div className="p-3.5 rounded-xl border border-[#142A3B]/10 bg-[#F7F9FA]">
                <p className="text-xs font-semibold text-[#142A3B]">Elevate Flow</p>
                {guideAuthorizations.flow ? (
                  <div className="mt-2 space-y-1 text-xs text-[#425466]">
                    <p>
                      Income:{' '}
                      <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                        {formatCurrency(monthlyIncome, currency)}
                      </span>
                    </p>
                    <p>
                      Expenses:{' '}
                      <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                        {formatCurrency(monthlyExpenses, currency)}
                      </span>
                    </p>
                    <p>
                      Budgets: {workspace.budgets.length} active
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[#627384] flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>Excluded (not authorized)</span>
                  </p>
                )}
              </div>

              {/* Wealth Preview */}
              <div className="p-3.5 rounded-xl border border-[#142A3B]/10 bg-[#F7F9FA]">
                <p className="text-xs font-semibold text-[#142A3B]">Elevate Wealth</p>
                {guideAuthorizations.wealth ? (
                  <div className="mt-2 space-y-1 text-xs text-[#425466]">
                    <p>
                      Portfolio:{' '}
                      <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                        {formatCurrency(totalPortfolioValue, currency)}
                      </span>
                    </p>
                    <p>Holdings: {workspace.holdings.length} manual</p>
                    <p>Goals: {workspace.investmentGoals.length}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[#627384] flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>Excluded (not authorized)</span>
                  </p>
                )}
              </div>

              {/* Secure Preview */}
              <div className="p-3.5 rounded-xl border border-[#142A3B]/10 bg-[#F7F9FA]">
                <p className="text-xs font-semibold text-[#142A3B]">Elevate Secure</p>
                {guideAuthorizations.secure ? (
                  <div className="mt-2 space-y-1 text-xs text-[#425466]">
                    <p>
                      Policies:{' '}
                      <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                        {workspace.policies.filter((p) => p.status !== 'Archived').length}
                      </span>{' '}
                      active
                    </p>
                    <p>
                      Annual premiums:{' '}
                      <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                        {formatCurrency(annualInsurancePremiums, currency)}
                      </span>
                    </p>
                    <p>Renewing ≤60d: {upcomingRenewals.length}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[#627384] flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>Excluded (not authorized)</span>
                  </p>
                )}
              </div>

              {/* Guide Preview */}
              <div className="p-3.5 rounded-xl border border-[#142A3B]/10 bg-[#F7F9FA]">
                <p className="text-xs font-semibold text-[#142A3B]">Elevate Guide</p>
                {guideAuthorizations.guide ? (
                  <div className="mt-2 space-y-1 text-xs text-[#425466]">
                    <p>
                      Target horizon:{' '}
                      <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                        {emergencyTargetMonths} mo
                      </span>
                    </p>
                    <p>
                      Essentials baseline:{' '}
                      <span className="font-mono tabular-nums font-semibold text-[#142A3B]">
                        {activeMonthlyBaseline > 0
                          ? formatCurrency(activeMonthlyBaseline, currency)
                          : '—'}
                      </span>
                    </p>
                    <p>Savings goals: {workspace.goals.length}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[#627384] flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>Excluded (not authorized)</span>
                  </p>
                )}
              </div>
            </div>

            {reviewError && (
              <div className="mb-4">
                <ErrorBanner
                  message={reviewError}
                  onDismiss={() => setReviewError(null)}
                />
              </div>
            )}

            {isGeneratingReview ? (
              <div className="p-6 rounded-xl border border-[#142A3B]/10 bg-[#F7F9FA] text-sm text-[#425466] animate-pulse">
                Preparing Monthly Review strictly from {authorizedScopeList.join(', ')}...
              </div>
            ) : monthlyReview ? (
              <div className="p-5 rounded-2xl border border-[#142A3B]/10 bg-[#F7F9FA]/70 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-[#1E8A78]">
                    Monthly Review · Authorized scopes: {authorizedScopeList.join(' · ')}
                  </p>
                  <h3 className="text-lg font-bold text-[#142A3B] mt-1">
                    {monthlyReview.headline}
                  </h3>
                  <p className="text-sm text-[#425466] mt-1.5 leading-relaxed">
                    {monthlyReview.summary}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white border border-[#142A3B]/10">
                    <p className="text-xs font-semibold text-[#142A3B] mb-2">
                      Observations from Authorized Records
                    </p>
                    <ul className="space-y-1.5 text-xs text-[#425466]">
                      {monthlyReview.authorizedObservations.map((obs, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-[#1E8A78] font-bold">·</span>
                          <span className="leading-relaxed">{obs}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#142A3B]/10">
                    <p className="text-xs font-semibold text-[#142A3B] mb-2">
                      Educational Focus Areas
                    </p>
                    <ul className="space-y-1.5 text-xs text-[#425466]">
                      {monthlyReview.focusAreas.map((area, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-[#946C1B] font-bold">·</span>
                          <span className="leading-relaxed">{area}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {monthlyReview.proposedAction &&
                  monthlyReview.proposedAction.actionType !== 'none' && (
                    <ActionApprovalCard
                      action={monthlyReview.proposedAction}
                      currency={currency}
                      status={reviewActionStatus}
                      sourceLabel="Monthly Review"
                      onApprove={() => {
                        applyApprovedAction(monthlyReview.proposedAction);
                        setReviewActionStatus('approved');
                      }}
                      onDecline={() => setReviewActionStatus('declined')}
                    />
                  )}
              </div>
            ) : (
              <EmptyState
                icon={<CalendarCheck className="w-5 h-5" />}
                title={
                  authorizedScopeList.length > 0
                    ? 'Ready to generate your Monthly Review'
                    : 'No pillars authorized for Monthly Review'
                }
                description={
                  authorizedScopeList.length > 0
                    ? 'Click Generate Monthly Review above to summarize only the pillars you authorized.'
                    : 'Select one or more pillars above to explicitly authorize Elevate Guide to include them in your review.'
                }
              />
            )}
          </Card>
        </div>
      )}

      {/* ==================== TAB 4: RUNWAY & GOALS ==================== */}
      {activeTab === 'runway' && (
        <div className="space-y-6">
          {/* Emergency Runway Planner */}
          <Card>
            <CardHeader
              title="Emergency Fund Runway Planner"
              subtitle="Adjust your target reserve horizon to see how your Flow cash assets cover essential monthly living costs"
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 space-y-5">
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

                <form
                  onSubmit={handleStageBaselineApproval}
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
                      Review & Apply
                    </Button>
                    {customMonthlyEssentialBaseline !== null && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setBaselineInput('');
                          updateGuideSettings({ customMonthlyEssentialBaseline: null });
                          setRunwayPendingApproval(null);
                        }}
                      >
                        Use Flow Auto
                      </Button>
                    )}
                  </div>
                </form>

                {runwayPendingApproval && (
                  <ActionApprovalCard
                    action={runwayPendingApproval.action}
                    currency={currency}
                    status={runwayPendingApproval.status}
                    sourceLabel={runwayPendingApproval.sourceLabel}
                    onApprove={() => {
                      applyApprovedAction(runwayPendingApproval.action);
                      setRunwayPendingApproval((prev) =>
                        prev ? { ...prev, status: 'approved' } : null
                      );
                    }}
                    onDecline={() => {
                      setRunwayPendingApproval((prev) =>
                        prev ? { ...prev, status: 'declined' } : null
                      );
                    }}
                  />
                )}
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
                    color={reserveProgressPct >= 100 ? '#1E8A78' : '#D5A64A'}
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
                title="Coaching Checklist"
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
              subtitle="Deterministic projection based on your current balance and planned monthly contribution (0% assumed return)"
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
                  const pct =
                    g.targetAmount > 0 ? (g.currentSaved / g.targetAmount) * 100 : 0;
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
        </div>
      )}

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
