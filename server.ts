import 'dotenv/config';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

export type PlanTier = 'basic' | 'pro';
export type SubscriptionStatus = 'active' | 'downgrade_scheduled' | 'canceled' | 'ended';

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

interface StoredUserRecord {
  id: string;
  name: string;
  email: string;
  role: 'member';
  passwordSalt: string;
  passwordHash: string;
  tokenVersion: number;
  createdAt: string;
  updatedAt: string;
  signedInAt: string;
}

interface SubscriptionRecord {
  userId: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  scheduledPlan: PlanTier | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
  periodKey: string;
  aiQuestionsUsed: number;
  updatedAt: string;
}

interface BackupCounts {
  accounts: number;
  transactions: number;
  budgets: number;
  recurringBills: number;
  holdings: number;
  investmentGoals: number;
  policies: number;
  goals: number;
}

interface BackupFilePayload {
  id: string;
  userId: string;
  createdAt: string;
  reason: 'manual' | 'auto' | 'pre_restore' | 'pre_reset';
  note: string;
  counts: BackupCounts;
  workspace: ElevateWorkspaceData;
}

interface AuditLogRecord {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  userId: string | null;
  ip: string;
  detail: string;
}

export interface ElevateWorkspaceData {
  currency: string;
  categories: Array<{
    id: string;
    name: string;
    type: 'income' | 'expense';
    bucket?: 'Needs' | 'Wants' | 'Savings & Debt';
  }>;
  accounts: Array<{
    id: string;
    name: string;
    institutionLabel: string;
    type: 'Checking' | 'Savings' | 'Cash Reserve' | 'Credit Card';
    balance: number;
    updatedAt: string;
  }>;
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    category: string;
    type: 'income' | 'expense';
    bucket?: 'Needs' | 'Wants' | 'Savings & Debt';
    amount: number;
    accountId?: string;
    notes?: string;
  }>;
  budgets: Array<{
    id: string;
    category: string;
    monthlyLimit: number;
    bucket: 'Needs' | 'Wants' | 'Savings & Debt';
  }>;
  recurringBills: Array<{
    id: string;
    title: string;
    category: string;
    bucket: 'Needs' | 'Wants' | 'Savings & Debt';
    amount: number;
    cadence: 'Weekly' | 'Biweekly' | 'Monthly' | 'Quarterly' | 'Annual';
    nextDueDate: string;
    accountId?: string;
    active: boolean;
  }>;
  holdings: Array<{
    id: string;
    name: string;
    symbol?: string;
    assetClass:
      | 'Equities & Index Funds'
      | 'Fixed Income & Bonds'
      | 'Cash & Treasury'
      | 'Real Estate'
      | 'Alternative / Other';
    accountLabel: string;
    units: number;
    costBasis: number;
    currentValue: number;
    valuedAt: string;
    notes?: string;
  }>;
  investmentGoals: Array<{
    id: string;
    title: string;
    targetAmount: number;
    trackingScope:
      | 'All Holdings'
      | 'Manual'
      | 'Equities & Index Funds'
      | 'Fixed Income & Bonds'
      | 'Cash & Treasury'
      | 'Real Estate'
      | 'Alternative / Other';
    manualCurrentValue?: number;
    monthlyContribution: number;
    targetDate?: string;
    notes?: string;
  }>;
  targetAllocations: Record<string, number>;
  snapshots: Array<{
    id: string;
    date: string;
    totalInvestedValue: number;
    totalCashValue: number;
    note?: string;
  }>;
  policies: Array<{
    id: string;
    policyName: string;
    provider: string;
    category:
      | 'Health'
      | 'Life'
      | 'Disability'
      | 'Auto'
      | 'Home & Renters'
      | 'Umbrella / Other';
    status: 'Active' | 'Pending Renewal' | 'Archived';
    policyReference?: string;
    effectiveDate?: string;
    coverageLimit: number;
    deductible: number;
    premiumAmount: number;
    premiumCadence: 'Monthly' | 'Quarterly' | 'Annual';
    renewalDate: string;
    reminderLeadDays: number;
    beneficiaryOrInsured?: string;
    agentOrContact?: string;
    notes?: string;
  }>;
  secureChecklistIds: string[];
  goals: Array<{
    id: string;
    title: string;
    targetAmount: number;
    currentSaved: number;
    monthlyContribution: number;
    targetDate?: string;
  }>;
  guideSettings: {
    emergencyTargetMonths: number;
    customMonthlyEssentialBaseline: number | null;
    completedActionIds: string[];
    guideAuthorizations: {
      flow: boolean;
      wealth: boolean;
      secure: boolean;
      guide: boolean;
    };
  };
}

interface AuthenticatedRequest extends Request {
  userId?: string;
  userRecord?: StoredUserRecord;
}

export const PLAN_CATALOG: Record<PlanTier, PlanDefinition> = {
  basic: {
    id: 'basic',
    name: 'Elevate Basic',
    priceMonthlyInr: 99,
    priceLabel: '₹99/month',
    tagline: 'Core personal finance ledger, manual tracking, and starter Guide coaching.',
    features: [
      'Core financial dashboard',
      'Manual Flow cash tracking & recurring bills',
      'Basic category budgets (up to 4 categories)',
      'Manual Wealth holdings & cost basis',
      'Up to 3 savings or investment goals',
      'Secure policy records & renewal reminders',
      'Limited Guide AI questions (5/month)',
    ],
    entitlements: {
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
    },
  },
  pro: {
    id: 'pro',
    name: 'Elevate Pro',
    priceMonthlyInr: 199,
    priceLabel: '₹199/month',
    tagline: 'Full insights, forecasting from your records, scenario comparisons & exports.',
    features: [
      'Everything in Elevate Basic',
      'Advanced spending insights from Flow records',
      'Cash-flow forecasting based on entered data',
      'Higher fair-use Guide AI allowance (50/month)',
      'Interactive & AI scenario comparisons',
      'Richer portfolio drift & net worth timeline analysis',
      'Unlimited savings, investment goals & budgets',
      'Insurance coverage & deductible summaries',
      'Downloadable CSV & financial summary reports',
    ],
    entitlements: {
      coreDashboard: true,
      manualFlowTracking: true,
      maxBudgets: null,
      manualWealthHoldings: true,
      maxGoals: null,
      securePoliciesAndReminders: true,
      aiMonthlyQuota: 50,
      advancedSpendingInsights: true,
      cashFlowForecasting: true,
      scenarioComparisons: true,
      richerPortfolioAnalysis: true,
      coverageSummaries: true,
      downloadableReports: true,
    },
  },
};

const ENDED_ENTITLEMENTS: PlanEntitlementFlags = {
  coreDashboard: true,
  manualFlowTracking: true,
  maxBudgets: 4,
  manualWealthHoldings: true,
  maxGoals: 3,
  securePoliciesAndReminders: true,
  aiMonthlyQuota: 0,
  advancedSpendingInsights: false,
  cashFlowForecasting: false,
  scenarioComparisons: false,
  richerPortfolioAnalysis: false,
  coverageSummaries: false,
  downloadableReports: false,
};

const ALLOWED_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'INR']);
const ALLOWED_BUCKETS = new Set(['Needs', 'Wants', 'Savings & Debt']);
const ALLOWED_ACCOUNT_TYPES = new Set([
  'Checking',
  'Savings',
  'Cash Reserve',
  'Credit Card',
]);
const ALLOWED_BILL_CADENCES = new Set([
  'Weekly',
  'Biweekly',
  'Monthly',
  'Quarterly',
  'Annual',
]);
const ALLOWED_ASSET_CLASSES = new Set([
  'Equities & Index Funds',
  'Fixed Income & Bonds',
  'Cash & Treasury',
  'Real Estate',
  'Alternative / Other',
]);
const ALLOWED_INSURANCE_CATEGORIES = new Set([
  'Health',
  'Life',
  'Disability',
  'Auto',
  'Home & Renters',
  'Umbrella / Other',
]);
const ALLOWED_POLICY_STATUSES = new Set(['Active', 'Pending Renewal', 'Archived']);
const ALLOWED_PREMIUM_CADENCES = new Set(['Monthly', 'Quarterly', 'Annual']);

const DEFAULT_CATEGORIES: ElevateWorkspaceData['categories'] = [
  { id: 'cat_housing', name: 'Housing & Utilities', type: 'expense', bucket: 'Needs' },
  { id: 'cat_groceries', name: 'Groceries & Dining', type: 'expense', bucket: 'Needs' },
  { id: 'cat_transport', name: 'Transport & Transit', type: 'expense', bucket: 'Needs' },
  { id: 'cat_healthcare', name: 'Healthcare & Insurance', type: 'expense', bucket: 'Needs' },
  { id: 'cat_leisure', name: 'Personal & Leisure', type: 'expense', bucket: 'Wants' },
  { id: 'cat_savings', name: 'Goal Contributions', type: 'expense', bucket: 'Savings & Debt' },
  { id: 'cat_salary', name: 'Salary', type: 'income' },
  { id: 'cat_freelance', name: 'Freelance / Other Income', type: 'income' },
];

export function createEmptyWorkspace(): ElevateWorkspaceData {
  return {
    currency: 'USD',
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
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
      guideAuthorizations: {
        flow: false,
        wealth: false,
        secure: false,
        guide: false,
      },
    },
  };
}

function isValidIsoDateString(val: unknown): val is string {
  if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

function sanitizeSafeId(val: unknown, fallbackPrefix: string): string {
  if (typeof val === 'string' && /^[a-zA-Z0-9_-]{3,64}$/.test(val.trim())) {
    return val.trim();
  }
  return `${fallbackPrefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function sanitizeShortString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function sanitizeNonNegativeMoney(
  val: unknown,
  fieldLabel: string
): { ok: true; value: number } | { ok: false; error: string } {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num) || num < 0 || num > 1_000_000_000) {
    return {
      ok: false,
      error: `${fieldLabel} must be a valid number between 0 and 1,000,000,000.`,
    };
  }
  return { ok: true, value: Math.round(num * 100) / 100 };
}

export function validateAndSanitizeWorkspace(
  input: unknown
): { ok: true; workspace: ElevateWorkspaceData } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Workspace payload must be a JSON object.' };
  }
  const raw = input as Record<string, unknown>;
  const currency =
    typeof raw.currency === 'string' && ALLOWED_CURRENCIES.has(raw.currency)
      ? raw.currency
      : 'USD';

  const categoriesInput = Array.isArray(raw.categories) ? raw.categories : DEFAULT_CATEGORIES;
  if (categoriesInput.length > 100) {
    return { ok: false, error: 'Categories limit exceeded (max 100).' };
  }
  const categories: ElevateWorkspaceData['categories'] = [];
  for (const item of categoriesInput) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    const name = sanitizeShortString(c.name, 50);
    if (!name) continue;
    const type = c.type === 'income' ? 'income' : 'expense';
    const bucket =
      type === 'expense' && typeof c.bucket === 'string' && ALLOWED_BUCKETS.has(c.bucket)
        ? (c.bucket as 'Needs' | 'Wants' | 'Savings & Debt')
        : type === 'expense'
          ? 'Needs'
          : undefined;
    categories.push({
      id: sanitizeSafeId(c.id, 'cat'),
      name,
      type,
      ...(bucket ? { bucket } : {}),
    });
  }
  if (categories.length === 0) {
    categories.push(...DEFAULT_CATEGORIES.map((c) => ({ ...c })));
  }

  const accountsInput = Array.isArray(raw.accounts) ? raw.accounts : [];
  if (accountsInput.length > 100) {
    return { ok: false, error: 'Manual accounts limit exceeded (max 100).' };
  }
  const accounts: ElevateWorkspaceData['accounts'] = [];
  for (const item of accountsInput) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Invalid account record.' };
    }
    const a = item as Record<string, unknown>;
    const name = sanitizeShortString(a.name, 80);
    if (!name) return { ok: false, error: 'Account name is required.' };
    const type =
      typeof a.type === 'string' && ALLOWED_ACCOUNT_TYPES.has(a.type)
        ? (a.type as ElevateWorkspaceData['accounts'][number]['type'])
        : null;
    if (!type) return { ok: false, error: `Invalid account type for "${name}".` };
    const bal = sanitizeNonNegativeMoney(a.balance, `Balance for "${name}"`);
    if (!bal.ok) return bal;
    accounts.push({
      id: sanitizeSafeId(a.id, 'acc'),
      name,
      institutionLabel: sanitizeShortString(a.institutionLabel, 80) || 'Manual Ledger',
      type,
      balance: bal.value,
      updatedAt: isValidIsoDateString(a.updatedAt)
        ? a.updatedAt
        : new Date().toISOString().slice(0, 10),
    });
  }

  const txInput = Array.isArray(raw.transactions) ? raw.transactions : [];
  if (txInput.length > 5000) {
    return { ok: false, error: 'Transactions limit exceeded (max 5,000).' };
  }
  const transactions: ElevateWorkspaceData['transactions'] = [];
  for (const item of txInput) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Invalid transaction record.' };
    }
    const t = item as Record<string, unknown>;
    if (!isValidIsoDateString(t.date)) {
      return { ok: false, error: 'Transaction date must use YYYY-MM-DD format.' };
    }
    const description = sanitizeShortString(t.description, 120);
    if (!description) {
      return { ok: false, error: 'Transaction description is required.' };
    }
    const category = sanitizeShortString(t.category, 60);
    if (!category) {
      return { ok: false, error: 'Transaction category is required.' };
    }
    const type = t.type === 'income' ? 'income' : t.type === 'expense' ? 'expense' : null;
    if (!type) return { ok: false, error: 'Transaction type must be income or expense.' };
    const amt = sanitizeNonNegativeMoney(t.amount, `Amount for "${description}"`);
    if (!amt.ok || amt.value <= 0) {
      return { ok: false, error: `Amount for "${description}" must be greater than 0.` };
    }
    const bucket =
      type === 'expense' && typeof t.bucket === 'string' && ALLOWED_BUCKETS.has(t.bucket)
        ? (t.bucket as 'Needs' | 'Wants' | 'Savings & Debt')
        : type === 'expense'
          ? 'Needs'
          : undefined;
    const accountId =
      typeof t.accountId === 'string' && t.accountId.trim()
        ? sanitizeSafeId(t.accountId, 'acc')
        : undefined;
    const notes = sanitizeShortString(t.notes, 200) || undefined;
    transactions.push({
      id: sanitizeSafeId(t.id, 'tx'),
      date: t.date,
      description,
      category,
      type,
      ...(bucket ? { bucket } : {}),
      amount: amt.value,
      ...(accountId ? { accountId } : {}),
      ...(notes ? { notes } : {}),
    });
  }

  const budgetsInput = Array.isArray(raw.budgets) ? raw.budgets : [];
  if (budgetsInput.length > 100) {
    return { ok: false, error: 'Budgets limit exceeded (max 100).' };
  }
  const budgets: ElevateWorkspaceData['budgets'] = [];
  for (const item of budgetsInput) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Invalid budget record.' };
    }
    const b = item as Record<string, unknown>;
    const category = sanitizeShortString(b.category, 60);
    if (!category) return { ok: false, error: 'Budget category is required.' };
    const limit = sanitizeNonNegativeMoney(b.monthlyLimit, `Limit for "${category}"`);
    if (!limit.ok || limit.value <= 0) {
      return { ok: false, error: `Monthly limit for "${category}" must be greater than 0.` };
    }
    const bucket =
      typeof b.bucket === 'string' && ALLOWED_BUCKETS.has(b.bucket)
        ? (b.bucket as 'Needs' | 'Wants' | 'Savings & Debt')
        : 'Needs';
    budgets.push({
      id: sanitizeSafeId(b.id, 'bud'),
      category,
      monthlyLimit: limit.value,
      bucket,
    });
  }

  const billsInput = Array.isArray(raw.recurringBills) ? raw.recurringBills : [];
  if (billsInput.length > 200) {
    return { ok: false, error: 'Recurring bills limit exceeded (max 200).' };
  }
  const recurringBills: ElevateWorkspaceData['recurringBills'] = [];
  for (const item of billsInput) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Invalid recurring bill record.' };
    }
    const b = item as Record<string, unknown>;
    const title = sanitizeShortString(b.title, 100);
    if (!title) return { ok: false, error: 'Recurring bill title is required.' };
    const category = sanitizeShortString(b.category, 60) || 'Housing & Utilities';
    const bucket =
      typeof b.bucket === 'string' && ALLOWED_BUCKETS.has(b.bucket)
        ? (b.bucket as 'Needs' | 'Wants' | 'Savings & Debt')
        : 'Needs';
    const amt = sanitizeNonNegativeMoney(b.amount, `Amount for bill "${title}"`);
    if (!amt.ok || amt.value <= 0) {
      return { ok: false, error: `Amount for bill "${title}" must be greater than 0.` };
    }
    const cadence =
      typeof b.cadence === 'string' && ALLOWED_BILL_CADENCES.has(b.cadence)
        ? (b.cadence as ElevateWorkspaceData['recurringBills'][number]['cadence'])
        : 'Monthly';
    if (!isValidIsoDateString(b.nextDueDate)) {
      return { ok: false, error: `Next due date for bill "${title}" must use YYYY-MM-DD.` };
    }
    const accountId =
      typeof b.accountId === 'string' && b.accountId.trim()
        ? sanitizeSafeId(b.accountId, 'acc')
        : undefined;
    recurringBills.push({
      id: sanitizeSafeId(b.id, 'bill'),
      title,
      category,
      bucket,
      amount: amt.value,
      cadence,
      nextDueDate: b.nextDueDate,
      ...(accountId ? { accountId } : {}),
      active: typeof b.active === 'boolean' ? b.active : true,
    });
  }

  const holdingsInput = Array.isArray(raw.holdings) ? raw.holdings : [];
  if (holdingsInput.length > 500) {
    return { ok: false, error: 'Holdings limit exceeded (max 500).' };
  }
  const holdings: ElevateWorkspaceData['holdings'] = [];
  for (const item of holdingsInput) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Invalid holding record.' };
    }
    const h = item as Record<string, unknown>;
    const name = sanitizeShortString(h.name, 100);
    if (!name) return { ok: false, error: 'Holding name is required.' };
    const assetClass =
      typeof h.assetClass === 'string' && ALLOWED_ASSET_CLASSES.has(h.assetClass)
        ? (h.assetClass as ElevateWorkspaceData['holdings'][number]['assetClass'])
        : null;
    if (!assetClass) {
      return { ok: false, error: `Invalid asset class for holding "${name}".` };
    }
    const unitsNum = Number(h.units ?? 0);
    if (!Number.isFinite(unitsNum) || unitsNum < 0 || unitsNum > 1_000_000_000) {
      return { ok: false, error: `Units for holding "${name}" must be 0 or greater.` };
    }
    const costBasis = sanitizeNonNegativeMoney(h.costBasis, `Cost basis for "${name}"`);
    if (!costBasis.ok) return costBasis;
    const currentValue = sanitizeNonNegativeMoney(h.currentValue, `Value for "${name}"`);
    if (!currentValue.ok) return currentValue;
    if (!isValidIsoDateString(h.valuedAt)) {
      return { ok: false, error: `Valuation date for "${name}" must use YYYY-MM-DD.` };
    }
    const symbol = sanitizeShortString(h.symbol, 20) || undefined;
    const notes = sanitizeShortString(h.notes, 200) || undefined;
    holdings.push({
      id: sanitizeSafeId(h.id, 'hold'),
      name,
      ...(symbol ? { symbol } : {}),
      assetClass,
      accountLabel:
        sanitizeShortString(h.accountLabel, 80) || 'Manual Investment Account',
      units: unitsNum,
      costBasis: costBasis.value,
      currentValue: currentValue.value,
      valuedAt: h.valuedAt,
      ...(notes ? { notes } : {}),
    });
  }

  const igInput = Array.isArray(raw.investmentGoals) ? raw.investmentGoals : [];
  if (igInput.length > 100) {
    return { ok: false, error: 'Investment goals limit exceeded (max 100).' };
  }
  const investmentGoals: ElevateWorkspaceData['investmentGoals'] = [];
  for (const item of igInput) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Invalid investment goal record.' };
    }
    const g = item as Record<string, unknown>;
    const title = sanitizeShortString(g.title, 100);
    if (!title) return { ok: false, error: 'Investment goal title is required.' };
    const targetAmount = sanitizeNonNegativeMoney(
      g.targetAmount,
      `Target amount for "${title}"`
    );
    if (!targetAmount.ok || targetAmount.value <= 0) {
      return {
        ok: false,
        error: `Target amount for "${title}" must be greater than 0.`,
      };
    }
    const scope =
      g.trackingScope === 'All Holdings' ||
      g.trackingScope === 'Manual' ||
      (typeof g.trackingScope === 'string' && ALLOWED_ASSET_CLASSES.has(g.trackingScope))
        ? (g.trackingScope as ElevateWorkspaceData['investmentGoals'][number]['trackingScope'])
        : 'All Holdings';
    const monthlyContribution = sanitizeNonNegativeMoney(
      g.monthlyContribution ?? 0,
      `Monthly contribution for "${title}"`
    );
    if (!monthlyContribution.ok) return monthlyContribution;

    let manualCurrentValue: number | undefined;
    if (scope === 'Manual') {
      const mVal = sanitizeNonNegativeMoney(
        g.manualCurrentValue ?? 0,
        `Manual current value for "${title}"`
      );
      if (!mVal.ok) return mVal;
      manualCurrentValue = mVal.value;
    }

    const targetDate =
      typeof g.targetDate === 'string' && g.targetDate.trim()
        ? isValidIsoDateString(g.targetDate)
          ? g.targetDate
          : undefined
        : undefined;
    const notes = sanitizeShortString(g.notes, 200) || undefined;

    investmentGoals.push({
      id: sanitizeSafeId(g.id, 'ig'),
      title,
      targetAmount: targetAmount.value,
      trackingScope: scope,
      ...(manualCurrentValue !== undefined ? { manualCurrentValue } : {}),
      monthlyContribution: monthlyContribution.value,
      ...(targetDate ? { targetDate } : {}),
      ...(notes ? { notes } : {}),
    });
  }

  const targetAllocations: Record<string, number> = {};
  if (raw.targetAllocations && typeof raw.targetAllocations === 'object') {
    for (const [k, v] of Object.entries(raw.targetAllocations as Record<string, unknown>)) {
      if (!ALLOWED_ASSET_CLASSES.has(k)) continue;
      const num = Number(v);
      if (Number.isFinite(num) && num >= 0 && num <= 100) {
        targetAllocations[k] = Math.round(num * 10) / 10;
      }
    }
  }

  const snapshotsInput = Array.isArray(raw.snapshots) ? raw.snapshots : [];
  if (snapshotsInput.length > 500) {
    return { ok: false, error: 'Snapshots limit exceeded (max 500).' };
  }
  const snapshots: ElevateWorkspaceData['snapshots'] = [];
  for (const item of snapshotsInput) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    if (!isValidIsoDateString(s.date)) continue;
    const inv = Number(s.totalInvestedValue ?? 0);
    const cash = Number(s.totalCashValue ?? 0);
    if (!Number.isFinite(inv) || !Number.isFinite(cash)) continue;
    const note = sanitizeShortString(s.note, 100) || undefined;
    snapshots.push({
      id: sanitizeSafeId(s.id, 'snap'),
      date: s.date,
      totalInvestedValue: Math.round(inv * 100) / 100,
      totalCashValue: Math.round(cash * 100) / 100,
      ...(note ? { note } : {}),
    });
  }

  const policiesInput = Array.isArray(raw.policies) ? raw.policies : [];
  if (policiesInput.length > 200) {
    return { ok: false, error: 'Insurance policies limit exceeded (max 200).' };
  }
  const policies: ElevateWorkspaceData['policies'] = [];
  for (const item of policiesInput) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Invalid policy record.' };
    }
    const p = item as Record<string, unknown>;
    const policyName = sanitizeShortString(p.policyName, 100);
    const provider = sanitizeShortString(p.provider, 100);
    if (!policyName || !provider) {
      return { ok: false, error: 'Policy name and provider are required.' };
    }
    const category =
      typeof p.category === 'string' && ALLOWED_INSURANCE_CATEGORIES.has(p.category)
        ? (p.category as ElevateWorkspaceData['policies'][number]['category'])
        : 'Health';
    const status =
      typeof p.status === 'string' && ALLOWED_POLICY_STATUSES.has(p.status)
        ? (p.status as ElevateWorkspaceData['policies'][number]['status'])
        : 'Active';
    const coverageLimit = sanitizeNonNegativeMoney(
      p.coverageLimit ?? 0,
      `Coverage limit for "${policyName}"`
    );
    if (!coverageLimit.ok) return coverageLimit;
    const deductible = sanitizeNonNegativeMoney(
      p.deductible ?? 0,
      `Deductible for "${policyName}"`
    );
    if (!deductible.ok) return deductible;
    const premiumAmount = sanitizeNonNegativeMoney(
      p.premiumAmount ?? 0,
      `Premium for "${policyName}"`
    );
    if (!premiumAmount.ok) return premiumAmount;
    const premiumCadence =
      typeof p.premiumCadence === 'string' && ALLOWED_PREMIUM_CADENCES.has(p.premiumCadence)
        ? (p.premiumCadence as ElevateWorkspaceData['policies'][number]['premiumCadence'])
        : 'Monthly';
    if (!isValidIsoDateString(p.renewalDate)) {
      return { ok: false, error: `Renewal date for "${policyName}" must use YYYY-MM-DD.` };
    }
    const leadRaw = Number(p.reminderLeadDays ?? 30);
    const reminderLeadDays = Number.isFinite(leadRaw)
      ? Math.min(365, Math.max(1, Math.round(leadRaw)))
      : 30;
    const policyReference = sanitizeShortString(p.policyReference, 60) || undefined;
    const effectiveDate =
      typeof p.effectiveDate === 'string' && isValidIsoDateString(p.effectiveDate)
        ? p.effectiveDate
        : undefined;
    const beneficiaryOrInsured =
      sanitizeShortString(p.beneficiaryOrInsured, 100) || undefined;
    const agentOrContact = sanitizeShortString(p.agentOrContact, 100) || undefined;
    const notes = sanitizeShortString(p.notes, 250) || undefined;

    policies.push({
      id: sanitizeSafeId(p.id, 'pol'),
      policyName,
      provider,
      category,
      status,
      ...(policyReference ? { policyReference } : {}),
      ...(effectiveDate ? { effectiveDate } : {}),
      coverageLimit: coverageLimit.value,
      deductible: deductible.value,
      premiumAmount: premiumAmount.value,
      premiumCadence,
      renewalDate: p.renewalDate,
      reminderLeadDays,
      ...(beneficiaryOrInsured ? { beneficiaryOrInsured } : {}),
      ...(agentOrContact ? { agentOrContact } : {}),
      ...(notes ? { notes } : {}),
    });
  }

  const secureChecklistIds = Array.isArray(raw.secureChecklistIds)
    ? Array.from(
        new Set(
          raw.secureChecklistIds
            .filter((x): x is string => typeof x === 'string')
            .map((x) => x.trim().slice(0, 60))
            .filter(Boolean)
        )
      ).slice(0, 50)
    : [];

  const goalsInput = Array.isArray(raw.goals) ? raw.goals : [];
  if (goalsInput.length > 100) {
    return { ok: false, error: 'Savings goals limit exceeded (max 100).' };
  }
  const goals: ElevateWorkspaceData['goals'] = [];
  for (const item of goalsInput) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Invalid savings goal record.' };
    }
    const g = item as Record<string, unknown>;
    const title = sanitizeShortString(g.title, 100);
    if (!title) return { ok: false, error: 'Savings goal title is required.' };
    const targetAmount = sanitizeNonNegativeMoney(
      g.targetAmount,
      `Target amount for "${title}"`
    );
    if (!targetAmount.ok || targetAmount.value <= 0) {
      return {
        ok: false,
        error: `Target amount for "${title}" must be greater than 0.`,
      };
    }
    const currentSaved = sanitizeNonNegativeMoney(
      g.currentSaved ?? 0,
      `Current saved for "${title}"`
    );
    if (!currentSaved.ok) return currentSaved;
    const monthlyContribution = sanitizeNonNegativeMoney(
      g.monthlyContribution ?? 0,
      `Monthly contribution for "${title}"`
    );
    if (!monthlyContribution.ok) return monthlyContribution;
    const targetDate =
      typeof g.targetDate === 'string' && isValidIsoDateString(g.targetDate)
        ? g.targetDate
        : undefined;

    goals.push({
      id: sanitizeSafeId(g.id, 'goal'),
      title,
      targetAmount: targetAmount.value,
      currentSaved: currentSaved.value,
      monthlyContribution: monthlyContribution.value,
      ...(targetDate ? { targetDate } : {}),
    });
  }

  const gsRaw =
    raw.guideSettings && typeof raw.guideSettings === 'object'
      ? (raw.guideSettings as Record<string, unknown>)
      : {};
  const monthsRaw = Number(gsRaw.emergencyTargetMonths ?? 6);
  const emergencyTargetMonths = Number.isFinite(monthsRaw)
    ? Math.min(12, Math.max(3, Math.round(monthsRaw)))
    : 6;

  let customMonthlyEssentialBaseline: number | null = null;
  if (
    gsRaw.customMonthlyEssentialBaseline !== null &&
    gsRaw.customMonthlyEssentialBaseline !== undefined
  ) {
    const baseNum = Number(gsRaw.customMonthlyEssentialBaseline);
    if (Number.isFinite(baseNum) && baseNum > 0 && baseNum <= 1_000_000_000) {
      customMonthlyEssentialBaseline = Math.round(baseNum * 100) / 100;
    }
  }

  const completedActionIds = Array.isArray(gsRaw.completedActionIds)
    ? gsRaw.completedActionIds
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, 50)
    : [];

  const authRaw =
    gsRaw.guideAuthorizations && typeof gsRaw.guideAuthorizations === 'object'
      ? (gsRaw.guideAuthorizations as Record<string, unknown>)
      : {};

  return {
    ok: true,
    workspace: {
      currency,
      categories,
      accounts,
      transactions,
      budgets,
      recurringBills,
      holdings,
      investmentGoals,
      targetAllocations,
      snapshots,
      policies,
      secureChecklistIds,
      goals,
      guideSettings: {
        emergencyTargetMonths,
        customMonthlyEssentialBaseline,
        completedActionIds,
        guideAuthorizations: {
          flow: Boolean(authRaw.flow),
          wealth: Boolean(authRaw.wealth),
          secure: Boolean(authRaw.secure),
          guide: Boolean(authRaw.guide),
        },
      },
    },
  };
}

function getBackupCounts(ws: ElevateWorkspaceData): BackupCounts {
  return {
    accounts: ws.accounts.length,
    transactions: ws.transactions.length,
    budgets: ws.budgets.length,
    recurringBills: ws.recurringBills.length,
    holdings: ws.holdings.length,
    investmentGoals: ws.investmentGoals.length,
    policies: ws.policies.length,
    goals: ws.goals.length,
  };
}

function hasSubstantialRecords(ws: ElevateWorkspaceData): boolean {
  return (
    ws.accounts.length > 0 ||
    ws.transactions.length > 0 ||
    ws.budgets.length > 0 ||
    ws.recurringBills.length > 0 ||
    ws.holdings.length > 0 ||
    ws.investmentGoals.length > 0 ||
    ws.snapshots.length > 0 ||
    ws.policies.length > 0 ||
    ws.goals.length > 0
  );
}

function isValidEmail(email: string): boolean {
  if (email.length < 5 || email.length > 120) return false;
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email);
}

function hashPassword(password: string, saltHex?: string): { salt: string; hash: string } {
  const salt = saltHex ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
}

function verifyPassword(password: string, saltHex: string, storedHashHex: string): boolean {
  const { hash } = hashPassword(password, saltHex);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHashHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function atomicWriteJson(targetPath: string, rootDir: string, data: unknown): void {
  if (!targetPath.startsWith(rootDir + path.sep)) {
    throw new Error('Refusing write outside confined data directory.');
  }
  const parent = path.dirname(targetPath);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }
  const tmpPath = `${targetPath}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, targetPath);
}

function sanitizeAuditDetail(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/(password|secret|apiKey|GEMINI_API_KEY|token)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
    .slice(0, 240);
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const GUIDE_SYSTEM_INSTRUCTION = `You are Elevate Guide, an educational financial coach inside the Elevate personal finance web application.

Strict Boundaries (NEVER violate):
1. You are NOT a licensed financial adviser, planner, broker, CPA, or attorney. Never claim or imply professional licensure or personalized fiduciary advice.
2. NEVER guarantee investment returns, promise future market performance, or state assumed returns as certainties. Always label hypothetical growth rates explicitly as illustrative assumptions.
3. NEVER recommend specific financial products, stocks, ETFs, mutual funds, crypto assets, banks, or insurance carriers/policies. Discuss only general educational principles and asset/coverage concepts.
4. Explain financial concepts in clear, everyday plain language. Avoid unexplained jargon.
5. Respect data authorization strictly: only reference user financial numbers that are explicitly provided in authorizedContext. If a user asks about data that is not authorized or not provided, state clearly that you do not have access to that pillar unless they authorize it.
6. Never claim to have edited the user's data directly. If the user asks to create a savings goal, adjust emergency target months, set an essential monthly baseline, or set a category budget, populate proposedAction with actionType != "none" so the UI can ask the user for explicit approval first. If no data change is requested, set proposedAction.actionType to "none".
7. Respect plan capability flags: if scenarioComparisonsAllowed is false, set scenarioComparison.hasScenario to false and focus on plain-language conceptual guidance.
8. Keep responses concise, structured, and practical.`;

const MONTHLY_REVIEW_INSTRUCTION = `You are Elevate Guide generating a Monthly Financial Review strictly from authorized user data.

Strict Rules:
1. Reference ONLY the data pillars present inside authorizedData. If a pillar is missing or marked unauthorized, do NOT invent, estimate, or extrapolate figures for it.
2. You are an educational coach, NOT a licensed adviser. Never guarantee investment returns or recommend specific financial products, tickers, or carriers.
3. Highlight clear observations from the authorized numbers (income vs. expenses, budget utilization, emergency reserve runway, holdings allocation, or upcoming renewals if authorized).
4. Suggest 1 to 3 educational focus areas for the coming month.
5. Optionally propose at most one concrete workspace action (e.g., creating a savings goal or setting a monthly budget) inside proposedAction that requires explicit user approval before applying; otherwise set actionType to "none".`;

export interface CreateAppOptions {
  dataDir?: string;
  tokenSecret?: Buffer;
  enableVite?: boolean;
  disableRateLimit?: boolean;
}

export async function createElevateApp(options: CreateAppOptions = {}): Promise<Express> {
  const DATA_DIR = path.resolve(
    options.dataDir ?? path.resolve(__dirname, '.elevate-data')
  );
  const USERS_PATH = path.resolve(DATA_DIR, 'users.json');
  const ENTITLEMENTS_PATH = path.resolve(DATA_DIR, 'entitlements.json');
  const WORKSPACES_DIR = path.resolve(DATA_DIR, 'workspaces');
  const BACKUPS_DIR = path.resolve(DATA_DIR, 'backups');
  const AUDIT_LOG_PATH = path.resolve(DATA_DIR, 'audit.log');

  const envSecret =
    process.env.ELEVATE_AUTH_SECRET?.trim() ||
    process.env.ELEVATE_ENTITLEMENT_SECRET?.trim();
  const TOKEN_SECRET: Buffer =
    options.tokenSecret ??
    (envSecret
      ? crypto.createHash('sha256').update(envSecret).digest()
      : crypto.randomBytes(32));

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(WORKSPACES_DIR)) {
    fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const usersById = new Map<string, StoredUserRecord>();
  const userIdByEmail = new Map<string, string>();
  const subscriptions = new Map<string, SubscriptionRecord>();
  const lastAutoBackupAt = new Map<string, number>();
  const authRateWindows = new Map<string, { count: number; resetAt: number }>();

  function appendAuditLog(
    level: 'info' | 'warn' | 'error',
    event: string,
    userId: string | null,
    ip: string,
    detail: string
  ): void {
    try {
      if (!AUDIT_LOG_PATH.startsWith(DATA_DIR + path.sep)) return;
      if (fs.existsSync(AUDIT_LOG_PATH)) {
        const stat = fs.statSync(AUDIT_LOG_PATH);
        if (stat.size > 4 * 1024 * 1024) {
          const rotated = path.resolve(DATA_DIR, 'audit.log.1');
          if (rotated.startsWith(DATA_DIR + path.sep)) {
            fs.renameSync(AUDIT_LOG_PATH, rotated);
          }
        }
      }
      const entry: AuditLogRecord = {
        id: `aud_${crypto.randomBytes(6).toString('hex')}`,
        timestamp: new Date().toISOString(),
        level,
        event,
        userId,
        ip: sanitizeShortString(ip, 64) || 'unknown',
        detail: sanitizeAuditDetail(detail),
      };
      fs.appendFileSync(AUDIT_LOG_PATH, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch {
      // Never crash request handling on log rotation/write error
    }
  }

  function readAuditLogsForUser(userId: string, limit = 40): AuditLogRecord[] {
    try {
      if (!AUDIT_LOG_PATH.startsWith(DATA_DIR + path.sep)) return [];
      if (!fs.existsSync(AUDIT_LOG_PATH)) return [];
      const lines = fs.readFileSync(AUDIT_LOG_PATH, 'utf8').trim().split('\n');
      const matched: AuditLogRecord[] = [];
      for (let i = lines.length - 1; i >= 0 && matched.length < limit; i -= 1) {
        const line = lines[i];
        if (!line) continue;
        try {
          const parsed = JSON.parse(line) as AuditLogRecord;
          if (parsed && parsed.userId === userId) {
            matched.push(parsed);
          }
        } catch {
          // Skip malformed log line
        }
      }
      return matched;
    } catch {
      return [];
    }
  }

  function loadUsersFromDisk(): void {
    try {
      if (!USERS_PATH.startsWith(DATA_DIR + path.sep)) return;
      if (!fs.existsSync(USERS_PATH)) return;
      const raw = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')) as Record<
        string,
        StoredUserRecord
      >;
      if (raw && typeof raw === 'object') {
        for (const rec of Object.values(raw)) {
          if (
            rec &&
            typeof rec.id === 'string' &&
            /^usr_[a-f0-9]{16,32}$/.test(rec.id) &&
            typeof rec.email === 'string' &&
            typeof rec.passwordHash === 'string' &&
            typeof rec.passwordSalt === 'string'
          ) {
            usersById.set(rec.id, rec);
            userIdByEmail.set(rec.email.toLowerCase(), rec.id);
          }
        }
      }
    } catch {
      // Start clean if file absent/corrupt
    }
  }

  function saveUsersToDisk(): void {
    const obj: Record<string, StoredUserRecord> = {};
    for (const [id, rec] of usersById.entries()) {
      obj[id] = rec;
    }
    atomicWriteJson(USERS_PATH, DATA_DIR, obj);
  }

  function loadSubscriptionsFromDisk(): void {
    try {
      if (!ENTITLEMENTS_PATH.startsWith(DATA_DIR + path.sep)) return;
      if (!fs.existsSync(ENTITLEMENTS_PATH)) return;
      const raw = JSON.parse(
        fs.readFileSync(ENTITLEMENTS_PATH, 'utf8')
      ) as Record<string, Partial<SubscriptionRecord> & { workspaceId?: string }>;
      if (raw && typeof raw === 'object') {
        for (const [id, rec] of Object.entries(raw)) {
          const ownerId = rec.userId ?? rec.workspaceId;
          if (ownerId && (rec.plan === 'basic' || rec.plan === 'pro')) {
            subscriptions.set(id, {
              userId: ownerId,
              plan: rec.plan,
              status: rec.status ?? 'active',
              scheduledPlan: rec.scheduledPlan ?? null,
              cancelAtPeriodEnd: Boolean(rec.cancelAtPeriodEnd),
              currentPeriodEnd: rec.currentPeriodEnd ?? getNextMonthDateISO(),
              periodKey: rec.periodKey ?? getCurrentPeriodKey(),
              aiQuestionsUsed: Number(rec.aiQuestionsUsed) || 0,
              updatedAt: rec.updatedAt ?? new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // Non-fatal
    }
  }

  function saveSubscriptionsToDisk(): void {
    const obj: Record<string, SubscriptionRecord> = {};
    for (const [k, v] of subscriptions.entries()) {
      obj[k] = v;
    }
    atomicWriteJson(ENTITLEMENTS_PATH, DATA_DIR, obj);
  }

  loadUsersFromDisk();
  loadSubscriptionsFromDisk();

  function getCurrentPeriodKey(): string {
    return new Date().toISOString().slice(0, 7);
  }

  function getNextMonthDateISO(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 30);
    return d.toISOString().slice(0, 10);
  }

  function serializeUser(rec: StoredUserRecord) {
    return {
      id: rec.id,
      name: rec.name,
      email: rec.email,
      role: rec.role,
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
      signedInAt: rec.signedInAt,
    };
  }

  function getOrCreateSubscription(userId: string): SubscriptionRecord {
    const currentMonth = getCurrentPeriodKey();
    const existing = subscriptions.get(userId);
    if (existing) {
      if (existing.periodKey !== currentMonth) {
        existing.periodKey = currentMonth;
        existing.aiQuestionsUsed = 0;
        existing.updatedAt = new Date().toISOString();
        saveSubscriptionsToDisk();
      }
      return existing;
    }
    const created: SubscriptionRecord = {
      userId,
      plan: 'basic',
      status: 'active',
      scheduledPlan: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: getNextMonthDateISO(),
      periodKey: currentMonth,
      aiQuestionsUsed: 0,
      updatedAt: new Date().toISOString(),
    };
    subscriptions.set(userId, created);
    saveSubscriptionsToDisk();
    return created;
  }

  function buildBillingNotice(rec: SubscriptionRecord): string {
    const baseDisclaimer =
      'Billing preview mode: no payment provider is integrated and no live payment is processed.';
    if (rec.status === 'downgrade_scheduled' && rec.scheduledPlan === 'basic') {
      return `Scheduled to move to Elevate Basic (₹99/month) on ${rec.currentPeriodEnd}. ${baseDisclaimer}`;
    }
    if (rec.status === 'canceled') {
      return `Subscription canceled; current entitlements stay active until ${rec.currentPeriodEnd}. ${baseDisclaimer}`;
    }
    if (rec.status === 'ended') {
      return `Subscription ended; Pro features and Guide AI are locked until reactivated. ${baseDisclaimer}`;
    }
    return baseDisclaimer;
  }

  function serializeEntitlement(rec: SubscriptionRecord) {
    const effectivePlan: PlanTier | null = rec.status === 'ended' ? null : rec.plan;
    const entitlements =
      effectivePlan === null
        ? ENDED_ENTITLEMENTS
        : PLAN_CATALOG[effectivePlan].entitlements;

    return {
      workspaceId: rec.userId,
      plan: rec.plan,
      effectivePlan,
      status: rec.status,
      scheduledPlan: rec.scheduledPlan,
      cancelAtPeriodEnd: rec.cancelAtPeriodEnd,
      currentPeriodEnd: rec.currentPeriodEnd,
      periodKey: rec.periodKey,
      aiQuestionsUsed: rec.aiQuestionsUsed,
      aiQuestionsLimit: entitlements.aiMonthlyQuota,
      paymentProviderIntegrated: false as const,
      billingNotice: buildBillingNotice(rec),
      updatedAt: rec.updatedAt,
      entitlements,
    };
  }

  function getUserWorkspacePath(userId: string): string {
    if (!/^usr_[a-f0-9]{16,32}$/.test(userId)) {
      throw new Error('Invalid user identifier.');
    }
    const resolved = path.resolve(WORKSPACES_DIR, `${userId}.json`);
    if (!resolved.startsWith(WORKSPACES_DIR + path.sep)) {
      throw new Error('Path confinement check failed.');
    }
    return resolved;
  }

  function loadUserWorkspace(userId: string): ElevateWorkspaceData {
    const wsPath = getUserWorkspacePath(userId);
    if (!fs.existsSync(wsPath)) {
      const fresh = createEmptyWorkspace();
      atomicWriteJson(wsPath, WORKSPACES_DIR, fresh);
      return fresh;
    }
    try {
      const raw = JSON.parse(fs.readFileSync(wsPath, 'utf8'));
      const validated = validateAndSanitizeWorkspace(raw);
      return validated.ok ? validated.workspace : createEmptyWorkspace();
    } catch {
      return createEmptyWorkspace();
    }
  }

  function saveUserWorkspace(userId: string, ws: ElevateWorkspaceData): void {
    const wsPath = getUserWorkspacePath(userId);
    atomicWriteJson(wsPath, WORKSPACES_DIR, ws);
  }

  function getUserBackupsDir(userId: string): string {
    if (!/^usr_[a-f0-9]{16,32}$/.test(userId)) {
      throw new Error('Invalid user identifier.');
    }
    const resolved = path.resolve(BACKUPS_DIR, userId);
    if (!resolved.startsWith(BACKUPS_DIR + path.sep)) {
      throw new Error('Backup directory confinement failed.');
    }
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    return resolved;
  }

  function getBackupFilePath(userId: string, backupId: string): string | null {
    if (!/^bkp_[a-zA-Z0-9_-]{8,48}$/.test(backupId)) return null;
    const userDir = getUserBackupsDir(userId);
    const filePath = path.resolve(userDir, `${backupId}.json`);
    if (!filePath.startsWith(userDir + path.sep)) return null;
    return filePath;
  }

  function createWorkspaceBackup(
    userId: string,
    workspace: ElevateWorkspaceData,
    reason: BackupFilePayload['reason'],
    note: string
  ) {
    const userDir = getUserBackupsDir(userId);
    const id = `bkp_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const payload: BackupFilePayload = {
      id,
      userId,
      createdAt: new Date().toISOString(),
      reason,
      note: sanitizeShortString(note, 100) || `${reason} backup`,
      counts: getBackupCounts(workspace),
      workspace,
    };
    const filePath = path.resolve(userDir, `${id}.json`);
    atomicWriteJson(filePath, userDir, payload);

    // Prune older auto backups beyond 12 to keep storage tidy
    try {
      const files = fs
        .readdirSync(userDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
          const fp = path.resolve(userDir, f);
          const stat = fs.statSync(fp);
          return { fp, mtimeMs: stat.mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
      if (files.length > 25) {
        for (const old of files.slice(25)) {
          fs.unlinkSync(old.fp);
        }
      }
    } catch {
      // Non-fatal
    }

    const stat = fs.statSync(filePath);
    return {
      id: payload.id,
      createdAt: payload.createdAt,
      reason: payload.reason,
      note: payload.note,
      sizeBytes: stat.size,
      counts: payload.counts,
    };
  }

  function listUserBackups(userId: string) {
    const userDir = getUserBackupsDir(userId);
    const files = fs.readdirSync(userDir).filter((f) => f.endsWith('.json'));
    const items: Array<{
      id: string;
      createdAt: string;
      reason: BackupFilePayload['reason'];
      note: string;
      sizeBytes: number;
      counts: BackupCounts;
    }> = [];

    for (const file of files) {
      const fp = path.resolve(userDir, file);
      if (!fp.startsWith(userDir + path.sep)) continue;
      try {
        const stat = fs.statSync(fp);
        const parsed = JSON.parse(fs.readFileSync(fp, 'utf8')) as BackupFilePayload;
        if (parsed && parsed.userId === userId && parsed.id) {
          items.push({
            id: parsed.id,
            createdAt: parsed.createdAt,
            reason: parsed.reason,
            note: parsed.note,
            sizeBytes: stat.size,
            counts: parsed.counts,
          });
        }
      } catch {
        // Ignore corrupt backup metadata
      }
    }

    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function signUserToken(user: StoredUserRecord): string {
    const payload = {
      uid: user.id,
      tv: user.tokenVersion,
      jti: crypto.randomBytes(8).toString('hex'),
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(encodedPayload)
      .digest('base64url');
    return `${encodedPayload}.${sig}`;
  }

  function verifyUserToken(token: string): StoredUserRecord | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, sig] = parts;
    if (!encodedPayload || !sig) return null;

    const expectedSig = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(encodedPayload)
      .digest('base64url');

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    try {
      const parsed = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8')
      ) as { uid?: string; tv?: number; exp?: number };
      if (
        typeof parsed.uid !== 'string' ||
        typeof parsed.tv !== 'number' ||
        typeof parsed.exp !== 'number'
      ) {
        return null;
      }
      if (Date.now() > parsed.exp) return null;
      const user = usersById.get(parsed.uid);
      if (!user) return null;
      if (user.tokenVersion !== parsed.tv) return null;
      return user;
    } catch {
      return null;
    }
  }

  function requireAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authentication is required. Please sign in to continue.',
      });
      return;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    const user = verifyUserToken(token);
    if (!user) {
      res.status(401).json({
        error: 'Session is invalid or expired. Please sign in again.',
      });
      return;
    }
    req.userId = user.id;
    req.userRecord = user;
    next();
  }

  function checkAuthRateLimit(key: string): boolean {
    if (options.disableRateLimit) return true;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const entry = authRateWindows.get(key);
    if (!entry || now > entry.resetAt) {
      authRateWindows.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= 25) {
      return false;
    }
    entry.count += 1;
    return true;
  }

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, persistence: 'server_disk' });
  });

  app.get('/api/plans', (_req, res) => {
    res.json({
      currency: 'INR',
      paymentProviderIntegrated: false,
      billingModeNote:
        'Payment integration is not live yet. Plan changes update server-side entitlements in preview mode without charging any payment method.',
      plans: [PLAN_CATALOG.basic, PLAN_CATALOG.pro],
    });
  });

  // --- Authentication Routes ---
  app.post('/api/auth/register', (req, res) => {
    const ip = req.ip ?? 'unknown';
    const { name, email, password } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const rawPassword = typeof password === 'string' ? password : '';

    if (!checkAuthRateLimit(`reg:${ip}`)) {
      appendAuditLog('warn', 'auth_rate_limited', null, ip, 'Registration rate limit hit.');
      return res.status(429).json({
        error: 'Too many registration attempts. Please wait a few minutes and try again.',
      });
    }

    if (!cleanName || cleanName.length > 80) {
      return res.status(400).json({ error: 'Name must be between 1 and 80 characters.' });
    }
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (rawPassword.length < 8 || rawPassword.length > 128) {
      return res.status(400).json({
        error: 'Password must be between 8 and 128 characters.',
      });
    }
    if (userIdByEmail.has(cleanEmail)) {
      return res.status(409).json({
        error: 'An account with this email already exists. Please sign in instead.',
      });
    }

    const now = new Date().toISOString();
    const { salt, hash } = hashPassword(rawPassword);
    const userId = `usr_${crypto.randomBytes(12).toString('hex')}`;
    const userRec: StoredUserRecord = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      role: 'member',
      passwordSalt: salt,
      passwordHash: hash,
      tokenVersion: 1,
      createdAt: now,
      updatedAt: now,
      signedInAt: now,
    };

    usersById.set(userId, userRec);
    userIdByEmail.set(cleanEmail, userId);
    saveUsersToDisk();

    const workspace = createEmptyWorkspace();
    saveUserWorkspace(userId, workspace);
    const sub = getOrCreateSubscription(userId);
    const token = signUserToken(userRec);

    appendAuditLog('info', 'auth_register', userId, ip, 'Registered new Elevate account.');

    return res.status(201).json({
      token,
      user: serializeUser(userRec),
      workspace,
      entitlement: serializeEntitlement(sub),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const ip = req.ip ?? 'unknown';
    const { email, password } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const rawPassword = typeof password === 'string' ? password : '';

    if (!checkAuthRateLimit(`login:${ip}:${cleanEmail}`)) {
      appendAuditLog('warn', 'auth_rate_limited', null, ip, 'Login rate limit hit.');
      return res.status(429).json({
        error: 'Too many sign-in attempts. Please wait a few minutes and try again.',
      });
    }

    if (!isValidEmail(cleanEmail) || !rawPassword) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const uid = userIdByEmail.get(cleanEmail);
    const userRec = uid ? usersById.get(uid) : undefined;
    if (!userRec || !verifyPassword(rawPassword, userRec.passwordSalt, userRec.passwordHash)) {
      appendAuditLog(
        'warn',
        'auth_login_failed',
        userRec?.id ?? null,
        ip,
        'Failed sign-in attempt.'
      );
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    userRec.signedInAt = new Date().toISOString();
    userRec.updatedAt = userRec.signedInAt;
    saveUsersToDisk();

    const workspace = loadUserWorkspace(userRec.id);
    const sub = getOrCreateSubscription(userRec.id);
    const token = signUserToken(userRec);

    appendAuditLog('info', 'auth_login_success', userRec.id, ip, 'Signed in successfully.');

    return res.json({
      token,
      user: serializeUser(userRec),
      workspace,
      entitlement: serializeEntitlement(sub),
    });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const userRec = req.userRecord!;
    const sub = getOrCreateSubscription(userRec.id);
    return res.json({
      user: serializeUser(userRec),
      entitlement: serializeEntitlement(sub),
    });
  });

  app.patch('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const userRec = req.userRecord!;
    const ip = req.ip ?? 'unknown';
    const { name, email } = req.body ?? {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
        return res.status(400).json({ error: 'Display name must be 1 to 80 characters.' });
      }
      userRec.name = name.trim();
    }

    if (email !== undefined) {
      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!isValidEmail(cleanEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      const existingUid = userIdByEmail.get(cleanEmail);
      if (existingUid && existingUid !== userRec.id) {
        return res.status(409).json({ error: 'That email address is already in use.' });
      }
      userIdByEmail.delete(userRec.email.toLowerCase());
      userRec.email = cleanEmail;
      userIdByEmail.set(cleanEmail, userRec.id);
    }

    userRec.updatedAt = new Date().toISOString();
    saveUsersToDisk();
    appendAuditLog('info', 'auth_profile_updated', userRec.id, ip, 'Updated profile settings.');
    return res.json({ user: serializeUser(userRec) });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
    const userRec = req.userRecord!;
    const ip = req.ip ?? 'unknown';
    const { currentPassword, newPassword } = req.body ?? {};

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Current and new passwords are required.' });
    }
    if (!verifyPassword(currentPassword, userRec.passwordSalt, userRec.passwordHash)) {
      appendAuditLog(
        'warn',
        'auth_password_change_failed',
        userRec.id,
        ip,
        'Incorrect current password during password update.'
      );
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      return res
        .status(400)
        .json({ error: 'New password must be between 8 and 128 characters.' });
    }

    const { salt, hash } = hashPassword(newPassword);
    userRec.passwordSalt = salt;
    userRec.passwordHash = hash;
    userRec.tokenVersion += 1;
    userRec.updatedAt = new Date().toISOString();
    saveUsersToDisk();

    const freshToken = signUserToken(userRec);
    appendAuditLog(
      'info',
      'auth_password_changed',
      userRec.id,
      ip,
      'Password updated and prior tokens revoked.'
    );
    return res.json({ token: freshToken, user: serializeUser(userRec) });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    const userRec = req.userRecord!;
    const ip = req.ip ?? 'unknown';
    userRec.tokenVersion += 1;
    userRec.updatedAt = new Date().toISOString();
    saveUsersToDisk();
    appendAuditLog('info', 'auth_logout', userRec.id, ip, 'Signed out and revoked token.');
    return res.json({ ok: true });
  });

  // --- Workspace Persistence Routes ---
  app.get('/api/workspace', requireAuth, (req: AuthenticatedRequest, res) => {
    const workspace = loadUserWorkspace(req.userId!);
    return res.json({ workspace });
  });

  app.put('/api/workspace', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    const ip = req.ip ?? 'unknown';
    const candidate = req.body?.workspace ?? req.body;
    const validated = validateAndSanitizeWorkspace(candidate);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error });
    }

    const existing = loadUserWorkspace(userId);
    const sub = getOrCreateSubscription(userId);
    const ent = serializeEntitlement(sub).entitlements;

    // Enforce server-side plan quotas when increasing counts beyond cap
    if (
      ent.maxBudgets !== null &&
      validated.workspace.budgets.length > existing.budgets.length &&
      validated.workspace.budgets.length > ent.maxBudgets
    ) {
      return res.status(403).json({
        error: `Elevate Basic allows up to ${ent.maxBudgets} category budgets. Upgrade to Elevate Pro for unlimited budgets.`,
        code: 'PLAN_QUOTA_EXCEEDED',
      });
    }
    const existingGoals = existing.goals.length + existing.investmentGoals.length;
    const nextGoals =
      validated.workspace.goals.length + validated.workspace.investmentGoals.length;
    if (ent.maxGoals !== null && nextGoals > existingGoals && nextGoals > ent.maxGoals) {
      return res.status(403).json({
        error: `Elevate Basic allows up to ${ent.maxGoals} total goals across Guide and Wealth. Upgrade to Elevate Pro for unlimited goals.`,
        code: 'PLAN_QUOTA_EXCEEDED',
      });
    }

    // Create throttled rolling auto-backup if previous state had data
    const nowMs = Date.now();
    const lastAuto = lastAutoBackupAt.get(userId) ?? 0;
    if (hasSubstantialRecords(existing) && nowMs - lastAuto > 15 * 60 * 1000) {
      createWorkspaceBackup(userId, existing, 'auto', 'Automatic checkpoint');
      lastAutoBackupAt.set(userId, nowMs);
    }

    saveUserWorkspace(userId, validated.workspace);
    return res.json({ workspace: validated.workspace });
  });

  app.delete('/api/workspace', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    const ip = req.ip ?? 'unknown';
    const existing = loadUserWorkspace(userId);
    if (hasSubstantialRecords(existing)) {
      createWorkspaceBackup(userId, existing, 'pre_reset', 'Before workspace reset');
    }
    const fresh = createEmptyWorkspace();
    saveUserWorkspace(userId, fresh);
    appendAuditLog(
      'warn',
      'workspace_cleared',
      userId,
      ip,
      'Workspace cleared (pre-reset backup saved).'
    );
    return res.json({ workspace: fresh });
  });

  // --- Backup & Restore Routes ---
  app.get('/api/backups', requireAuth, (req: AuthenticatedRequest, res) => {
    const backups = listUserBackups(req.userId!);
    return res.json({ backups });
  });

  app.post('/api/backups', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    const ip = req.ip ?? 'unknown';
    const note = sanitizeShortString(req.body?.note, 100) || 'Manual backup';
    const current = loadUserWorkspace(userId);
    const meta = createWorkspaceBackup(userId, current, 'manual', note);
    appendAuditLog('info', 'backup_created', userId, ip, `Created backup ${meta.id}`);
    return res.status(201).json({ backup: meta });
  });

  app.post(
    '/api/backups/:backupId/restore',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const userId = req.userId!;
      const ip = req.ip ?? 'unknown';
      const { backupId } = req.params;
      const fp = getBackupFilePath(userId, backupId);
      if (!fp || !fs.existsSync(fp)) {
        return res.status(404).json({ error: 'Backup not found for your account.' });
      }

      try {
        const parsed = JSON.parse(fs.readFileSync(fp, 'utf8')) as BackupFilePayload;
        if (!parsed || parsed.userId !== userId) {
          return res.status(403).json({ error: 'Access denied for this backup.' });
        }
        const validated = validateAndSanitizeWorkspace(parsed.workspace);
        if (!validated.ok) {
          return res.status(400).json({ error: 'Stored backup failed validation.' });
        }

        const current = loadUserWorkspace(userId);
        if (hasSubstantialRecords(current)) {
          createWorkspaceBackup(
            userId,
            current,
            'pre_restore',
            `Safety snapshot before restoring ${backupId}`
          );
        }

        saveUserWorkspace(userId, validated.workspace);
        appendAuditLog(
          'info',
          'backup_restored',
          userId,
          ip,
          `Restored workspace from backup ${backupId}`
        );
        return res.json({
          workspace: validated.workspace,
          restoredBackupId: backupId,
        });
      } catch {
        return res.status(500).json({ error: 'Unable to restore backup file.' });
      }
    }
  );

  app.get(
    '/api/backups/:backupId/download',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const userId = req.userId!;
      const { backupId } = req.params;
      const fp = getBackupFilePath(userId, backupId);
      if (!fp || !fs.existsSync(fp)) {
        return res.status(404).json({ error: 'Backup not found for your account.' });
      }
      try {
        const parsed = JSON.parse(fs.readFileSync(fp, 'utf8')) as BackupFilePayload;
        if (!parsed || parsed.userId !== userId) {
          return res.status(403).json({ error: 'Access denied for this backup.' });
        }
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="elevate-${backupId}.json"`
        );
        return res.json(parsed.workspace);
      } catch {
        return res.status(500).json({ error: 'Unable to read backup file.' });
      }
    }
  );

  // --- Audit Logs (User's Own Recent Events) ---
  app.get('/api/audit-logs', requireAuth, (req: AuthenticatedRequest, res) => {
    const logs = readAuditLogsForUser(req.userId!, 50).map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      level: entry.level,
      event: entry.event,
      detail: entry.detail,
    }));
    return res.json({ logs });
  });

  // --- Entitlements & Subscription Lifecycle (Bound strictly to req.userId) ---
  app.get('/api/entitlements', requireAuth, (req: AuthenticatedRequest, res) => {
    const rec = getOrCreateSubscription(req.userId!);
    return res.json({
      entitlement: serializeEntitlement(rec),
    });
  });

  app.post(
    '/api/entitlements/change-plan',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const userId = req.userId!;
      const ip = req.ip ?? 'unknown';
      const { targetPlan, timing } = req.body ?? {};
      if (targetPlan !== 'basic' && targetPlan !== 'pro') {
        return res.status(400).json({
          error: 'Target plan must be either "basic" or "pro".',
        });
      }

      const rec = getOrCreateSubscription(userId);
      const applyTiming = timing === 'immediate' ? 'immediate' : 'period_end';

      if (targetPlan === 'pro') {
        rec.plan = 'pro';
        rec.status = 'active';
        rec.scheduledPlan = null;
        rec.cancelAtPeriodEnd = false;
        rec.currentPeriodEnd = getNextMonthDateISO();
        rec.updatedAt = new Date().toISOString();
      } else if (
        rec.plan === 'pro' &&
        rec.status !== 'ended' &&
        applyTiming === 'period_end'
      ) {
        rec.status = 'downgrade_scheduled';
        rec.scheduledPlan = 'basic';
        rec.cancelAtPeriodEnd = false;
        rec.updatedAt = new Date().toISOString();
      } else {
        rec.plan = 'basic';
        rec.status = 'active';
        rec.scheduledPlan = null;
        rec.cancelAtPeriodEnd = false;
        rec.currentPeriodEnd = getNextMonthDateISO();
        rec.updatedAt = new Date().toISOString();
      }

      saveSubscriptionsToDisk();
      appendAuditLog(
        'info',
        'plan_changed',
        userId,
        ip,
        `Plan updated to ${rec.plan} (${rec.status})`
      );
      return res.json({
        entitlement: serializeEntitlement(rec),
      });
    }
  );

  app.post(
    '/api/entitlements/cancel',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const userId = req.userId!;
      const ip = req.ip ?? 'unknown';
      const { timing, reactivate } = req.body ?? {};
      const rec = getOrCreateSubscription(userId);

      if (reactivate === true) {
        rec.status = 'active';
        rec.scheduledPlan = null;
        rec.cancelAtPeriodEnd = false;
        rec.currentPeriodEnd = getNextMonthDateISO();
        rec.updatedAt = new Date().toISOString();
      } else if (timing === 'immediate') {
        rec.status = 'ended';
        rec.scheduledPlan = null;
        rec.cancelAtPeriodEnd = true;
        rec.updatedAt = new Date().toISOString();
      } else {
        rec.status = 'canceled';
        rec.scheduledPlan = null;
        rec.cancelAtPeriodEnd = true;
        rec.updatedAt = new Date().toISOString();
      }

      saveSubscriptionsToDisk();
      appendAuditLog(
        'info',
        'plan_lifecycle_updated',
        userId,
        ip,
        `Subscription status set to ${rec.status}`
      );
      return res.json({
        entitlement: serializeEntitlement(rec),
      });
    }
  );

  app.post(
    '/api/reports/export',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const userId = req.userId!;
      const ip = req.ip ?? 'unknown';
      const rec = getOrCreateSubscription(userId);
      const state = serializeEntitlement(rec);
      const reportType =
        typeof req.body?.reportType === 'string'
          ? sanitizeShortString(req.body.reportType, 60)
          : 'csv';

      if (!state.entitlements.downloadableReports) {
        appendAuditLog(
          'warn',
          'export_denied',
          userId,
          ip,
          `Denied ${reportType} export on ${rec.plan} (${rec.status})`
        );
        return res.status(403).json({
          error:
            'Downloadable reports and CSV exports require Elevate Pro (₹199/month).',
          code: 'PLAN_UPGRADE_REQUIRED',
          requiredPlan: 'pro',
          entitlement: state,
        });
      }

      appendAuditLog('info', 'export_authorized', userId, ip, `Authorized ${reportType}`);
      return res.json({
        authorized: true,
        reportType,
        exportedAt: new Date().toISOString(),
        entitlement: state,
      });
    }
  );

  app.post(
    '/api/guide/ask',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const userId = req.userId!;
      const ip = req.ip ?? 'unknown';
      try {
        const rec = getOrCreateSubscription(userId);
        const state = serializeEntitlement(rec);

        if (state.status === 'ended' || state.aiQuestionsLimit <= 0) {
          return res.status(403).json({
            error:
              'Your subscription has ended. Reactivate Elevate Basic (₹99/month) or Elevate Pro (₹199/month) on the Plans page to ask Guide questions.',
            code: 'SUBSCRIPTION_ENDED',
            requiredPlan: 'basic',
            entitlement: state,
          });
        }

        if (rec.aiQuestionsUsed >= state.aiQuestionsLimit) {
          return res.status(403).json({
            error:
              rec.plan === 'basic'
                ? `You have used all ${state.aiQuestionsLimit} Guide AI questions included in Elevate Basic this month. Upgrade to Elevate Pro (₹199/month) for a 50-question fair-use allowance.`
                : `You have reached the ${state.aiQuestionsLimit}-question monthly fair-use allowance for Elevate Pro.`,
            code: 'QUOTA_EXCEEDED',
            requiredPlan: rec.plan === 'basic' ? 'pro' : undefined,
            entitlement: state,
          });
        }

        const { question, history, authorizedContext } = req.body ?? {};
        if (typeof question !== 'string' || !question.trim()) {
          return res
            .status(400)
            .json({ error: 'Please enter a question for Elevate Guide.' });
        }
        if (question.trim().length > 1500) {
          return res
            .status(400)
            .json({ error: 'Question must be 1,500 characters or fewer.' });
        }

        const ai = getGeminiClient();
        if (!ai) {
          return res.status(503).json({
            error:
              'Gemini API key is not configured. Configure GEMINI_API_KEY in Settings > Secrets to use live Elevate Guide Q&A.',
          });
        }

        const safeHistory = Array.isArray(history)
          ? history.slice(-6).map((h: { role?: string; text?: string }) => ({
              role: h?.role === 'model' ? 'model' : 'user',
              text: String(h?.text ?? '').slice(0, 800),
            }))
          : [];

        const promptPayload = {
          userQuestion: question.trim(),
          recentConversation: safeHistory,
          authorizedContext: authorizedContext ?? null,
          scenarioComparisonsAllowed: state.entitlements.scenarioComparisons,
        };

        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: JSON.stringify(promptPayload),
          config: {
            systemInstruction: GUIDE_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                answer: {
                  type: Type.STRING,
                  description:
                    'Plain-language educational explanation answering the user question.',
                },
                keyTakeaways: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '2 to 4 concise educational takeaways.',
                },
                scenarioComparison: {
                  type: Type.OBJECT,
                  description: 'Optional side-by-side scenario comparison when allowed.',
                  properties: {
                    hasScenario: { type: Type.BOOLEAN },
                    title: { type: Type.STRING },
                    assumptions: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    optionALabel: { type: Type.STRING },
                    optionAMetric: { type: Type.STRING },
                    optionASummary: { type: Type.STRING },
                    optionBLabel: { type: Type.STRING },
                    optionBMetric: { type: Type.STRING },
                    optionBSummary: { type: Type.STRING },
                  },
                  required: ['hasScenario'],
                },
                proposedAction: {
                  type: Type.OBJECT,
                  description:
                    'Optional action proposal requiring explicit user approval before modifying data.',
                  properties: {
                    actionType: {
                      type: Type.STRING,
                      description:
                        'One of: none, create_savings_goal, set_emergency_months, set_essential_baseline, upsert_budget',
                    },
                    summary: { type: Type.STRING },
                    title: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    monthlyContribution: { type: Type.NUMBER },
                    category: { type: Type.STRING },
                    months: { type: Type.INTEGER },
                  },
                  required: ['actionType'],
                },
                educationalNote: {
                  type: Type.STRING,
                  description: 'Brief non-advisory educational disclosure.',
                },
              },
              required: ['answer', 'keyTakeaways', 'proposedAction'],
            },
          },
        });

        const rawText = response.text?.trim() ?? '';
        if (!rawText) {
          return res.status(502).json({
            error: 'Elevate Guide received an empty response. Please try again.',
          });
        }

        const parsed = JSON.parse(rawText);
        if (!state.entitlements.scenarioComparisons) {
          parsed.scenarioComparison = { hasScenario: false };
        }

        rec.aiQuestionsUsed += 1;
        rec.updatedAt = new Date().toISOString();
        saveSubscriptionsToDisk();
        appendAuditLog('info', 'guide_ask', userId, ip, 'Generated Guide Q&A response.');

        return res.json({
          ...parsed,
          entitlement: serializeEntitlement(rec),
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to generate coaching response.';
        appendAuditLog('error', 'guide_ask_error', userId, ip, message);
        const status =
          message.includes('403') || message.includes('PERMISSION_DENIED')
            ? 403
            : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
              ? 429
              : 500;
        return res.status(status).json({ error: message });
      }
    }
  );

  app.post(
    '/api/guide/monthly-review',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const userId = req.userId!;
      const ip = req.ip ?? 'unknown';
      try {
        const rec = getOrCreateSubscription(userId);
        const state = serializeEntitlement(rec);

        if (state.status === 'ended' || state.aiQuestionsLimit <= 0) {
          return res.status(403).json({
            error:
              'Your subscription has ended. Reactivate Elevate Basic or Pro on the Plans page to generate Monthly Reviews.',
            code: 'SUBSCRIPTION_ENDED',
            requiredPlan: 'basic',
            entitlement: state,
          });
        }

        if (rec.aiQuestionsUsed >= state.aiQuestionsLimit) {
          return res.status(403).json({
            error:
              rec.plan === 'basic'
                ? `You have used all ${state.aiQuestionsLimit} Guide AI queries included in Elevate Basic this month. Upgrade to Elevate Pro (₹199/month) for higher fair-use AI allowance.`
                : `You have reached the ${state.aiQuestionsLimit}-query monthly fair-use allowance for Elevate Pro.`,
            code: 'QUOTA_EXCEEDED',
            requiredPlan: rec.plan === 'basic' ? 'pro' : undefined,
            entitlement: state,
          });
        }

        const { monthKey, currency, authorizedScopes, authorizedData } =
          req.body ?? {};
        const validScopes = Array.isArray(authorizedScopes)
          ? authorizedScopes.filter((s) =>
              ['flow', 'wealth', 'secure', 'guide'].includes(String(s))
            )
          : [];
        if (validScopes.length === 0) {
          return res.status(400).json({
            error:
              'Authorize at least one data pillar before generating a Monthly Review.',
          });
        }

        const ai = getGeminiClient();
        if (!ai) {
          return res.status(503).json({
            error:
              'Gemini API key is not configured. Configure GEMINI_API_KEY in Settings > Secrets to generate AI-assisted Monthly Reviews.',
          });
        }

        const filteredData: Record<string, unknown> = {};
        if (authorizedData && typeof authorizedData === 'object') {
          for (const scope of validScopes) {
            if (scope in (authorizedData as Record<string, unknown>)) {
              filteredData[scope] = (authorizedData as Record<string, unknown>)[scope];
            }
          }
        }

        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: JSON.stringify({
            monthKey: String(monthKey ?? ''),
            currency: String(currency ?? 'USD'),
            authorizedScopes: validScopes,
            authorizedData: filteredData,
          }),
          config: {
            systemInstruction: MONTHLY_REVIEW_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                summary: { type: Type.STRING },
                authorizedObservations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                focusAreas: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                proposedAction: {
                  type: Type.OBJECT,
                  properties: {
                    actionType: {
                      type: Type.STRING,
                      description:
                        'One of: none, create_savings_goal, set_emergency_months, set_essential_baseline, upsert_budget',
                    },
                    summary: { type: Type.STRING },
                    title: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    monthlyContribution: { type: Type.NUMBER },
                    category: { type: Type.STRING },
                    months: { type: Type.INTEGER },
                  },
                  required: ['actionType'],
                },
              },
              required: [
                'headline',
                'summary',
                'authorizedObservations',
                'focusAreas',
                'proposedAction',
              ],
            },
          },
        });

        const rawText = response.text?.trim() ?? '';
        if (!rawText) {
          return res.status(502).json({
            error: 'Monthly review returned an empty response. Please try again.',
          });
        }

        const parsed = JSON.parse(rawText);
        rec.aiQuestionsUsed += 1;
        rec.updatedAt = new Date().toISOString();
        saveSubscriptionsToDisk();
        appendAuditLog(
          'info',
          'guide_monthly_review',
          userId,
          ip,
          `Generated Monthly Review (${validScopes.join(',')})`
        );

        return res.json({
          ...parsed,
          entitlement: serializeEntitlement(rec),
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to generate monthly review.';
        appendAuditLog('error', 'guide_review_error', userId, ip, message);
        return res.status(500).json({ error: message });
      }
    }
  );

  // Explicit error handler for malformed JSON and unexpected errors
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const isSyntax =
      err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400;
    if (isSyntax) {
      return res.status(400).json({ error: 'Malformed JSON request body.' });
    }
    const msg = err instanceof Error ? err.message : 'Unexpected server error.';
    appendAuditLog('error', 'http_error', null, req.ip ?? 'unknown', msg);
    return res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  if (options.enableVite !== false) {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.resolve(__dirname, 'dist');
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  return app;
}

const isEntryPoint =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntryPoint && process.env.ELEVATE_DISABLE_LISTEN !== '1') {
  createElevateApp().then((app) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Elevate server listening on http://0.0.0.0:${PORT}`);
    });
  });
}
