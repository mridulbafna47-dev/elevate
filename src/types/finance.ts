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

export interface InsurancePolicy {
  id: string;
  policyName: string;
  provider: string;
  category: InsuranceCategory;
  policyReference?: string;
  coverageLimit: number;
  deductible: number;
  premiumAmount: number;
  premiumCadence: PremiumCadence;
  renewalDate: string; // YYYY-MM-DD
  beneficiaryOrInsured?: string;
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

export interface GuideSettings {
  emergencyTargetMonths: number;
  customMonthlyEssentialBaseline: number | null;
  completedActionIds: string[];
}

export interface ElevateWorkspace {
  currency: string;
  accounts: ManualAccount[];
  transactions: Transaction[];
  budgets: CategoryBudget[];
  holdings: InvestmentHolding[];
  snapshots: ValuationSnapshot[];
  policies: InsurancePolicy[];
  goals: SavingsGoal[];
  guideSettings: GuideSettings;
}
