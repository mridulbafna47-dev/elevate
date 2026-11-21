export type NavViewId =
  | 'dashboard'
  | 'flow'
  | 'guide'
  | 'wealth'
  | 'secure'
  | 'reports'
  | 'settings';

export interface UserProfile {
  name: string;
  email: string;
  signedInAt: string;
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
}

