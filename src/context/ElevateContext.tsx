import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  CategoryBudget,
  ElevateWorkspace,
  FlowCategory,
  GuideAuthorizationScopes,
  GuideSettings,
  InsurancePolicy,
  InvestmentGoal,
  InvestmentHolding,
  ManualAccount,
  NavViewId,
  RecurringBill,
  SavingsGoal,
  TargetAllocations,
  Transaction,
  UserProfile,
  ValuationSnapshot,
} from '../types/finance';
import {
  advanceDueDate,
  annualizePremium,
  daysUntil,
  generateId,
  getMonthKey,
  getTodayISO,
  isValidISODate,
  monthlyEquivalentBill,
} from '../utils/format';

const WORKSPACE_STORAGE_KEY = 'elevate_financial_workspace_v1';
const SESSION_STORAGE_KEY = 'elevate_user_session_v1';

export const DEFAULT_FLOW_CATEGORIES: FlowCategory[] = [
  { id: 'cat_housing', name: 'Housing & Utilities', type: 'expense', bucket: 'Needs' },
  { id: 'cat_groceries', name: 'Groceries & Dining', type: 'expense', bucket: 'Needs' },
  { id: 'cat_transport', name: 'Transport & Transit', type: 'expense', bucket: 'Needs' },
  { id: 'cat_healthcare', name: 'Healthcare & Insurance', type: 'expense', bucket: 'Needs' },
  { id: 'cat_leisure', name: 'Personal & Leisure', type: 'expense', bucket: 'Wants' },
  { id: 'cat_savings', name: 'Goal Contributions', type: 'expense', bucket: 'Savings & Debt' },
  { id: 'cat_salary', name: 'Salary', type: 'income' },
  { id: 'cat_freelance', name: 'Freelance / Other Income', type: 'income' },
];

export const DEFAULT_GUIDE_AUTHORIZATIONS: GuideAuthorizationScopes = {
  flow: false,
  wealth: false,
  secure: false,
  guide: false,
};

export const EMPTY_WORKSPACE: ElevateWorkspace = {
  currency: 'USD',
  categories: DEFAULT_FLOW_CATEGORIES,
  accounts: [],
  transactions: [],
  budgets: [],
  recurringBills: [],
  holdings: [],
  investmentGoals: [],
  targetAllocations: {},
  snapshots: [],
  policies: [],
  secureChecklistIds: [],
  goals: [],
  guideSettings: {
    emergencyTargetMonths: 6,
    customMonthlyEssentialBaseline: null,
    completedActionIds: [],
    guideAuthorizations: { ...DEFAULT_GUIDE_AUTHORIZATIONS },
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
  isHydrating: boolean;
  storageError: string | null;
  clearStorageError: () => void;
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
  monthlyRecurringTotal: number;
  upcomingBills: Array<RecurringBill & { daysRemaining: number }>;
  annualInsurancePremiums: number;
  monthlyInsuranceEquiv: number;
  upcomingRenewals: Array<InsurancePolicy & { daysRemaining: number }>;
  activePolicyReminders: Array<InsurancePolicy & { daysRemaining: number }>;
  coachingActions: CoachingActionItem[];

  // Category actions
  addCategory: (category: Omit<FlowCategory, 'id'>) => { ok: boolean; error?: string };
  deleteCategory: (id: string) => void;

  // Account actions
  addAccount: (account: Omit<ManualAccount, 'id' | 'updatedAt'>) => void;
  updateAccount: (id: string, patch: Partial<ManualAccount>) => void;
  deleteAccount: (id: string) => void;

  // Transaction actions
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, 'id'>>) => void;
  deleteTransaction: (id: string) => void;

  // Budget actions
  upsertBudget: (budget: Omit<CategoryBudget, 'id'> & { id?: string }) => void;
  deleteBudget: (id: string) => void;

  // Recurring bills actions
  addRecurringBill: (bill: Omit<RecurringBill, 'id'>) => void;
  updateRecurringBill: (id: string, patch: Partial<Omit<RecurringBill, 'id'>>) => void;
  deleteRecurringBill: (id: string) => void;
  logRecurringBillPayment: (id: string) => void;

  // Wealth actions
  addHolding: (holding: Omit<InvestmentHolding, 'id'>) => void;
  updateHolding: (id: string, patch: Partial<InvestmentHolding>) => void;
  deleteHolding: (id: string) => void;
  addInvestmentGoal: (goal: Omit<InvestmentGoal, 'id'>) => void;
  updateInvestmentGoal: (id: string, patch: Partial<Omit<InvestmentGoal, 'id'>>) => void;
  deleteInvestmentGoal: (id: string) => void;
  setTargetAllocations: (targets: TargetAllocations) => void;
  recordSnapshot: (note?: string) => void;
  deleteSnapshot: (id: string) => void;

  // Secure actions
  addPolicy: (policy: Omit<InsurancePolicy, 'id'>) => void;
  updatePolicy: (id: string, patch: Partial<InsurancePolicy>) => void;
  deletePolicy: (id: string) => void;
  renewPolicyOneYear: (id: string) => void;
  toggleSecureChecklist: (itemId: string) => void;

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

function loadInitialWorkspace(): { data: ElevateWorkspace; error: string | null } {
  if (typeof window === 'undefined') return { data: EMPTY_WORKSPACE, error: null };
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return { data: EMPTY_WORKSPACE, error: null };
    const parsed = JSON.parse(raw) as Partial<ElevateWorkspace> & {
      isSampleTemplate?: boolean;
    };
    if (parsed.isSampleTemplate) {
      return { data: EMPTY_WORKSPACE, error: null };
    }
    const normalizedPolicies: InsurancePolicy[] = Array.isArray(parsed.policies)
      ? parsed.policies.map((p) => ({
          ...p,
          status: p.status ?? 'Active',
          reminderLeadDays:
            typeof p.reminderLeadDays === 'number' && p.reminderLeadDays > 0
              ? p.reminderLeadDays
              : 30,
        }))
      : [];

    return {
      data: {
        ...EMPTY_WORKSPACE,
        currency: parsed.currency ?? EMPTY_WORKSPACE.currency,
        categories:
          Array.isArray(parsed.categories) && parsed.categories.length > 0
            ? parsed.categories
            : DEFAULT_FLOW_CATEGORIES,
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
        recurringBills: Array.isArray(parsed.recurringBills)
          ? parsed.recurringBills
          : [],
        holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
        investmentGoals: Array.isArray(parsed.investmentGoals)
          ? parsed.investmentGoals
          : [],
        targetAllocations:
          parsed.targetAllocations && typeof parsed.targetAllocations === 'object'
            ? parsed.targetAllocations
            : {},
        snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
        policies: normalizedPolicies,
        secureChecklistIds: Array.isArray(parsed.secureChecklistIds)
          ? parsed.secureChecklistIds
          : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals : [],
        guideSettings: {
          ...EMPTY_WORKSPACE.guideSettings,
          ...(parsed.guideSettings ?? {}),
          guideAuthorizations: {
            ...DEFAULT_GUIDE_AUTHORIZATIONS,
            ...(parsed.guideSettings?.guideAuthorizations ?? {}),
          },
        },
      },
      error: null,
    };
  } catch {
    return {
      data: EMPTY_WORKSPACE,
      error:
        'Saved workspace data could not be read cleanly. Starting with an empty workspace.',
    };
  }
}

export function ElevateProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(loadInitialSession);
  const [initialResult] = useState(loadInitialWorkspace);
  const [workspace, setWorkspace] = useState<ElevateWorkspace>(initialResult.data);
  const [storageError, setStorageError] = useState<string | null>(initialResult.error);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsHydrating(false), 160);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      if (user) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      setStorageError('Unable to persist session changes to browser storage.');
    }
  }, [user]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      setStorageError(
        'Browser storage quota exceeded or blocked. Export a JSON backup to avoid losing entries.'
      );
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

    const monthlyRecurringTotal = workspace.recurringBills
      .filter((b) => b.active)
      .reduce((sum, b) => sum + monthlyEquivalentBill(b.amount, b.cadence), 0);

    const upcomingBills = workspace.recurringBills
      .filter((b) => b.active)
      .map((b) => ({
        ...b,
        daysRemaining: daysUntil(b.nextDueDate) ?? 9999,
      }))
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    const activePolicies = workspace.policies.filter(
      (p) => p.status !== 'Archived'
    );

    const annualInsurancePremiums = activePolicies.reduce(
      (sum, p) => sum + annualizePremium(p.premiumAmount, p.premiumCadence),
      0
    );
    const monthlyInsuranceEquiv = annualInsurancePremiums / 12;

    const upcomingRenewals = activePolicies
      .map((p) => {
        const d = daysUntil(p.renewalDate);
        return { ...p, daysRemaining: d ?? 9999 };
      })
      .filter((p) => p.daysRemaining <= 60)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    const activePolicyReminders = activePolicies
      .map((p) => {
        const d = daysUntil(p.renewalDate);
        return { ...p, daysRemaining: d ?? 9999 };
      })
      .filter((p) => p.daysRemaining <= (p.reminderLeadDays || 30))
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
            ? `${workspace.holdings.length} holding(s) tracked with user-entered valuations.`
            : 'Add brokerage or retirement holdings using your latest statement balances.',
        ctaLabel: 'Open Wealth',
        priority: 'Medium',
        autoCompleted: workspace.holdings.length > 0,
      },
      {
        id: 'act_secure_policies',
        pillar: 'Secure',
        targetView: 'secure',
        title: 'Document insurance policies & renewal reminders',
        detail:
          activePolicies.length > 0
            ? `${activePolicies.length} active policy record(s) logged (${activePolicyReminders.length} within reminder window).`
            : 'Log health, life, disability, auto, or home policies in Elevate Secure.',
        ctaLabel: 'Open Secure',
        priority: activePolicyReminders.length > 0 ? 'High' : 'Medium',
        autoCompleted:
          activePolicies.length > 0 && activePolicyReminders.length === 0,
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
      monthlyRecurringTotal,
      upcomingBills,
      annualInsurancePremiums,
      monthlyInsuranceEquiv,
      upcomingRenewals,
      activePolicyReminders,
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

  const addCategory = (
    category: Omit<FlowCategory, 'id'>
  ): { ok: boolean; error?: string } => {
    const cleanName = category.name.trim();
    if (!cleanName) return { ok: false, error: 'Category name is required.' };
    const duplicate = workspace.categories.some(
      (c) =>
        c.name.toLowerCase() === cleanName.toLowerCase() &&
        c.type === category.type
    );
    if (duplicate) {
      return {
        ok: false,
        error: `A ${category.type} category named "${cleanName}" already exists.`,
      };
    }
    setWorkspace((prev) => ({
      ...prev,
      categories: [
        ...prev.categories,
        { ...category, name: cleanName, id: generateId('cat') },
      ],
    }));
    return { ok: true };
  };

  const deleteCategory = (id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== id),
    }));
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

  const updateTransaction = (
    id: string,
    patch: Partial<Omit<Transaction, 'id'>>
  ) => {
    setWorkspace((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === id ? { ...t, ...patch } : t
      ),
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

  const addRecurringBill = (bill: Omit<RecurringBill, 'id'>) => {
    setWorkspace((prev) => ({
      ...prev,
      recurringBills: [
        ...prev.recurringBills,
        { ...bill, id: generateId('bill') },
      ],
    }));
  };

  const updateRecurringBill = (
    id: string,
    patch: Partial<Omit<RecurringBill, 'id'>>
  ) => {
    setWorkspace((prev) => ({
      ...prev,
      recurringBills: prev.recurringBills.map((b) =>
        b.id === id ? { ...b, ...patch } : b
      ),
    }));
  };

  const deleteRecurringBill = (id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      recurringBills: prev.recurringBills.filter((b) => b.id !== id),
    }));
  };

  const logRecurringBillPayment = (id: string) => {
    setWorkspace((prev) => {
      const bill = prev.recurringBills.find((b) => b.id === id);
      if (!bill) return prev;
      const newTx: Transaction = {
        id: generateId('tx'),
        date: getTodayISO(),
        description: `${bill.title} (Recurring)`,
        category: bill.category,
        type: 'expense',
        bucket: bill.bucket,
        amount: bill.amount,
        accountId: bill.accountId,
        notes: `Logged from recurring bill (${bill.cadence})`,
      };
      const nextDue = advanceDueDate(bill.nextDueDate, bill.cadence);
      return {
        ...prev,
        transactions: [newTx, ...prev.transactions],
        recurringBills: prev.recurringBills.map((b) =>
          b.id === id ? { ...b, nextDueDate: nextDue } : b
        ),
      };
    });
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

  const addInvestmentGoal = (goal: Omit<InvestmentGoal, 'id'>) => {
    setWorkspace((prev) => ({
      ...prev,
      investmentGoals: [
        ...prev.investmentGoals,
        { ...goal, id: generateId('ig') },
      ],
    }));
  };

  const updateInvestmentGoal = (
    id: string,
    patch: Partial<Omit<InvestmentGoal, 'id'>>
  ) => {
    setWorkspace((prev) => ({
      ...prev,
      investmentGoals: prev.investmentGoals.map((g) =>
        g.id === id ? { ...g, ...patch } : g
      ),
    }));
  };

  const deleteInvestmentGoal = (id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      investmentGoals: prev.investmentGoals.filter((g) => g.id !== id),
    }));
  };

  const setTargetAllocations = (targets: TargetAllocations) => {
    setWorkspace((prev) => ({
      ...prev,
      targetAllocations: targets,
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

  const renewPolicyOneYear = (id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      policies: prev.policies.map((p) => {
        if (p.id !== id) return p;
        const base = isValidISODate(p.renewalDate)
          ? new Date(`${p.renewalDate}T00:00:00`)
          : new Date();
        base.setFullYear(base.getFullYear() + 1);
        return {
          ...p,
          status: 'Active',
          renewalDate: base.toISOString().slice(0, 10),
        };
      }),
    }));
  };

  const toggleSecureChecklist = (itemId: string) => {
    setWorkspace((prev) => {
      const exists = prev.secureChecklistIds.includes(itemId);
      return {
        ...prev,
        secureChecklistIds: exists
          ? prev.secureChecklistIds.filter((i) => i !== itemId)
          : [...prev.secureChecklistIds, itemId],
      };
    });
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
        categories:
          Array.isArray(parsed.categories) && parsed.categories.length > 0
            ? parsed.categories
            : DEFAULT_FLOW_CATEGORIES,
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
        recurringBills: Array.isArray(parsed.recurringBills)
          ? parsed.recurringBills
          : [],
        holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
        investmentGoals: Array.isArray(parsed.investmentGoals)
          ? parsed.investmentGoals
          : [],
        targetAllocations:
          parsed.targetAllocations && typeof parsed.targetAllocations === 'object'
            ? parsed.targetAllocations
            : {},
        snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
        policies: Array.isArray(parsed.policies) ? parsed.policies : [],
        secureChecklistIds: Array.isArray(parsed.secureChecklistIds)
          ? parsed.secureChecklistIds
          : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals : [],
        guideSettings: {
          ...EMPTY_WORKSPACE.guideSettings,
          ...(parsed.guideSettings ?? {}),
          guideAuthorizations: {
            ...DEFAULT_GUIDE_AUTHORIZATIONS,
            ...(parsed.guideSettings?.guideAuthorizations ?? {}),
          },
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
        isHydrating,
        storageError,
        clearStorageError: () => setStorageError(null),
        signIn,
        updateProfile,
        signOut,
        workspace,
        ...computed,
        addCategory,
        deleteCategory,
        addAccount,
        updateAccount,
        deleteAccount,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        upsertBudget,
        deleteBudget,
        addRecurringBill,
        updateRecurringBill,
        deleteRecurringBill,
        logRecurringBillPayment,
        addHolding,
        updateHolding,
        deleteHolding,
        addInvestmentGoal,
        updateInvestmentGoal,
        deleteInvestmentGoal,
        setTargetAllocations,
        recordSnapshot,
        deleteSnapshot,
        addPolicy,
        updatePolicy,
        deletePolicy,
        renewPolicyOneYear,
        toggleSecureChecklist,
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
