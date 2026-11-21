import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AuditLogEntry,
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
  PlanDefinition,
  PlanEntitlementFlags,
  PlanTier,
  RecurringBill,
  SavingsGoal,
  ServerBackupMetadata,
  ServerEntitlementState,
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

const FALLBACK_BASIC_ENTITLEMENTS: PlanEntitlementFlags = {
  coreDashboard: true,
  manualFlowTracking: true,
  maxBudgets: 4,
  manualWealthHoldings: true,
  maxGoals: 3,
  securePoliciesAndReminders: true,
  aiMonthlyQuota: 5,
  advancedSpendingInsights: false,
  cashFlowForecasting: false,
  scenarioComparisons: false,
  richerPortfolioAnalysis: false,
  coverageSummaries: false,
  downloadableReports: false,
};

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

export type WorkspaceSyncStatus = 'idle' | 'saving' | 'saved' | 'error';

function addOneYearISOCalendar(isoDate: string): string {
  const base = isValidISODate(isoDate) ? isoDate : getTodayISO();
  const [y, m, d] = base.split('-').map(Number);
  const targetYear = y + 1;
  const maxDay = new Date(Date.UTC(targetYear, m, 0)).getUTCDate();
  const clampedDay = Math.min(d, maxDay);
  return `${String(targetYear).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

function normalizeWorkspaceFromServer(
  raw: Partial<ElevateWorkspace> | null | undefined
): ElevateWorkspace {
  if (!raw || typeof raw !== 'object') return EMPTY_WORKSPACE;
  const normalizedPolicies: InsurancePolicy[] = Array.isArray(raw.policies)
    ? raw.policies.map((p) => ({
        ...p,
        status: p.status ?? 'Active',
        reminderLeadDays:
          typeof p.reminderLeadDays === 'number' && p.reminderLeadDays > 0
            ? p.reminderLeadDays
            : 30,
      }))
    : [];

  return {
    ...EMPTY_WORKSPACE,
    currency: raw.currency ?? EMPTY_WORKSPACE.currency,
    categories:
      Array.isArray(raw.categories) && raw.categories.length > 0
        ? raw.categories
        : DEFAULT_FLOW_CATEGORIES,
    accounts: Array.isArray(raw.accounts) ? raw.accounts : [],
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    budgets: Array.isArray(raw.budgets) ? raw.budgets : [],
    recurringBills: Array.isArray(raw.recurringBills) ? raw.recurringBills : [],
    holdings: Array.isArray(raw.holdings) ? raw.holdings : [],
    investmentGoals: Array.isArray(raw.investmentGoals) ? raw.investmentGoals : [],
    targetAllocations:
      raw.targetAllocations && typeof raw.targetAllocations === 'object'
        ? raw.targetAllocations
        : {},
    snapshots: Array.isArray(raw.snapshots) ? raw.snapshots : [],
    policies: normalizedPolicies,
    secureChecklistIds: Array.isArray(raw.secureChecklistIds)
      ? raw.secureChecklistIds
      : [],
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    guideSettings: {
      ...EMPTY_WORKSPACE.guideSettings,
      ...(raw.guideSettings ?? {}),
      guideAuthorizations: {
        ...DEFAULT_GUIDE_AUTHORIZATIONS,
        ...(raw.guideSettings?.guideAuthorizations ?? {}),
      },
    },
  };
}

interface ElevateContextValue {
  user: UserProfile | null;
  authToken: string | null;
  isHydrating: boolean;
  storageError: string | null;
  syncStatus: WorkspaceSyncStatus;
  clearStorageError: () => void;
  register: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  login: (input: {
    email: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  updateProfile: (
    patch: Partial<Pick<UserProfile, 'name' | 'email'>>
  ) => Promise<{ ok: boolean; error?: string }>;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;

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

  // Entitlements & Plans (Server-Side)
  planCatalog: PlanDefinition[];
  entitlement: ServerEntitlementState | null;
  entitlements: PlanEntitlementFlags;
  entitlementLoading: boolean;
  entitlementError: string | null;
  clearEntitlementError: () => void;
  totalGoalsCount: number;
  canAddMoreGoals: boolean;
  canAddMoreBudgets: boolean;
  refreshEntitlement: () => Promise<void>;
  updateEntitlementFromServer: (next: ServerEntitlementState) => void;
  changeSubscriptionPlan: (
    targetPlan: PlanTier,
    timing?: 'period_end' | 'immediate'
  ) => Promise<{ ok: boolean; error?: string }>;
  cancelOrReactivatePlan: (options: {
    timing?: 'period_end' | 'immediate';
    reactivate?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  requestAuthorizedReportExport: (
    reportType: string
  ) => Promise<{ ok: boolean; error?: string }>;

  // Backups & Audit Logs (Server-Side)
  backups: ServerBackupMetadata[];
  backupsLoading: boolean;
  auditLogs: AuditLogEntry[];
  refreshBackups: () => Promise<void>;
  createServerBackup: (note?: string) => Promise<{ ok: boolean; error?: string }>;
  restoreServerBackup: (backupId: string) => Promise<{ ok: boolean; error?: string }>;
  downloadServerBackup: (backupId: string) => Promise<{ ok: boolean; error?: string }>;
  refreshAuditLogs: () => Promise<void>;

  // Workspace management
  setCurrency: (currency: string) => void;
  clearWorkspace: () => Promise<{ ok: boolean; error?: string }>;
  importWorkspaceJSON: (raw: string) => Promise<{ ok: boolean; error?: string }>;
}

const ElevateContext = createContext<ElevateContextValue | null>(null);

export function ElevateProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const authTokenRef = useRef<string | null>(null);

  const [workspace, setWorkspace] = useState<ElevateWorkspace>(EMPTY_WORKSPACE);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<WorkspaceSyncStatus>('idle');
  const [isHydrating, setIsHydrating] = useState(true);

  const [planCatalog, setPlanCatalog] = useState<PlanDefinition[]>([]);
  const [entitlement, setEntitlement] = useState<ServerEntitlementState | null>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(false);
  const [entitlementError, setEntitlementError] = useState<string | null>(null);

  const [backups, setBackups] = useState<ServerBackupMetadata[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const dirtyRef = useRef(false);
  const [mutationSeq, setMutationSeq] = useState(0);

  const setTokenState = useCallback((next: string | null) => {
    authTokenRef.current = next;
    setAuthToken(next);
  }, []);

  const hydrateServerWorkspace = useCallback((ws: Partial<ElevateWorkspace>) => {
    dirtyRef.current = false;
    setWorkspace(normalizeWorkspaceFromServer(ws));
    setSyncStatus('idle');
    setStorageError(null);
  }, []);

  const mutateWorkspace = useCallback(
    (updater: (prev: ElevateWorkspace) => ElevateWorkspace) => {
      dirtyRef.current = true;
      setWorkspace((prev) => updater(prev));
      setMutationSeq((s) => s + 1);
    },
    []
  );

  // Load public plan catalog on mount
  useEffect(() => {
    let active = true;
    const loadPlans = async () => {
      try {
        const res = await fetch('/api/plans');
        if (res.ok && active) {
          const json = await res.json();
          if (Array.isArray(json?.plans)) {
            setPlanCatalog(json.plans);
          }
        }
      } catch {
        // Non-fatal on boot
      } finally {
        if (active) setIsHydrating(false);
      }
    };
    loadPlans();
    return () => {
      active = false;
    };
  }, []);

  const authedFetch = useCallback(
    async (url: string, init?: RequestInit): Promise<Response> => {
      const token = authTokenRef.current;
      return fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    },
    []
  );

  const refreshBackups = useCallback(async () => {
    if (!authTokenRef.current) return;
    setBackupsLoading(true);
    try {
      const res = await authedFetch('/api/backups', { method: 'GET' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data?.backups)) {
        setBackups(data.backups);
      }
    } catch {
      // Non-fatal background refresh
    } finally {
      setBackupsLoading(false);
    }
  }, [authedFetch]);

  const refreshAuditLogs = useCallback(async () => {
    if (!authTokenRef.current) return;
    try {
      const res = await authedFetch('/api/audit-logs', { method: 'GET' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data?.logs)) {
        setAuditLogs(data.logs);
      }
    } catch {
      // Non-fatal background refresh
    }
  }, [authedFetch]);

  // Debounced server sync when authenticated user mutates workspace
  useEffect(() => {
    if (mutationSeq === 0 || !dirtyRef.current || !authTokenRef.current) {
      return;
    }

    let cancelled = false;
    setSyncStatus('saving');
    const timer = window.setTimeout(async () => {
      if (cancelled || !authTokenRef.current) return;
      try {
        const res = await authedFetch('/api/workspace', {
          method: 'PUT',
          body: JSON.stringify({ workspace }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setSyncStatus('error');
          setStorageError(
            data?.error || 'Could not save your latest change to the server.'
          );
          if (res.status === 401) {
            setTokenState(null);
            setUser(null);
          }
          return;
        }
        dirtyRef.current = false;
        setSyncStatus('saved');
        setStorageError(null);
      } catch {
        if (!cancelled) {
          setSyncStatus('error');
          setStorageError('Network error saving workspace changes to the server.');
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mutationSeq, workspace, authedFetch, setTokenState]);

  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.token || !data?.user) {
          return {
            ok: false,
            error: data?.error || 'Unable to create your Elevate account.',
          };
        }
        setTokenState(data.token);
        setUser(data.user as UserProfile);
        hydrateServerWorkspace(data.workspace);
        if (data.entitlement) setEntitlement(data.entitlement);
        setEntitlementError(null);
        void refreshBackups();
        void refreshAuditLogs();
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error creating account.' };
      }
    },
    [hydrateServerWorkspace, refreshAuditLogs, refreshBackups, setTokenState]
  );

  const login = useCallback(
    async (input: {
      email: string;
      password: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.token || !data?.user) {
          return {
            ok: false,
            error: data?.error || 'Invalid email or password.',
          };
        }
        setTokenState(data.token);
        setUser(data.user as UserProfile);
        hydrateServerWorkspace(data.workspace);
        if (data.entitlement) setEntitlement(data.entitlement);
        setEntitlementError(null);
        void refreshBackups();
        void refreshAuditLogs();
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error signing in.' };
      }
    },
    [hydrateServerWorkspace, refreshAuditLogs, refreshBackups, setTokenState]
  );

  const updateProfile = useCallback(
    async (
      patch: Partial<Pick<UserProfile, 'name' | 'email'>>
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authedFetch('/api/auth/profile', {
          method: 'PATCH',
          body: JSON.stringify(patch),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.user) {
          return { ok: false, error: data?.error || 'Failed to update profile.' };
        }
        setUser(data.user as UserProfile);
        void refreshAuditLogs();
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error updating profile.' };
      }
    },
    [authedFetch, refreshAuditLogs]
  );

  const changePassword = useCallback(
    async (input: {
      currentPassword: string;
      newPassword: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authedFetch('/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify(input),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.token || !data?.user) {
          return { ok: false, error: data?.error || 'Failed to update password.' };
        }
        setTokenState(data.token);
        setUser(data.user as UserProfile);
        void refreshAuditLogs();
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error updating password.' };
      }
    },
    [authedFetch, refreshAuditLogs, setTokenState]
  );

  const signOut = useCallback(async () => {
    const token = authTokenRef.current;
    // Clear in-memory state immediately so no prior user's records linger
    dirtyRef.current = false;
    setTokenState(null);
    setUser(null);
    setWorkspace(EMPTY_WORKSPACE);
    setEntitlement(null);
    setBackups([]);
    setAuditLogs([]);
    setStorageError(null);
    setEntitlementError(null);
    setSyncStatus('idle');
    setMutationSeq(0);

    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Best-effort revocation; local session is already cleared
      }
    }
  }, [setTokenState]);

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
    mutateWorkspace((prev) => ({
      ...prev,
      categories: [
        ...prev.categories,
        { ...category, name: cleanName, id: generateId('cat') },
      ],
    }));
    return { ok: true };
  };

  const deleteCategory = (id: string) => {
    mutateWorkspace((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== id),
    }));
  };

  const addAccount = (account: Omit<ManualAccount, 'id' | 'updatedAt'>) => {
    mutateWorkspace((prev) => ({
      ...prev,
      accounts: [
        ...prev.accounts,
        { ...account, id: generateId('acc'), updatedAt: getTodayISO() },
      ],
    }));
  };

  const updateAccount = (id: string, patch: Partial<ManualAccount>) => {
    mutateWorkspace((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.id === id ? { ...a, ...patch, updatedAt: getTodayISO() } : a
      ),
    }));
  };

  const deleteAccount = (id: string) => {
    mutateWorkspace((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
    }));
  };

  const addTransaction = (tx: Omit<Transaction, 'id'>) => {
    mutateWorkspace((prev) => ({
      ...prev,
      transactions: [{ ...tx, id: generateId('tx') }, ...prev.transactions],
    }));
  };

  const updateTransaction = (
    id: string,
    patch: Partial<Omit<Transaction, 'id'>>
  ) => {
    mutateWorkspace((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === id ? { ...t, ...patch } : t
      ),
    }));
  };

  const deleteTransaction = (id: string) => {
    mutateWorkspace((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  };

  const upsertBudget = (budget: Omit<CategoryBudget, 'id'> & { id?: string }) => {
    mutateWorkspace((prev) => {
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
    mutateWorkspace((prev) => ({
      ...prev,
      budgets: prev.budgets.filter((b) => b.id !== id),
    }));
  };

  const addRecurringBill = (bill: Omit<RecurringBill, 'id'>) => {
    mutateWorkspace((prev) => ({
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
    mutateWorkspace((prev) => ({
      ...prev,
      recurringBills: prev.recurringBills.map((b) =>
        b.id === id ? { ...b, ...patch } : b
      ),
    }));
  };

  const deleteRecurringBill = (id: string) => {
    mutateWorkspace((prev) => ({
      ...prev,
      recurringBills: prev.recurringBills.filter((b) => b.id !== id),
    }));
  };

  const logRecurringBillPayment = (id: string) => {
    mutateWorkspace((prev) => {
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
    mutateWorkspace((prev) => ({
      ...prev,
      holdings: [...prev.holdings, { ...holding, id: generateId('hold') }],
    }));
  };

  const updateHolding = (id: string, patch: Partial<InvestmentHolding>) => {
    mutateWorkspace((prev) => ({
      ...prev,
      holdings: prev.holdings.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }));
  };

  const deleteHolding = (id: string) => {
    mutateWorkspace((prev) => ({
      ...prev,
      holdings: prev.holdings.filter((h) => h.id !== id),
    }));
  };

  const addInvestmentGoal = (goal: Omit<InvestmentGoal, 'id'>) => {
    mutateWorkspace((prev) => ({
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
    mutateWorkspace((prev) => ({
      ...prev,
      investmentGoals: prev.investmentGoals.map((g) =>
        g.id === id ? { ...g, ...patch } : g
      ),
    }));
  };

  const deleteInvestmentGoal = (id: string) => {
    mutateWorkspace((prev) => ({
      ...prev,
      investmentGoals: prev.investmentGoals.filter((g) => g.id !== id),
    }));
  };

  const setTargetAllocations = (targets: TargetAllocations) => {
    mutateWorkspace((prev) => ({
      ...prev,
      targetAllocations: targets,
    }));
  };

  const recordSnapshot = (note?: string) => {
    mutateWorkspace((prev) => {
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
    mutateWorkspace((prev) => ({
      ...prev,
      snapshots: prev.snapshots.filter((s) => s.id !== id),
    }));
  };

  const addPolicy = (policy: Omit<InsurancePolicy, 'id'>) => {
    mutateWorkspace((prev) => ({
      ...prev,
      policies: [...prev.policies, { ...policy, id: generateId('pol') }],
    }));
  };

  const updatePolicy = (id: string, patch: Partial<InsurancePolicy>) => {
    mutateWorkspace((prev) => ({
      ...prev,
      policies: prev.policies.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };

  const deletePolicy = (id: string) => {
    mutateWorkspace((prev) => ({
      ...prev,
      policies: prev.policies.filter((p) => p.id !== id),
    }));
  };

  const renewPolicyOneYear = (id: string) => {
    mutateWorkspace((prev) => ({
      ...prev,
      policies: prev.policies.map((p) =>
        p.id === id
          ? {
              ...p,
              status: 'Active',
              renewalDate: addOneYearISOCalendar(p.renewalDate),
            }
          : p
      ),
    }));
  };

  const toggleSecureChecklist = (itemId: string) => {
    mutateWorkspace((prev) => {
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
    mutateWorkspace((prev) => ({
      ...prev,
      goals: [...prev.goals, { ...goal, id: generateId('goal') }],
    }));
  };

  const updateGoal = (id: string, patch: Partial<SavingsGoal>) => {
    mutateWorkspace((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  };

  const deleteGoal = (id: string) => {
    mutateWorkspace((prev) => ({
      ...prev,
      goals: prev.goals.filter((g) => g.id !== id),
    }));
  };

  const updateGuideSettings = (patch: Partial<GuideSettings>) => {
    mutateWorkspace((prev) => ({
      ...prev,
      guideSettings: { ...prev.guideSettings, ...patch },
    }));
  };

  const toggleCoachingAction = (actionId: string) => {
    mutateWorkspace((prev) => {
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
    mutateWorkspace((prev) => ({ ...prev, currency }));
  };

  const clearWorkspace = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    try {
      const res = await authedFetch('/api/workspace', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.workspace) {
        return {
          ok: false,
          error: data?.error || 'Failed to clear workspace on the server.',
        };
      }
      hydrateServerWorkspace(data.workspace);
      void refreshBackups();
      void refreshAuditLogs();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error clearing workspace.' };
    }
  }, [authedFetch, hydrateServerWorkspace, refreshAuditLogs, refreshBackups]);

  const importWorkspaceJSON = useCallback(
    async (raw: string): Promise<{ ok: boolean; error?: string }> => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { ok: false, error: 'Could not parse JSON file.' };
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, error: 'Invalid JSON workspace structure.' };
      }

      try {
        const res = await authedFetch('/api/workspace', {
          method: 'PUT',
          body: JSON.stringify({ workspace: parsed }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.workspace) {
          return {
            ok: false,
            error:
              data?.error || 'Uploaded workspace failed server validation or plan limits.',
          };
        }
        hydrateServerWorkspace(data.workspace);
        void refreshBackups();
        void refreshAuditLogs();
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error importing workspace backup.' };
      }
    },
    [authedFetch, hydrateServerWorkspace, refreshAuditLogs, refreshBackups]
  );

  const createServerBackup = useCallback(
    async (note?: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authedFetch('/api/backups', {
          method: 'POST',
          body: JSON.stringify({ note }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.backup) {
          return { ok: false, error: data?.error || 'Failed to create server backup.' };
        }
        await refreshBackups();
        void refreshAuditLogs();
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error creating server backup.' };
      }
    },
    [authedFetch, refreshAuditLogs, refreshBackups]
  );

  const restoreServerBackup = useCallback(
    async (backupId: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authedFetch(`/api/backups/${encodeURIComponent(backupId)}/restore`, {
          method: 'POST',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.workspace) {
          return { ok: false, error: data?.error || 'Failed to restore backup.' };
        }
        hydrateServerWorkspace(data.workspace);
        await refreshBackups();
        void refreshAuditLogs();
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error restoring server backup.' };
      }
    },
    [authedFetch, hydrateServerWorkspace, refreshAuditLogs, refreshBackups]
  );

  const downloadServerBackup = useCallback(
    async (backupId: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authedFetch(`/api/backups/${encodeURIComponent(backupId)}/download`, {
          method: 'GET',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { ok: false, error: data?.error || 'Failed to download backup.' };
        }
        const json = await res.json();
        const blob = new Blob([JSON.stringify(json, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `elevate-${backupId}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Network error downloading backup.' };
      }
    },
    [authedFetch]
  );

  const refreshEntitlement = useCallback(async () => {
    if (!authTokenRef.current) return;
    setEntitlementLoading(true);
    try {
      const res = await authedFetch('/api/entitlements', { method: 'GET' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.entitlement) {
        setEntitlement(data.entitlement);
        setEntitlementError(null);
      } else {
        setEntitlementError(data?.error || 'Could not refresh entitlements.');
      }
    } catch {
      setEntitlementError('Unable to reach server entitlements.');
    } finally {
      setEntitlementLoading(false);
    }
  }, [authedFetch]);

  const updateEntitlementFromServer = useCallback((next: ServerEntitlementState) => {
    setEntitlement(next);
  }, []);

  const changeSubscriptionPlan = useCallback(
    async (
      targetPlan: PlanTier,
      timing: 'period_end' | 'immediate' = 'period_end'
    ): Promise<{ ok: boolean; error?: string }> => {
      setEntitlementLoading(true);
      setEntitlementError(null);
      try {
        const res = await authedFetch('/api/entitlements/change-plan', {
          method: 'POST',
          body: JSON.stringify({ targetPlan, timing }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.entitlement) {
          const msg = data?.error || 'Failed to update subscription plan.';
          setEntitlementError(msg);
          return { ok: false, error: msg };
        }
        setEntitlement(data.entitlement);
        void refreshAuditLogs();
        return { ok: true };
      } catch {
        const msg = 'Network error updating plan entitlements.';
        setEntitlementError(msg);
        return { ok: false, error: msg };
      } finally {
        setEntitlementLoading(false);
      }
    },
    [authedFetch, refreshAuditLogs]
  );

  const cancelOrReactivatePlan = useCallback(
    async (options: {
      timing?: 'period_end' | 'immediate';
      reactivate?: boolean;
    }): Promise<{ ok: boolean; error?: string }> => {
      setEntitlementLoading(true);
      setEntitlementError(null);
      try {
        const res = await authedFetch('/api/entitlements/cancel', {
          method: 'POST',
          body: JSON.stringify(options),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.entitlement) {
          const msg = data?.error || 'Failed to update cancellation state.';
          setEntitlementError(msg);
          return { ok: false, error: msg };
        }
        setEntitlement(data.entitlement);
        void refreshAuditLogs();
        return { ok: true };
      } catch {
        const msg = 'Network error updating subscription status.';
        setEntitlementError(msg);
        return { ok: false, error: msg };
      } finally {
        setEntitlementLoading(false);
      }
    },
    [authedFetch, refreshAuditLogs]
  );

  const requestAuthorizedReportExport = useCallback(
    async (reportType: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await authedFetch('/api/reports/export', {
          method: 'POST',
          body: JSON.stringify({ reportType }),
        });
        const data = await res.json().catch(() => ({}));
        if (data?.entitlement) {
          setEntitlement(data.entitlement);
        }
        if (!res.ok || !data?.authorized) {
          return {
            ok: false,
            error:
              data?.error ||
              'Downloadable reports require Elevate Pro (₹199/month).',
          };
        }
        void refreshAuditLogs();
        return { ok: true };
      } catch {
        return {
          ok: false,
          error: 'Could not verify report export entitlement with the server.',
        };
      }
    },
    [authedFetch, refreshAuditLogs]
  );

  const activeEntitlements = entitlement?.entitlements ?? FALLBACK_BASIC_ENTITLEMENTS;
  const totalGoalsCount = workspace.goals.length + workspace.investmentGoals.length;
  const canAddMoreGoals =
    activeEntitlements.maxGoals === null ||
    totalGoalsCount < activeEntitlements.maxGoals;
  const canAddMoreBudgets =
    activeEntitlements.maxBudgets === null ||
    workspace.budgets.length < activeEntitlements.maxBudgets;

  return (
    <ElevateContext.Provider
      value={{
        user,
        authToken,
        isHydrating,
        storageError,
        syncStatus,
        clearStorageError: () => setStorageError(null),
        register,
        login,
        updateProfile,
        changePassword,
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
        planCatalog,
        entitlement,
        entitlements: activeEntitlements,
        entitlementLoading,
        entitlementError,
        clearEntitlementError: () => setEntitlementError(null),
        totalGoalsCount,
        canAddMoreGoals,
        canAddMoreBudgets,
        refreshEntitlement,
        updateEntitlementFromServer,
        changeSubscriptionPlan,
        cancelOrReactivatePlan,
        requestAuthorizedReportExport,
        backups,
        backupsLoading,
        auditLogs,
        refreshBackups,
        createServerBackup,
        restoreServerBackup,
        downloadServerBackup,
        refreshAuditLogs,
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
