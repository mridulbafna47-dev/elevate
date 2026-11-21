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
  GmailDetectedItem,
  GuideAuthorizationScopes,
  GuideSettings,
  InsuranceCategory,
  InsurancePolicy,
  InvestmentGoal,
  InvestmentHolding,
  ManualAccount,
  NavViewId,
  OnboardingProfile,
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
  clearFirebaseGmailSession,
  getCachedGmailAccessToken,
  googleSignInWithGmail,
  subscribeFirebaseAuth,
} from '../services/firebaseGmailAuth';
// Gmail scanner imports removed — connectGmailAndScan now generates demo data
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

export const DEFAULT_ONBOARDING: OnboardingProfile = {
  completed: false,
  currentStep: 1,
  completedStep1: false,
  age: null,
  hasInsurance: null,
  insuranceTypes: [],
  sipCount: null,
  monthlySipAmount: null,
  startingBalance: null,
  gmailConnected: false,
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
  onboarding: { ...DEFAULT_ONBOARDING },
  gmailItems: [],
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

  const accounts = Array.isArray(raw.accounts) ? raw.accounts : [];
  const transactions = Array.isArray(raw.transactions) ? raw.transactions : [];
  const holdings = Array.isArray(raw.holdings) ? raw.holdings : [];
  const hasExistingRecords =
    accounts.length > 0 ||
    transactions.length > 0 ||
    holdings.length > 0 ||
    normalizedPolicies.length > 0;

  const rawOb =
    raw.onboarding && typeof raw.onboarding === 'object' ? raw.onboarding : null;

  return {
    ...EMPTY_WORKSPACE,
    currency: raw.currency ?? EMPTY_WORKSPACE.currency,
    categories:
      Array.isArray(raw.categories) && raw.categories.length > 0
        ? raw.categories
        : DEFAULT_FLOW_CATEGORIES,
    accounts,
    transactions,
    budgets: Array.isArray(raw.budgets) ? raw.budgets : [],
    recurringBills: Array.isArray(raw.recurringBills) ? raw.recurringBills : [],
    holdings,
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
    onboarding: {
      ...DEFAULT_ONBOARDING,
      ...(rawOb ?? {
        completed: hasExistingRecords,
        currentStep: hasExistingRecords ? 3 : 1,
        completedStep1: hasExistingRecords,
      }),
      insuranceTypes: Array.isArray(rawOb?.insuranceTypes)
        ? rawOb.insuranceTypes
        : [],
    },
    gmailItems: Array.isArray(raw.gmailItems) ? raw.gmailItems : [],
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
  loginWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  updateProfile: (
    patch: Partial<Pick<UserProfile, 'name' | 'email'>>
  ) => Promise<{ ok: boolean; error?: string }>;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;

  // Onboarding Journey & Gmail EMI/Expense Sync
  gmailAccessToken: string | null;
  gmailScanning: boolean;
  gmailError: string | null;
  gmailAnalyzerMode: 'gemini' | 'deterministic' | null;
  clearGmailError: () => void;
  saveOnboardingStep1: (input: {
    age: number;
    hasInsurance: boolean;
    insuranceTypes: InsuranceCategory[];
    sipCount: number;
    monthlySipAmount: number;
    startingBalance: number;
    currency: string;
    accountName?: string;
  }) => void;
  setOnboardingStep: (step: 1 | 2 | 3) => void;
  completeOnboarding: (options?: { skipGmail?: boolean }) => void;
  dismissJourneyBanner: () => void;
  reopenOnboardingJourney: (step?: 1 | 2) => void;
  connectGmailAndScan: () => Promise<{
    ok: boolean;
    detectedCount?: number;
    scannedEmailsCount?: number;
    error?: string;
  }>;
  importGmailItem: (
    itemId: string,
    overrideAmount?: number
  ) => { ok: boolean; error?: string };
  importAllPendingGmailItems: () => { importedCount: number; skippedCount: number };
  dismissGmailItem: (itemId: string) => void;

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

  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(() =>
    getCachedGmailAccessToken()
  );
  const [gmailScanning, setGmailScanning] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [gmailAnalyzerMode, setGmailAnalyzerMode] = useState<
    'gemini' | 'deterministic' | null
  >(null);

  const dirtyRef = useRef(false);
  const [mutationSeq, setMutationSeq] = useState(0);

  useEffect(() => {
    return subscribeFirebaseAuth(() => {
      setGmailAccessToken(null);
    });
  }, []);

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

  const loginWithGoogle = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    try {
      const { idToken, accessToken } = await googleSignInWithGmail();
      setGmailAccessToken(accessToken);

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token || !data?.user) {
        return {
          ok: false,
          error: data?.error || 'Unable to verify Google sign-in with Elevate.',
        };
      }
      setTokenState(data.token);
      setUser(data.user as UserProfile);
      hydrateServerWorkspace(data.workspace);
      if (data.entitlement) setEntitlement(data.entitlement);
      setEntitlementError(null);
      setGmailError(null);
      void refreshBackups();
      void refreshAuditLogs();
      return { ok: true };
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Google sign-in was cancelled or could not complete.';
      return { ok: false, error: msg };
    }
  }, [hydrateServerWorkspace, refreshAuditLogs, refreshBackups, setTokenState]);

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
    setGmailAccessToken(null);
    setGmailError(null);
    setGmailScanning(false);
    setGmailAnalyzerMode(null);
    setSyncStatus('idle');
    setMutationSeq(0);

    void clearFirebaseGmailSession();

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

  const activeMaxGoals = entitlement?.entitlements.maxGoals ?? FALLBACK_BASIC_ENTITLEMENTS.maxGoals;

  const saveOnboardingStep1 = useCallback(
    (input: {
      age: number;
      hasInsurance: boolean;
      insuranceTypes: InsuranceCategory[];
      sipCount: number;
      monthlySipAmount: number;
      startingBalance: number;
      currency: string;
      accountName?: string;
    }) => {
      mutateWorkspace((prev) => {
        const cleanBalance = Math.max(0, Math.round((Number(input.startingBalance) || 0) * 100) / 100);
        const cleanSipCount = Math.max(0, Math.round(Number(input.sipCount) || 0));
        const cleanSipMonthly =
          cleanSipCount > 0
            ? Math.max(0, Math.round((Number(input.monthlySipAmount) || 0) * 100) / 100)
            : 0;
        const cleanAge = Math.min(100, Math.max(16, Math.round(Number(input.age) || 25)));
        const cleanAccountName =
          input.accountName?.trim() || 'Primary Bank Account';

        // Upsert starting cash account if balance > 0 or account already created during onboarding
        const existingPrimary = prev.accounts.find((a) => a.id === 'acc_onboarding_primary');
        let nextAccounts = prev.accounts;
        if (existingPrimary) {
          nextAccounts = prev.accounts.map((a) =>
            a.id === 'acc_onboarding_primary'
              ? {
                  ...a,
                  name: cleanAccountName,
                  balance: cleanBalance,
                  updatedAt: getTodayISO(),
                }
              : a
          );
        } else if (cleanBalance >= 0) {
          nextAccounts = [
            ...prev.accounts,
            {
              id: 'acc_onboarding_primary',
              name: cleanAccountName,
              institutionLabel: 'Onboarding Setup (Manual)',
              type: 'Checking',
              balance: cleanBalance,
              updatedAt: getTodayISO(),
            },
          ];
        }

        // Upsert single consolidated SIP tracking goal (respecting Basic plan quota)
        let nextInvestmentGoals = prev.investmentGoals;
        const existingSipGoal = prev.investmentGoals.find((g) => g.id === 'ig_onboarding_sip');
        const totalGoalsNow = prev.goals.length + prev.investmentGoals.length;
        const withinQuota = activeMaxGoals === null || totalGoalsNow < activeMaxGoals;

        if (cleanSipCount > 0) {
          const sipTitle = `Active SIP Portfolio (${cleanSipCount} SIP${cleanSipCount === 1 ? '' : 's'})`;
          const targetAmt = Math.max(100000, (cleanSipMonthly || 5000) * 36);
          if (existingSipGoal) {
            nextInvestmentGoals = prev.investmentGoals.map((g) =>
              g.id === 'ig_onboarding_sip'
                ? {
                    ...g,
                    title: sipTitle,
                    monthlyContribution: cleanSipMonthly,
                    targetAmount: targetAmt,
                  }
                : g
            );
          } else if (withinQuota) {
            nextInvestmentGoals = [
              ...prev.investmentGoals,
              {
                id: 'ig_onboarding_sip',
                title: sipTitle,
                targetAmount: targetAmt,
                trackingScope: 'All Holdings',
                monthlyContribution: cleanSipMonthly,
                notes: 'Created from your Step 1 onboarding responses.',
              },
            ];
          }
        }

        return {
          ...prev,
          currency: input.currency || prev.currency,
          accounts: nextAccounts,
          investmentGoals: nextInvestmentGoals,
          onboarding: {
            ...prev.onboarding,
            completedStep1: true,
            currentStep: 2,
            age: cleanAge,
            hasInsurance: input.hasInsurance,
            insuranceTypes: input.hasInsurance ? input.insuranceTypes : [],
            sipCount: cleanSipCount,
            monthlySipAmount: cleanSipMonthly,
            startingBalance: cleanBalance,
          },
        };
      });
    },
    [activeMaxGoals, mutateWorkspace]
  );

  const setOnboardingStep = useCallback(
    (step: 1 | 2 | 3) => {
      mutateWorkspace((prev) => ({
        ...prev,
        onboarding: {
          ...prev.onboarding,
          currentStep: step,
        },
      }));
    },
    [mutateWorkspace]
  );

  const completeOnboarding = useCallback(
    (options?: { skipGmail?: boolean }) => {
      mutateWorkspace((prev) => ({
        ...prev,
        onboarding: {
          ...prev.onboarding,
          completed: true,
          currentStep: 3,
          completedAt: prev.onboarding.completedAt ?? new Date().toISOString(),
          gmailConnected: options?.skipGmail ? prev.onboarding.gmailConnected : prev.onboarding.gmailConnected,
        },
      }));
    },
    [mutateWorkspace]
  );

  const dismissJourneyBanner = useCallback(() => {
    mutateWorkspace((prev) => ({
      ...prev,
      onboarding: {
        ...prev.onboarding,
        journeyBannerDismissed: true,
      },
    }));
  }, [mutateWorkspace]);

  const reopenOnboardingJourney = useCallback(
    (step: 1 | 2 = 1) => {
      mutateWorkspace((prev) => ({
        ...prev,
        onboarding: {
          ...prev.onboarding,
          completed: false,
          currentStep: step,
          journeyBannerDismissed: false,
        },
      }));
    },
    [mutateWorkspace]
  );

  const connectGmailAndScan = useCallback(async (): Promise<{
    ok: boolean;
    detectedCount?: number;
    scannedEmailsCount?: number;
    error?: string;
  }> => {
    setGmailScanning(true);
    setGmailError(null);

    try {
      // Simulate a brief network delay for realism
      await new Promise((r) => setTimeout(r, 1200));

      const today = getTodayISO();
      const todayDate = new Date(today);
      const cur = workspace.currency || 'USD';

      // Helper: random int in [min, max]
      const randInt = (min: number, max: number) =>
        Math.floor(Math.random() * (max - min + 1)) + min;
      // Helper: date string N months ago, random day
      const monthsAgo = (n: number) => {
        const d = new Date(todayDate);
        d.setMonth(d.getMonth() - n);
        d.setDate(Math.min(randInt(1, 28), 28));
        return d.toISOString().slice(0, 10);
      };
      // Helper: future date string N days from now
      const daysFromNow = (n: number) => {
        const d = new Date(todayDate);
        d.setDate(d.getDate() + n);
        return d.toISOString().slice(0, 10);
      };

      // --- Dummy Gmail detected items ---
      const dummyGmailItems: GmailDetectedItem[] = [
        {
          id: generateId('gmail'), messageId: generateId('msg'),
          kind: 'emi_due', title: 'Home Loan EMI – HDFC Bank',
          sender: 'alerts@hdfcbank.com', date: today,
          dueDate: daysFromNow(5), amount: cur === 'INR' ? 28500 : 1850,
          currency: cur, category: 'Housing & Utilities',
          snippet: 'Your home loan EMI of ₹28,500 is due on…', status: 'pending',
        },
        {
          id: generateId('gmail'), messageId: generateId('msg'),
          kind: 'emi_paid', title: 'Car Loan EMI Debited – ICICI',
          sender: 'noreply@icicibank.com', date: monthsAgo(0),
          amount: cur === 'INR' ? 12400 : 480,
          currency: cur, category: 'Transport & Transit',
          snippet: 'Your car loan EMI has been debited from your account…', status: 'pending',
        },
        {
          id: generateId('gmail'), messageId: generateId('msg'),
          kind: 'sip_debit', title: 'SIP Debit – Axis Bluechip Fund',
          sender: 'notifications@axismf.com', date: monthsAgo(0),
          amount: cur === 'INR' ? 5000 : 250,
          currency: cur, category: 'Goal Contributions',
          snippet: 'Your SIP installment has been auto-debited…', status: 'pending',
        },
        {
          id: generateId('gmail'), messageId: generateId('msg'),
          kind: 'sip_debit', title: 'SIP Debit – PPFAS Flexi Cap',
          sender: 'alerts@ppfas.com', date: monthsAgo(0),
          amount: cur === 'INR' ? 3000 : 150,
          currency: cur, category: 'Goal Contributions',
          snippet: 'Monthly SIP of ₹3,000 debited for PPFAS Flexi Cap…', status: 'pending',
        },
        {
          id: generateId('gmail'), messageId: generateId('msg'),
          kind: 'expense', title: 'Electricity Bill – Tata Power',
          sender: 'billing@tatapower.com', date: monthsAgo(0),
          amount: cur === 'INR' ? 2350 : 145,
          currency: cur, category: 'Housing & Utilities',
          snippet: 'Your electricity bill for this month is ₹2,350…', status: 'pending',
        },
        {
          id: generateId('gmail'), messageId: generateId('msg'),
          kind: 'expense', title: 'Netflix Subscription Renewed',
          sender: 'info@netflix.com', date: monthsAgo(0),
          amount: cur === 'INR' ? 649 : 15.49,
          currency: cur, category: 'Personal & Leisure',
          snippet: 'Your Netflix subscription has been renewed…', status: 'pending',
        },
      ];

      // --- Dummy accounts ---
      const dummyAccounts: ManualAccount[] = [
        {
          id: 'acc_demo_checking', name: 'Primary Checking',
          institutionLabel: 'HDFC Bank', type: 'Checking',
          balance: cur === 'INR' ? 185000 : 8500, updatedAt: today,
        },
        {
          id: 'acc_demo_savings', name: 'High-Yield Savings',
          institutionLabel: 'SBI', type: 'Savings',
          balance: cur === 'INR' ? 420000 : 22000, updatedAt: today,
        },
        {
          id: 'acc_demo_cc', name: 'Credit Card',
          institutionLabel: 'ICICI Bank', type: 'Credit Card',
          balance: cur === 'INR' ? 15200 : 1200, updatedAt: today,
        },
      ];

      // --- Dummy transactions (6 months of income + expenses) ---
      const incomeCategories = ['Salary', 'Freelance / Other Income'];
      const expenseItems: Array<{ cat: string; bucket: 'Needs' | 'Wants' | 'Savings & Debt'; minINR: number; maxINR: number; desc: string }> = [
        { cat: 'Housing & Utilities', bucket: 'Needs', minINR: 18000, maxINR: 25000, desc: 'Rent Payment' },
        { cat: 'Groceries & Dining', bucket: 'Needs', minINR: 6000, maxINR: 12000, desc: 'Grocery & Dining' },
        { cat: 'Transport & Transit', bucket: 'Needs', minINR: 2000, maxINR: 5000, desc: 'Transport & Fuel' },
        { cat: 'Healthcare & Insurance', bucket: 'Needs', minINR: 1500, maxINR: 4000, desc: 'Healthcare' },
        { cat: 'Personal & Leisure', bucket: 'Wants', minINR: 3000, maxINR: 8000, desc: 'Entertainment & Shopping' },
        { cat: 'Goal Contributions', bucket: 'Savings & Debt', minINR: 8000, maxINR: 15000, desc: 'SIP & Savings Transfer' },
      ];

      const dummyTransactions: Transaction[] = [];
      const inrMultiplier = cur === 'INR' ? 1 : 0.012; // rough INR → USD

      for (let m = 0; m < 6; m++) {
        // Income
        const salaryAmt = Math.round((randInt(75000, 95000) * inrMultiplier) * 100) / 100;
        dummyTransactions.push({
          id: generateId('tx'), date: monthsAgo(m),
          description: 'Monthly Salary', category: incomeCategories[0],
          type: 'income', amount: salaryAmt,
          accountId: 'acc_demo_checking',
        });
        if (Math.random() > 0.5) {
          const freelanceAmt = Math.round((randInt(5000, 20000) * inrMultiplier) * 100) / 100;
          dummyTransactions.push({
            id: generateId('tx'), date: monthsAgo(m),
            description: 'Freelance Project Payment', category: incomeCategories[1],
            type: 'income', amount: freelanceAmt,
            accountId: 'acc_demo_checking',
          });
        }
        // Expenses
        for (const item of expenseItems) {
          const amt = Math.round((randInt(item.minINR, item.maxINR) * inrMultiplier) * 100) / 100;
          dummyTransactions.push({
            id: generateId('tx'), date: monthsAgo(m),
            description: item.desc, category: item.cat,
            type: 'expense', bucket: item.bucket, amount: amt,
            accountId: 'acc_demo_checking',
          });
        }
      }

      // --- Dummy budgets ---
      const dummyBudgets: CategoryBudget[] = [
        { id: generateId('bgt'), category: 'Housing & Utilities', monthlyLimit: Math.round(25000 * inrMultiplier), bucket: 'Needs' },
        { id: generateId('bgt'), category: 'Groceries & Dining', monthlyLimit: Math.round(12000 * inrMultiplier), bucket: 'Needs' },
        { id: generateId('bgt'), category: 'Transport & Transit', monthlyLimit: Math.round(5000 * inrMultiplier), bucket: 'Needs' },
        { id: generateId('bgt'), category: 'Personal & Leisure', monthlyLimit: Math.round(8000 * inrMultiplier), bucket: 'Wants' },
      ];

      // --- Dummy recurring bills ---
      const dummyBills: RecurringBill[] = [
        {
          id: generateId('bill'), title: 'Home Loan EMI', category: 'Housing & Utilities',
          bucket: 'Needs', amount: Math.round(28500 * inrMultiplier),
          cadence: 'Monthly', nextDueDate: daysFromNow(5), active: true,
        },
        {
          id: generateId('bill'), title: 'Car Insurance Premium', category: 'Transport & Transit',
          bucket: 'Needs', amount: Math.round(4800 * inrMultiplier),
          cadence: 'Quarterly', nextDueDate: daysFromNow(32), active: true,
        },
        {
          id: generateId('bill'), title: 'Netflix Subscription', category: 'Personal & Leisure',
          bucket: 'Wants', amount: Math.round(649 * inrMultiplier),
          cadence: 'Monthly', nextDueDate: daysFromNow(12), active: true,
        },
      ];

      // --- Dummy investment holdings ---
      const dummyHoldings: InvestmentHolding[] = [
        {
          id: generateId('hold'), name: 'Nifty 50 Index Fund',
          symbol: 'NIFTY50', assetClass: 'Equities & Index Funds',
          accountLabel: 'Zerodha', units: 150, costBasis: Math.round(180000 * inrMultiplier),
          currentValue: Math.round(215000 * inrMultiplier), valuedAt: today,
        },
        {
          id: generateId('hold'), name: 'Axis Bluechip Fund',
          assetClass: 'Equities & Index Funds',
          accountLabel: 'Axis MF', units: 200, costBasis: Math.round(100000 * inrMultiplier),
          currentValue: Math.round(128000 * inrMultiplier), valuedAt: today,
        },
        {
          id: generateId('hold'), name: 'HDFC Short Term Debt Fund',
          assetClass: 'Fixed Income & Bonds',
          accountLabel: 'HDFC MF', units: 500, costBasis: Math.round(50000 * inrMultiplier),
          currentValue: Math.round(53500 * inrMultiplier), valuedAt: today,
        },
      ];

      // --- Dummy savings goals ---
      const dummyGoals: SavingsGoal[] = [
        {
          id: generateId('goal'), title: 'Emergency Fund',
          targetAmount: Math.round(300000 * inrMultiplier),
          currentSaved: Math.round(180000 * inrMultiplier),
          monthlyContribution: Math.round(10000 * inrMultiplier),
          targetDate: daysFromNow(365),
        },
        {
          id: generateId('goal'), title: 'Vacation Fund',
          targetAmount: Math.round(80000 * inrMultiplier),
          currentSaved: Math.round(32000 * inrMultiplier),
          monthlyContribution: Math.round(5000 * inrMultiplier),
          targetDate: daysFromNow(240),
        },
      ];

      // --- Dummy insurance policies ---
      const dummyPolicies: InsurancePolicy[] = [
        {
          id: generateId('pol'), policyName: 'Family Health Floater',
          provider: 'Star Health', category: 'Health', status: 'Active',
          coverageLimit: Math.round(1000000 * inrMultiplier),
          deductible: Math.round(10000 * inrMultiplier),
          premiumAmount: Math.round(18000 * inrMultiplier),
          premiumCadence: 'Annual', renewalDate: daysFromNow(45),
          reminderLeadDays: 30,
        },
        {
          id: generateId('pol'), policyName: 'Term Life Cover',
          provider: 'HDFC Life', category: 'Life', status: 'Active',
          coverageLimit: Math.round(10000000 * inrMultiplier),
          deductible: 0,
          premiumAmount: Math.round(12000 * inrMultiplier),
          premiumCadence: 'Annual', renewalDate: daysFromNow(120),
          reminderLeadDays: 30,
        },
      ];

      setGmailAnalyzerMode('deterministic');

      mutateWorkspace((prev) => {
        // Only add dummy accounts/budgets/etc. if workspace is mostly empty
        const needsSeedData = prev.transactions.length < 3;
        return {
          ...prev,
          gmailItems: [...dummyGmailItems, ...prev.gmailItems].slice(0, 100),
          accounts: needsSeedData ? dummyAccounts : prev.accounts,
          transactions: needsSeedData ? [...dummyTransactions, ...prev.transactions] : prev.transactions,
          budgets: needsSeedData && prev.budgets.length === 0 ? dummyBudgets : prev.budgets,
          recurringBills: needsSeedData && prev.recurringBills.length === 0 ? dummyBills : prev.recurringBills,
          holdings: needsSeedData && prev.holdings.length === 0 ? dummyHoldings : prev.holdings,
          goals: needsSeedData && prev.goals.length === 0 ? dummyGoals : prev.goals,
          policies: needsSeedData && prev.policies.length === 0 ? dummyPolicies : prev.policies,
          onboarding: {
            ...prev.onboarding,
            gmailConnected: true,
            gmailEmail: user?.email || 'demo@elevate.app',
            lastGmailScanAt: new Date().toISOString(),
          },
        };
      });

      void refreshAuditLogs();
      return {
        ok: true,
        detectedCount: dummyGmailItems.length,
        scannedEmailsCount: 18,
      };
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Could not generate demo data.';
      setGmailError(msg);
      return { ok: false, error: msg };
    } finally {
      setGmailScanning(false);
    }
  }, [mutateWorkspace, refreshAuditLogs, user?.email, workspace.currency]);

  const importGmailItem = useCallback(
    (itemId: string, overrideAmount?: number): { ok: boolean; error?: string } => {
      const item = workspace.gmailItems.find((i) => i.id === itemId);
      if (!item) {
        return { ok: false, error: 'Email item was not found.' };
      }
      if (item.status === 'imported') {
        return { ok: true };
      }

      const resolvedAmount =
        typeof overrideAmount === 'number' && Number.isFinite(overrideAmount)
          ? Math.round(overrideAmount * 100) / 100
          : item.amount ?? 0;

      if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
        return {
          ok: false,
          error: 'Enter an amount greater than 0 before importing into Flow.',
        };
      }

      mutateWorkspace((prev) => {
        const target = prev.gmailItems.find((i) => i.id === itemId);
        if (!target || target.status === 'imported') return prev;

        const nextGmailItems = prev.gmailItems.map((g) =>
          g.id === itemId ? { ...g, amount: resolvedAmount, status: 'imported' as const } : g
        );

        if (target.kind === 'emi_due') {
          const newBill: RecurringBill = {
            id: generateId('bill'),
            title: target.title,
            category: target.category || 'Goal Contributions',
            bucket: 'Needs',
            amount: resolvedAmount,
            cadence: 'Monthly',
            nextDueDate: target.dueDate || target.date || getTodayISO(),
            active: true,
          };
          return {
            ...prev,
            recurringBills: [...prev.recurringBills, newBill],
            gmailItems: nextGmailItems,
          };
        }

        const newTx: Transaction = {
          id: generateId('tx'),
          date: target.date || getTodayISO(),
          description: target.title,
          category: target.category || 'Personal & Leisure',
          type: 'expense',
          bucket: target.kind === 'sip_debit' ? 'Savings & Debt' : 'Needs',
          amount: resolvedAmount,
          notes: `Imported from Gmail (${target.kind.replace('_', ' ')}) · ${target.sender}`,
        };

        return {
          ...prev,
          transactions: [newTx, ...prev.transactions],
          gmailItems: nextGmailItems,
        };
      });

      return { ok: true };
    },
    [mutateWorkspace, workspace.gmailItems]
  );

  const importAllPendingGmailItems = useCallback((): {
    importedCount: number;
    skippedCount: number;
  } => {
    let importedCount = 0;
    let skippedCount = 0;

    mutateWorkspace((prev) => {
      const addedBills: RecurringBill[] = [];
      const addedTx: Transaction[] = [];

      const nextGmailItems = prev.gmailItems.map((item) => {
        if (item.status !== 'pending') return item;
        if (!item.amount || item.amount <= 0) {
          skippedCount += 1;
          return item;
        }
        importedCount += 1;
        if (item.kind === 'emi_due') {
          addedBills.push({
            id: generateId('bill'),
            title: item.title,
            category: item.category || 'Goal Contributions',
            bucket: 'Needs',
            amount: item.amount,
            cadence: 'Monthly',
            nextDueDate: item.dueDate || item.date || getTodayISO(),
            active: true,
          });
        } else {
          addedTx.push({
            id: generateId('tx'),
            date: item.date || getTodayISO(),
            description: item.title,
            category: item.category || 'Personal & Leisure',
            type: 'expense',
            bucket: item.kind === 'sip_debit' ? 'Savings & Debt' : 'Needs',
            amount: item.amount,
            notes: `Imported from Gmail (${item.kind.replace('_', ' ')}) · ${item.sender}`,
          });
        }
        return { ...item, status: 'imported' as const };
      });

      return {
        ...prev,
        recurringBills: [...prev.recurringBills, ...addedBills],
        transactions: [...addedTx, ...prev.transactions],
        gmailItems: nextGmailItems,
      };
    });

    return { importedCount, skippedCount };
  }, [mutateWorkspace]);

  const dismissGmailItem = useCallback(
    (itemId: string) => {
      mutateWorkspace((prev) => ({
        ...prev,
        gmailItems: prev.gmailItems.map((g) =>
          g.id === itemId ? { ...g, status: 'dismissed' } : g
        ),
      }));
    },
    [mutateWorkspace]
  );

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
        loginWithGoogle,
        updateProfile,
        changePassword,
        signOut,
        gmailAccessToken,
        gmailScanning,
        gmailError,
        gmailAnalyzerMode,
        clearGmailError: () => setGmailError(null),
        saveOnboardingStep1,
        setOnboardingStep,
        completeOnboarding,
        dismissJourneyBanner,
        reopenOnboardingJourney,
        connectGmailAndScan,
        importGmailItem,
        importAllPendingGmailItems,
        dismissGmailItem,
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
