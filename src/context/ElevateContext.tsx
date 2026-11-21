import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  CategoryBudget,
  ElevateWorkspace,
  GuideSettings,
  InsurancePolicy,
  InvestmentHolding,
  ManualAccount,
  NavViewId,
  SavingsGoal,
  Transaction,
  UserProfile,
  ValuationSnapshot,
} from '../types/finance';
import { annualizePremium, daysUntil, generateId, getMonthKey, getTodayISO } from '../utils/format';

const WORKSPACE_STORAGE_KEY = 'elevate_financial_workspace_v1';
const SESSION_STORAGE_KEY = 'elevate_user_session_v1';

export const EMPTY_WORKSPACE: ElevateWorkspace = {
  currency: 'USD',
  accounts: [],
  transactions: [],
  budgets: [],
  holdings: [],
  snapshots: [],
  policies: [],
  goals: [],
  guideSettings: {
    emergencyTargetMonths: 6,
    customMonthlyEssentialBaseline: null,
    completedActionIds: [],
  },
};

export interface CoachingActionItem {
  id: string;
  pillar: 'Flow' | 'Guide' | 'Wealth' | 'Secure';
  targetView: NavViewId;
  title: string;
  detail: string;
  ctaLabel: string;
  priority: 'High' | 'Medium' | 'Routine';
  autoCompleted: boolean;
}

interface ElevateContextValue {
  user: UserProfile | null;
  signIn: (profile: { name: string; email: string }) => void;
  updateProfile: (patch: Partial<Pick<UserProfile, 'name' | 'email'>>) => void;
  signOut: () => void;

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
  totalMonthlyBudgetLimit: number;
  totalMonthlyBudgetSpent: number;
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
  clearWorkspace: () => void;
  importWorkspaceJSON: (raw: string) => { ok: boolean; error?: string };
}

const ElevateContext = createContext<ElevateContextValue | null>(null);

function loadInitialSession(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    if (!parsed || !parsed.name) return null;
    return {
      name: parsed.name,
      email: parsed.email ?? '',
      signedInAt: parsed.signedInAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function loadInitialWorkspace(): ElevateWorkspace {
  if (typeof window === 'undefined') return EMPTY_WORKSPACE;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return EMPTY_WORKSPACE;
    const parsed = JSON.parse(raw) as Partial<ElevateWorkspace> & {
      isSampleTemplate?: boolean;
    };
    // Ensure we never carry over any prior sample template data automatically
    if (parsed.isSampleTemplate) {
      return EMPTY_WORKSPACE;
    }
    return {
      ...EMPTY_WORKSPACE,
      currency: parsed.currency ?? EMPTY_WORKSPACE.currency,
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
      holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
      policies: Array.isArray(parsed.policies) ? parsed.policies : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
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
  const [user, setUser] = useState<UserProfile | null>(loadInitialSession);
  const [workspace, setWorkspace] = useState<ElevateWorkspace>(loadInitialWorkspace);

  useEffect(() => {
    try {
      if (user) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [user]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      // Ignore storage quota errors
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

    const totalMonthlyBudgetLimit = workspace.budgets.reduce(
      (sum, b) => sum + (Number(b.monthlyLimit) || 0),
      0
    );

    const budgetCategoryNames = new Set(
      workspace.budgets.map((b) => b.category.toLowerCase())
    );
    const totalMonthlyBudgetSpent = currentMonthTx
      .filter(
        (t) =>
          t.type === 'expense' &&
          budgetCategoryNames.has(t.category.toLowerCase())
      )
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

    const baselineMonthlyNeed =
      workspace.guideSettings.customMonthlyEssentialBaseline ??
      (monthlyEssentialSpend > 0 ? monthlyEssentialSpend : monthlyExpenses);

    const targetReserve =
      baselineMonthlyNeed * workspace.guideSettings.emergencyTargetMonths;

    const liquidReserve = workspace.accounts
      .filter(
        (a) =>
          a.type === 'Savings' ||
          a.type === 'Cash Reserve' ||
          a.type === 'Checking'
      )
      .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    const coachingActions: CoachingActionItem[] = [
      {
        id: 'act_log_accounts',
        pillar: 'Flow',
        targetView: 'flow',
        title: 'Establish your cash & card account balances',
        detail:
          workspace.accounts.length > 0
            ? `${workspace.accounts.length} manual account(s) logged totaling ${totalCashAssets.toLocaleString('en-US', { style: 'currency', currency: workspace.currency })}.`
            : 'Add your checking, savings, or cash reserve accounts in Elevate Flow.',
        ctaLabel: 'Open Flow',
        priority: 'High',
        autoCompleted: workspace.accounts.length > 0,
      },
      {
        id: 'act_log_cashflow',
        pillar: 'Flow',
        targetView: 'flow',
        title: 'Log this month’s income and expenses',
        detail:
          currentMonthTx.length > 0
            ? `${currentMonthTx.length} entry(ies) recorded for ${currentMonthKey}.`
            : 'Record your income deposits and recurring expenses to unlock budget pacing.',
        ctaLabel: 'Log Cash Flow',
        priority: 'High',
        autoCompleted: currentMonthTx.length > 0,
      },
      {
        id: 'act_set_budgets',
        pillar: 'Flow',
        targetView: 'flow',
        title: 'Set monthly category budgets',
        detail:
          workspace.budgets.length > 0
            ? `${workspace.budgets.length} spending limit(s) active for ${currentMonthKey}.`
            : 'Define monthly limits for housing, groceries, or discretionary categories.',
        ctaLabel: 'Set Budgets',
        priority: 'Medium',
        autoCompleted: workspace.budgets.length > 0,
      },
      {
        id: 'act_emergency_runway',
        pillar: 'Guide',
        targetView: 'guide',
        title: `Build a ${workspace.guideSettings.emergencyTargetMonths}-month emergency reserve`,
        detail:
          baselineMonthlyNeed > 0
            ? `Target reserve is ${targetReserve.toLocaleString('en-US', { style: 'currency', currency: workspace.currency })} based on ${baselineMonthlyNeed.toLocaleString('en-US', { style: 'currency', currency: workspace.currency })}/mo essentials.`
            : 'Log essential expenses or enter a monthly baseline in Guide to size your emergency target.',
        ctaLabel: 'Plan Runway',
        priority: 'High',
        autoCompleted: baselineMonthlyNeed > 0 && liquidReserve >= targetReserve,
      },
      {
        id: 'act_record_holdings',
        pillar: 'Wealth',
        targetView: 'wealth',
        title: 'Record investment holdings & cost basis',
        detail:
          workspace.holdings.length > 0
            ? `${workspace.holdings.length} holding(s) tracked with confirmed valuations.`
            : 'Add brokerage or retirement holdings using your latest statement balances.',
        ctaLabel: 'Open Wealth',
        priority: 'Medium',
        autoCompleted: workspace.holdings.length > 0,
      },
      {
        id: 'act_secure_policies',
        pillar: 'Secure',
        targetView: 'secure',
        title: 'Document insurance policies & renewal dates',
        detail:
          workspace.policies.length > 0
            ? `${workspace.policies.length} active policy record(s) logged (${upcomingRenewals.length} renewing within 60 days).`
            : 'Log health, life, disability, auto, or home policies in Elevate Secure.',
        ctaLabel: 'Open Secure',
        priority: upcomingRenewals.length > 0 ? 'High' : 'Medium',
        autoCompleted:
          workspace.policies.length > 0 && upcomingRenewals.length === 0,
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
      totalMonthlyBudgetLimit,
      totalMonthlyBudgetSpent,
      annualInsurancePremiums,
      monthlyInsuranceEquiv,
      upcomingRenewals,
      coachingActions,
    };
  }, [workspace, currentMonthKey]);

  const signIn = (profile: { name: string; email: string }) => {
    setUser({
      name: profile.name.trim() || 'Member',
      email: profile.email.trim(),
      signedInAt: new Date().toISOString(),
    });
  };

  const updateProfile = (patch: Partial<Pick<UserProfile, 'name' | 'email'>>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const signOut = () => {
    setUser(null);
  };

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
        currency: parsed.currency ?? EMPTY_WORKSPACE.currency,
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
        holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
        snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
        policies: Array.isArray(parsed.policies) ? parsed.policies : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals : [],
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
        user,
        signIn,
        updateProfile,
        signOut,
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
