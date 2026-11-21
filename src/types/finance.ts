export type NavViewId =
  | 'dashboard'
  | 'flow'
  | 'guide'
  | 'wealth'
  | 'secure'
  | 'reports'
  | 'plans'
  | 'settings';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'member';
  authProvider?: 'password' | 'google';
  createdAt: string;
  updatedAt: string;
  signedInAt: string;
}

export interface ServerBackupMetadata {
  id: string;
  createdAt: string;
  reason: 'manual' | 'auto' | 'pre_restore' | 'pre_reset';
  note: string;
  sizeBytes: number;
  counts: {
    accounts: number;
    transactions: number;
    budgets: number;
    recurringBills: number;
    holdings: number;
    investmentGoals: number;
    policies: number;
    goals: number;
  };
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  detail: string;
}

export interface GmailDetectedItem {
  id: string;
  messageId: string;
  kind: 'emi_due' | 'emi_paid' | 'expense' | 'sip_debit';
  title: string;
  sender: string;
  date: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  amount: number | null;
  currency: string;
  category: string;
  snippet: string;
  status: 'pending' | 'imported' | 'dismissed';
}

export interface OnboardingProfile {
  completed: boolean;
  currentStep: 1 | 2 | 3;
  completedStep1: boolean;
  age: number | null;
  hasInsurance: boolean | null;
  insuranceTypes: InsuranceCategory[];
  sipCount: number | null;
  monthlySipAmount: number | null;
  startingBalance: number | null;
  gmailConnected: boolean;
  gmailEmail?: string;
  lastGmailScanAt?: string;
  journeyBannerDismissed?: boolean;
  completedAt?: string;
}

export type AccountType = 'Checking' | 'Savings' | 'Cash Reserve' | 'Credit Card';

export interface ManualAccount {
  id: string;
  name: string;
  institutionLabel: string;
  type: AccountType;
  balance: number;
  updatedAt: string;
}

export type TransactionType = 'income' | 'expense';

export type ExpenseBucket = 'Needs' | 'Wants' | 'Savings & Debt';

export interface FlowCategory {
  id: string;
  name: string;
  type: TransactionType;
  bucket?: ExpenseBucket;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: string;
  type: TransactionType;
  bucket?: ExpenseBucket;
  amount: number;
  accountId?: string;
  notes?: string;
}

export interface CategoryBudget {
  id: string;
  category: string;
  monthlyLimit: number;
  bucket: ExpenseBucket;
}

export type BillCadence =
  | 'Weekly'
  | 'Biweekly'
  | 'Monthly'
  | 'Quarterly'
  | 'Annual';

export interface RecurringBill {
  id: string;
  title: string;
  category: string;
  bucket: ExpenseBucket;
  amount: number;
  cadence: BillCadence;
  nextDueDate: string; // YYYY-MM-DD
  accountId?: string;
  active: boolean;
}

export type AssetClass =
  | 'Equities & Index Funds'
  | 'Fixed Income & Bonds'
  | 'Cash & Treasury'
  | 'Real Estate'
  | 'Alternative / Other';

export interface InvestmentHolding {
  id: string;
  name: string;
  symbol?: string;
  assetClass: AssetClass;
  accountLabel: string;
  units: number;
  costBasis: number;
  currentValue: number;
  valuedAt: string; // YYYY-MM-DD
  notes?: string;
}

export interface InvestmentGoal {
  id: string;
  title: string;
  targetAmount: number;
  trackingScope: 'All Holdings' | AssetClass | 'Manual';
  manualCurrentValue?: number;
  monthlyContribution: number;
  targetDate?: string;
  notes?: string;
}

export type TargetAllocations = Partial<Record<AssetClass, number>>;

export interface ValuationSnapshot {
  id: string;
  date: string; // YYYY-MM-DD
  totalInvestedValue: number;
  totalCashValue: number;
  note?: string;
}

export type InsuranceCategory =
  | 'Health'
  | 'Life'
  | 'Disability'
  | 'Auto'
  | 'Home & Renters'
  | 'Umbrella / Other';

export type PremiumCadence = 'Monthly' | 'Quarterly' | 'Annual';

export type PolicyStatus = 'Active' | 'Pending Renewal' | 'Archived';

export interface InsurancePolicy {
  id: string;
  policyName: string;
  provider: string;
  category: InsuranceCategory;
  status: PolicyStatus;
  policyReference?: string;
  effectiveDate?: string; // YYYY-MM-DD
  coverageLimit: number;
  deductible: number;
  premiumAmount: number;
  premiumCadence: PremiumCadence;
  renewalDate: string; // YYYY-MM-DD
  reminderLeadDays: number;
  beneficiaryOrInsured?: string;
  agentOrContact?: string;
  notes?: string;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentSaved: number;
  monthlyContribution: number;
  targetDate?: string;
}

export type GuidePillarScope = 'flow' | 'wealth' | 'secure' | 'guide';

export type GuideAuthorizationScopes = Record<GuidePillarScope, boolean>;

export type GuideProposedActionType =
  | 'none'
  | 'create_savings_goal'
  | 'set_emergency_months'
  | 'set_essential_baseline'
  | 'upsert_budget';

export interface ProposedGuideAction {
  actionType: GuideProposedActionType;
  summary?: string;
  title?: string;
  amount?: number;
  monthlyContribution?: number;
  category?: string;
  months?: number;
}

export interface GuideScenarioComparison {
  hasScenario: boolean;
  title?: string;
  assumptions?: string[];
  optionALabel?: string;
  optionAMetric?: string;
  optionASummary?: string;
  optionBLabel?: string;
  optionBMetric?: string;
  optionBSummary?: string;
}

export interface GuideAskResponse {
  answer: string;
  keyTakeaways: string[];
  scenarioComparison?: GuideScenarioComparison;
  proposedAction: ProposedGuideAction;
  educationalNote?: string;
}

export interface MonthlyReviewResponse {
  headline: string;
  summary: string;
  authorizedObservations: string[];
  focusAreas: string[];
  proposedAction: ProposedGuideAction;
}

export interface GuideSettings {
  emergencyTargetMonths: number;
  customMonthlyEssentialBaseline: number | null;
  completedActionIds: string[];
  guideAuthorizations: GuideAuthorizationScopes;
}

export interface ElevateWorkspace {
  currency: string;
  categories: FlowCategory[];
  accounts: ManualAccount[];
  transactions: Transaction[];
  budgets: CategoryBudget[];
  recurringBills: RecurringBill[];
  holdings: InvestmentHolding[];
  investmentGoals: InvestmentGoal[];
  targetAllocations: TargetAllocations;
  snapshots: ValuationSnapshot[];
  policies: InsurancePolicy[];
  secureChecklistIds: string[];
  goals: SavingsGoal[];
  guideSettings: GuideSettings;
  onboarding: OnboardingProfile;
  gmailItems: GmailDetectedItem[];
}

export type PlanTier = 'basic' | 'pro';

export type SubscriptionStatus =
  | 'active'
  | 'downgrade_scheduled'
  | 'canceled'
  | 'ended';

export interface PlanEntitlementFlags {
  coreDashboard: boolean;
  manualFlowTracking: boolean;
  maxBudgets: number | null;
  manualWealthHoldings: boolean;
  maxGoals: number | null;
  securePoliciesAndReminders: boolean;
  aiMonthlyQuota: number;
  advancedSpendingInsights: boolean;
  cashFlowForecasting: boolean;
  scenarioComparisons: boolean;
  richerPortfolioAnalysis: boolean;
  coverageSummaries: boolean;
  downloadableReports: boolean;
}

export interface PlanDefinition {
  id: PlanTier;
  name: string;
  priceMonthlyInr: number;
  priceLabel: string;
  tagline: string;
  features: string[];
  entitlements: PlanEntitlementFlags;
}

export interface ServerEntitlementState {
  workspaceId: string;
  plan: PlanTier;
  effectivePlan: PlanTier | null;
  status: SubscriptionStatus;
  scheduledPlan: PlanTier | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
  periodKey: string;
  aiQuestionsUsed: number;
  aiQuestionsLimit: number;
  paymentProviderIntegrated: false;
  billingNotice: string;
  updatedAt: string;
  entitlements: PlanEntitlementFlags;
}
