import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  CategoryBudget,
  ElevateWorkspace,
  GuideSettings,
  InsurancePolicy,
  InvestmentHolding,
  ManualAccount,
  SavingsGoal,
  Transaction,
  ValuationSnapshot,
} from '../types/finance';
import { buildSampleTemplate, EMPTY_WORKSPACE } from '../data/sampleTemplate';
import { annualizePremium, daysUntil, generateId, getMonthKey, getTodayISO } from '../utils/format';

const STORAGE_KEY = 'elevate_financial_workspace_v1';

export interface CoachingActionItem {
  id: string;
  pillar: 'Flow' | 'Guide' | 'Wealth' | 'Secure';
  title: string;
  detail: string;
  priority: 'High' | 'Medium' | 'Routine';
  autoCompleted: boolean;
}

interface ElevateContextValue {
  workspace: ElevateWorkspace;
  // Derived cross-pillar metrics
  totalCashAssets: number;
  totalShortTermLiabilities: number;
  netCashBalance: number;
  totalPortfolioValue: number;
  totalPortfolioCost: number;
  portfolioUnrealizedGain: number;
  portfolioReturnPct: number;
  totalTrackedNetWorth: number;
  currentMonthKey: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyNetFlow: number;
  monthlySavingsRatePct: number;
  monthlyEssentialSpend: number;
  annualInsurancePremiums: number;
  monthlyInsuranceEquiv: number;
  upcomingRenewals: Array<InsurancePolicy & { daysRemaining: number }>;
  coachingActions: CoachingActionItem[];

  // Account actions
  addAccount: (account: Omit<ManualAccount, 'id' | 'updatedAt'>) => void;
  updateAccount: (id: string, patch: Partial<ManualAccount>) => void;
  deleteAccount: (id: string) => void;

  // Transaction actions
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;

  // Budget actions
  upsertBudget: (budget: Omit<CategoryBudget, 'id'> & { id?: string }) => void;
  deleteBudget: (id: string) => void;

  // Wealth actions
  addHolding: (holding: Omit<InvestmentHolding, 'id'>) => void;
  updateHolding: (id: string, patch: Partial<InvestmentHolding>) => void;
  deleteHolding: (id: string) => void;
  recordSnapshot: (note?: string) => void;
  deleteSnapshot: (id: string) => void;

  // Secure actions
  addPolicy: (policy: Omit<InsurancePolicy, 'id'>) => void;
  updatePolicy: (id: string, patch: Partial<InsurancePolicy>) => void;
  deletePolicy: (id: string) => void;

  // Guide actions
  addGoal: (goal: Omit<SavingsGoal, 'id'>) => void;
  updateGoal: (id: string, patch: Partial<SavingsGoal>) => void;
  deleteGoal: (id: string) => void;
  updateGuideSettings: (patch: Partial<GuideSettings>) => void;
  toggleCoachingAction: (actionId: string) => void;

  // Workspace management
  setCurrency: (currency: string) => void;
  loadSampleTemplate: () => void;
  clearWorkspace: () => void;
  importWorkspaceJSON: (raw: string) => { ok: boolean; error?: string };
}

const ElevateContext = createContext<ElevateContextValue | null>(null);

function loadInitialWorkspace(): ElevateWorkspace {
  if (typeof window === 'undefined') return EMPTY_WORKSPACE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_WORKSPACE;
    const parsed = JSON.parse(raw) as Partial<ElevateWorkspace>;
    return {
      ...EMPTY_WORKSPACE,
      ...parsed,
      guideSettings: {
        ...EMPTY_WORKSPACE.guideSettings,
        ...(parsed.guideSettings ?? {}),
      },
    };
  } catch {
    return EMPTY_WORKSPACE;
  }
}

export function ElevateProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<ElevateWorkspace>(loadInitialWorkspace);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [workspace]);

  const currentMonthKey = getTodayISO().slice(0, 7);

  const computed = useMemo(() => {
    const totalCashAssets = workspace.accounts
      .filter((a) => a.type !== 'Credit Card')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    const totalShortTermLiabilities = workspace.accounts
      .filter((a) => a.type === 'Credit Card')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    const netCashBalance = totalCashAssets - totalShortTermLiabilities;

    const totalPortfolioValue = workspace.holdings.reduce(
      (sum, h) => sum + (Number(h.currentValue) || 0),
      0
    );
    const totalPortfolioCost = workspace.holdings.reduce(
      (sum, h) => sum + (Number(h.costBasis) || 0),
      0
    );
    const portfolioUnrealizedGain = totalPortfolioValue - totalPortfolioCost;
    const portfolioReturnPct =
      totalPortfolioCost > 0 ? (portfolioUnrealizedGain / totalPortfolioCost) * 100 : 0;

    const totalTrackedNetWorth = netCashBalance + totalPortfolioValue;

    const currentMonthTx = workspace.transactions.filter(
      (t) => getMonthKey(t.date) === currentMonthKey
    );
    const monthlyIncome = currentMonthTx
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const monthlyExpenses = currentMonthTx
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const monthlyNetFlow = monthlyIncome - monthlyExpenses;
    const monthlySavingsRatePct =
      monthlyIncome > 0 ? (monthlyNetFlow / monthlyIncome) * 100 : 0;

    const monthlyEssentialSpend = currentMonthTx
      .filter((t) => t.type === 'expense' && (t.bucket ?? 'Needs') === 'Needs')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const annualInsurancePremiums = workspace.policies.reduce(
      (sum, p) => sum + annualizePremium(p.premiumAmount, p.premiumCadence),
      0
    );
    const monthlyInsuranceEquiv = annualInsurancePremiums / 12;

    const upcomingRenewals = workspace.policies
      .map((p) => {
        const d = daysUntil(p.renewalDate);
        return { ...p, daysRemaining: d ?? 9999 };
      })
      .filter((p) => p.daysRemaining <= 60)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    // Deterministic cross-pillar coaching checkpoints derived strictly from user entries
    const baselineMonthlyNeed =
      workspace.guideSettings.customMonthlyEssentialBaseline ??
      (monthlyEssentialSpend > 0 ? monthlyEssentialSpend : monthlyExpenses);

    const targetReserve =
      baselineMonthlyNeed * workspace.guideSettings.emergencyTargetMonths;

    const liquidReserve = workspace.accounts
      .filter((a) => a.type === 'Savings' || a.type === 'Cash Reserve' || a.type === 'Checking')
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    const coachingActions: CoachingActionItem[] = [
      {
        id: 'act_log_accounts',
        pillar: 'Flow',
        title: 'Establish your manual cash & account baseline',
        detail:
          workspace.accounts.length > 0
            ? `${workspace.accounts.length} account(s) logged totaling ${totalCashAssets.toLocaleString('en-US', { style: 'currency', currency: workspace.currency })} in cash assets.`
            : 'Add your checking, savings, or cash reserve balances in Elevate Flow.',
        priority: 'High',
        autoCompleted: workspace.accounts.length > 0,
      },
      {
        id: 'act_set_budgets',
        pillar: 'Flow',
        title: 'Assign monthly category budgets',
        detail:
          workspace.budgets.length > 0
            ? `${workspace.budgets.length} spending category limit(s) active for ${currentMonthKey}.`
            : 'Define limits for housing, groceries, and discretionary spending to track monthly pacing.',
        priority: 'Medium',
        autoCompleted: workspace.budgets.length > 0,
      },
      {
        id: 'act_emergency_runway',
        pillar: 'Guide',
        title: `Build ${workspace.guideSettings.emergencyTargetMonths}-month emergency runway`,
        detail:
          baselineMonthlyNeed > 0
            ? `Target reserve is ${targetReserve.toLocaleString('en-US', { style: 'currency', currency: workspace.currency })} based on ${baselineMonthlyNeed.toLocaleString('en-US', { style: 'currency', currency: workspace.currency })}/mo essentials.`
            : 'Log essential monthly expenses or set a baseline in Elevate Guide to calculate your target reserve.',
        priority: 'High',
        autoCompleted: baselineMonthlyNeed > 0 && liquidReserve >= targetReserve,
      },
      {
        id: 'act_record_holdings',
        pillar: 'Wealth',
        title: 'Log investment holdings & cost basis',
        detail:
          workspace.holdings.length > 0
            ? `${workspace.holdings.length} holding(s) tracked with user-confirmed valuations.`
            : 'Add your holdings in Elevate Wealth to calculate asset mix and unrealized gain/loss.',
        priority: 'Medium',
        autoCompleted: workspace.holdings.length > 0,
      },
      {
        id: 'act_secure_policies',
        pillar: 'Secure',
        title: 'Document core insurance policies & renewals',
        detail:
          workspace.policies.length > 0
            ? `${workspace.policies.length} active policy record(s) logged (${upcomingRenewals.length} renewing within 60 days).`
            : 'Record your health, life, disability, or property policies in Elevate Secure.',
        priority: upcomingRenewals.length > 0 ? 'High' : 'Medium',
        autoCompleted: workspace.policies.length >= 2 && upcomingRenewals.length === 0,
      },
    ];

    return {
      totalCashAssets,
      totalShortTermLiabilities,
      netCashBalance,
      totalPortfolioValue,
      totalPortfolioCost,
      portfolioUnrealizedGain,
      portfolioReturnPct,
      totalTrackedNetWorth,
      currentMonthKey,
      monthlyIncome,
      monthlyExpenses,
      monthlyNetFlow,
      monthlySavingsRatePct,
      monthlyEssentialSpend,
      annualInsurancePremiums,
      monthlyInsuranceEquiv,
      upcomingRenewals,
      coachingActions,
    };
  }, [workspace, currentMonthKey]);

  const addAccount = (account: Omit<ManualAccount, 'id' | 'updatedAt'>) => {
    setWorkspace((prev) => ({
      ...prev,
      accounts: [
        ...prev.accounts,
        { ...account, id: generateId('acc'), updatedAt: getTodayISO() },
      ],
    }));
  };

  const updateAccount = (id: string, patch: Partial<ManualAccount>) => {
    setWorkspace((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.id === id ? { ...a, ...patch, updatedAt: getTodayISO() } : a
      ),
    }));
  };

  const deleteAccount = (id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
    }));
  };

  const addTransaction = (tx: Omit<Transaction, 'id'>) => {
    setWorkspace((prev) => ({
      ...prev,
      transactions: [{ ...tx, id: generateId('tx') }, ...prev.transactions],
    }));
  };

  const deleteTransaction = (id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  };

  const upsertBudget = (budget: Omit<CategoryBudget, 'id'> & { id?: string }) => {
    setWorkspace((prev) => {
      if (budget.id) {
        return {
          ...prev,
          budgets: prev.budgets.map((b) =>
            b.id === budget.id ? { ...b, ...budget } : b
          ),
        };
      }
      const existing = prev.budgets.find(
        (b) => b.category.toLowerCase() === budget.category.trim().toLowerCase()
      );
      if (existing) {
        return {
          ...prev,
          budgets: prev.budgets.map((b) =>
            b.id === existing.id
              ? { ...b, monthlyLimit: budget.monthlyLimit, bucket: budget.bucket }
              : b
          ),
        };
      }
      return {
        ...prev,
        budgets: [...prev.budgets, { ...budget, id: generateId('bud') }],
      };
    });
  };

  const deleteBudget = (id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      budgets: prev.budgets.filter((b) => b.id !== id),
    }));
  };

  const addHolding = (holding: Omit<InvestmentHolding, 'id'>) => {
    setWorkspace((prev) => ({
      ...prev,
      holdings: [...prev.holdings, { ...holding, id: generateId('hold') }],
    }));
  };

  const updateHolding = (id: string, patch: Partial<InvestmentHolding>) => {
    setWorkspace((prev) => ({
      ...prev,
      holdings: prev.holdings.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }));
  };

  const deleteHolding = (id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      holdings: prev.holdings.filter((h) => h.id !== id),
    }));
  };

  const recordSnapshot = (note?: string) => {
    setWorkspace((prev) => {
      const cash =
        prev.accounts
          .filter((a) => a.type !== 'Credit Card')
          .reduce((s, a) => s + (Number(a.balance) || 0), 0) -
        prev.accounts
          .filter((a) => a.type === 'Credit Card')
          .reduce((s, a) => s + (Number(a.balance) || 0), 0);
      const invested = prev.holdings.reduce(
        (s, h) => s + (Number(h.currentValue) || 0),
        0
      );
      const snap: ValuationSnapshot = {
        id: generateId('snap'),
        date: getTodayISO(),
        totalInvestedValue: invested,
        totalCashValue: cash,
        note: note?.trim() || 'Manual net worth snapshot',
      };
      return {
        ...prev,
        snapshots: [...prev.snapshots, snap].sort((a, b) =>
          a.date.localeCompare(b.date)
        ),
      };
    });
  };

  const deleteSnapshot = (id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      snapshots: prev.snapshots.filter((s) => s.id !== id),
    }));
  };

  const addPolicy = (policy: Omit<InsurancePolicy, 'id'>) => {
    setWorkspace((prev) => ({
      ...prev,
      policies: [...prev.policies, { ...policy, id: generateId('pol') }],
    }));
  };

  const updatePolicy = (id: string, patch: Partial<InsurancePolicy>) => {
    setWorkspace((prev) => ({
      ...prev,
      policies: prev.policies.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };

  const deletePolicy = (id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      policies: prev.policies.filter((p) => p.id !== id),
    }));
  };

  const addGoal = (goal: Omit<SavingsGoal, 'id'>) => {
    setWorkspace((prev) => ({
      ...prev,
      goals: [...prev.goals, { ...goal, id: generateId('goal') }],
    }));
  };

  const updateGoal = (id: string, patch: Partial<SavingsGoal>) => {
    setWorkspace((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  };

  const deleteGoal = (id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      goals: prev.goals.filter((g) => g.id !== id),
    }));
  };

  const updateGuideSettings = (patch: Partial<GuideSettings>) => {
    setWorkspace((prev) => ({
      ...prev,
      guideSettings: { ...prev.guideSettings, ...patch },
    }));
  };

  const toggleCoachingAction = (actionId: string) => {
    setWorkspace((prev) => {
      const exists = prev.guideSettings.completedActionIds.includes(actionId);
      const next = exists
        ? prev.guideSettings.completedActionIds.filter((id) => id !== actionId)
        : [...prev.guideSettings.completedActionIds, actionId];
      return {
        ...prev,
        guideSettings: {
          ...prev.guideSettings,
          completedActionIds: next,
        },
      };
    });
  };

  const setCurrency = (currency: string) => {
    setWorkspace((prev) => ({ ...prev, currency }));
  };

  const loadSampleTemplate = () => {
    setWorkspace(buildSampleTemplate());
  };

  const clearWorkspace = () => {
    setWorkspace(EMPTY_WORKSPACE);
  };

  const importWorkspaceJSON = (raw: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(raw) as Partial<ElevateWorkspace>;
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, error: 'Invalid JSON file structure.' };
      }
      setWorkspace({
        ...EMPTY_WORKSPACE,
        ...parsed,
        isSampleTemplate: Boolean(parsed.isSampleTemplate),
        guideSettings: {
          ...EMPTY_WORKSPACE.guideSettings,
          ...(parsed.guideSettings ?? {}),
        },
      });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not parse JSON file.' };
    }
  };

  return (
    <ElevateContext.Provider
      value={{
        workspace,
        ...computed,
        addAccount,
        updateAccount,
        deleteAccount,
        addTransaction,
        deleteTransaction,
        upsertBudget,
        deleteBudget,
        addHolding,
        updateHolding,
        deleteHolding,
        recordSnapshot,
        deleteSnapshot,
        addPolicy,
        updatePolicy,
        deletePolicy,
        addGoal,
        updateGoal,
        deleteGoal,
        updateGuideSettings,
        toggleCoachingAction,
        setCurrency,
        loadSampleTemplate,
        clearWorkspace,
        importWorkspaceJSON,
      }}
    >
      {children}
    </ElevateContext.Provider>
  );
}

export function useElevate(): ElevateContextValue {
  const ctx = useContext(ElevateContext);
  if (!ctx) throw new Error('useElevate must be used inside ElevateProvider');
  return ctx;
}
