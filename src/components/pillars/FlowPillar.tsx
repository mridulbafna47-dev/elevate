import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Landmark,
  PauseCircle,
  PlayCircle,
  Plus,
  Repeat,
  Search,
  Tag,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  AccountType,
  BillCadence,
  CategoryBudget,
  ExpenseBucket,
  ManualAccount,
  NavViewId,
  RecurringBill,
  Transaction,
  TransactionType,
} from '../../types/finance';
import { useElevate } from '../../context/ElevateContext';
import {
  daysUntil,
  downloadCSV,
  formatCurrency,
  formatDateShort,
  formatMonthLabel,
  formatMonthLong,
  formatPercent,
  getMonthKey,
  getTodayISO,
  isValidISODate,
  monthlyEquivalentBill,
  shiftMonthKey,
} from '../../utils/format';
import { Card, CardHeader } from '../ui/Card';
import { StatMetric } from '../ui/StatMetric';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ModalSheet } from '../ui/ModalSheet';
import { ErrorBanner, FlowLoadingSkeleton } from '../ui/FeedbackStates';
import { ProFeatureGate } from '../ui/ProFeatureGate';
import { CashFlowBarChart, MonthlyFlowDatum } from '../charts/CashFlowBarChart';
import {
  AllocationDonutChart,
  ELEVATE_CHART_PALETTE,
} from '../charts/AllocationDonutChart';

interface FieldErrors {
  [key: string]: string | undefined;
}

const BILL_CADENCES: BillCadence[] = [
  'Weekly',
  'Biweekly',
  'Monthly',
  'Quarterly',
  'Annual',
];

interface FlowPillarProps {
  onNavigate: (view: NavViewId) => void;
}

export function FlowPillar({ onNavigate }: FlowPillarProps) {
  const {
    isHydrating,
    storageError,
    clearStorageError,
    workspace,
    totalCashAssets,
    totalShortTermLiabilities,
    netCashBalance,
    currentMonthKey,
    monthlyRecurringTotal,
    entitlements,
    canAddMoreBudgets,
    requestAuthorizedReportExport,
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
  } = useElevate();

  const currency = workspace.currency;

  // Active month & ledger filters
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [ledgerScope, setLedgerScope] = useState<'month' | 'all'>('month');
  const [txFilter, setTxFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [budgetLimitNotice, setBudgetLimitNotice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Modal states
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txErrors, setTxErrors] = useState<FieldErrors>({});

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ManualAccount | null>(null);
  const [accErrors, setAccErrors] = useState<FieldErrors>({});

  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<CategoryBudget | null>(null);
  const [budErrors, setBudErrors] = useState<FieldErrors>({});

  const [billModalOpen, setBillModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringBill | null>(null);
  const [billErrors, setBillErrors] = useState<FieldErrors>({});

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catErrors, setCatErrors] = useState<FieldErrors>({});

  // Transaction form
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [txDate, setTxDate] = useState(getTodayISO());
  const [txDesc, setTxDesc] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txBucket, setTxBucket] = useState<ExpenseBucket>('Needs');
  const [txAmount, setTxAmount] = useState('');
  const [txAccountId, setTxAccountId] = useState('');
  const [txNotes, setTxNotes] = useState('');

  // Account form
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('Checking');
  const [accBalance, setAccBalance] = useState('');

  // Budget form
  const [budCategory, setBudCategory] = useState('');
  const [budLimit, setBudLimit] = useState('');
  const [budBucket, setBudBucket] = useState<ExpenseBucket>('Needs');

  // Recurring bill form
  const [billTitle, setBillTitle] = useState('');
  const [billCategory, setBillCategory] = useState('');
  const [billBucket, setBillBucket] = useState<ExpenseBucket>('Needs');
  const [billAmount, setBillAmount] = useState('');
  const [billCadence, setBillCadence] = useState<BillCadence>('Monthly');
  const [billDueDate, setBillDueDate] = useState(getTodayISO());
  const [billAccountId, setBillAccountId] = useState('');
  const [billActive, setBillActive] = useState(true);

  // Category form
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>('expense');
  const [newCatBucket, setNewCatBucket] = useState<ExpenseBucket>('Needs');

  const expenseCategories = useMemo(
    () => workspace.categories.filter((c) => c.type === 'expense'),
    [workspace.categories]
  );
  const incomeCategories = useMemo(
    () => workspace.categories.filter((c) => c.type === 'income'),
    [workspace.categories]
  );

  // Selected month metrics
  const selectedMonthMetrics = useMemo(() => {
    const txs = workspace.transactions.filter(
      (t) => getMonthKey(t.date) === selectedMonth
    );
    const income = txs
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const expenses = txs
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    const net = income - expenses;
    const rate = income > 0 ? (net / income) * 100 : 0;
    return { income, expenses, net, rate, count: txs.length };
  }, [workspace.transactions, selectedMonth]);

  // Open Transaction Modal (New or Edit)
  const openNewTransaction = (defaultType: TransactionType = 'expense') => {
    setEditingTx(null);
    setTxType(defaultType);
    const defaultCat =
      defaultType === 'income'
        ? incomeCategories[0]?.name ?? 'Salary'
        : expenseCategories[0]?.name ?? 'Groceries & Dining';
    const matchedCat = workspace.categories.find((c) => c.name === defaultCat);
    setTxCategory(defaultCat);
    setTxBucket(matchedCat?.bucket ?? 'Needs');
    setTxDate(getTodayISO());
    setTxDesc('');
    setTxAmount('');
    setTxAccountId('');
    setTxNotes('');
    setTxErrors({});
    setTxModalOpen(true);
  };

  const openEditTransaction = (tx: Transaction) => {
    setEditingTx(tx);
    setTxType(tx.type);
    setTxDate(tx.date);
    setTxDesc(tx.description);
    setTxCategory(tx.category);
    setTxBucket(tx.bucket ?? 'Needs');
    setTxAmount(String(tx.amount));
    setTxAccountId(tx.accountId ?? '');
    setTxNotes(tx.notes ?? '');
    setTxErrors({});
    setTxModalOpen(true);
  };

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {};
    const num = parseFloat(txAmount);
    if (!Number.isFinite(num) || num <= 0) {
      errors.amount = 'Enter a valid amount greater than 0.';
    } else if (num > 100000000) {
      errors.amount = 'Amount cannot exceed 100,000,000.';
    }
    if (!isValidISODate(txDate)) {
      errors.date = 'Enter a valid date (YYYY-MM-DD).';
    }
    if (!txDesc.trim()) {
      errors.description = 'Description is required.';
    } else if (txDesc.trim().length > 100) {
      errors.description = 'Description must be 100 characters or fewer.';
    }
    if (!txCategory.trim()) {
      errors.category = 'Please choose or enter a category.';
    }

    if (Object.keys(errors).length > 0) {
      setTxErrors(errors);
      return;
    }

    const payload = {
      date: txDate,
      description: txDesc.trim(),
      category: txCategory.trim(),
      type: txType,
      bucket: txType === 'expense' ? txBucket : undefined,
      amount: Math.round(num * 100) / 100,
      accountId: txAccountId || undefined,
      notes: txNotes.trim() || undefined,
    };

    if (editingTx) {
      updateTransaction(editingTx.id, payload);
      setActionMessage(`Updated "${payload.description}".`);
    } else {
      addTransaction(payload);
      setActionMessage(`Logged "${payload.description}".`);
    }
    setTxModalOpen(false);
  };

  // Account Handlers
  const openNewAccount = () => {
    setEditingAccount(null);
    setAccName('');
    setAccType('Checking');
    setAccBalance('');
    setAccErrors({});
    setAccountModalOpen(true);
  };

  const openEditAccount = (acc: ManualAccount) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccType(acc.type);
    setAccBalance(String(acc.balance));
    setAccErrors({});
    setAccountModalOpen(true);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {};
    const numeric = parseFloat(accBalance);
    if (!accName.trim()) {
      errors.name = 'Account label is required.';
    } else if (accName.trim().length > 60) {
      errors.name = 'Account label must be 60 characters or fewer.';
    }
    if (!Number.isFinite(numeric) || numeric < 0) {
      errors.balance = 'Balance must be 0 or greater.';
    }
    if (Object.keys(errors).length > 0) {
      setAccErrors(errors);
      return;
    }

    if (editingAccount) {
      updateAccount(editingAccount.id, {
        name: accName.trim(),
        type: accType,
        balance: Math.round(numeric * 100) / 100,
      });
    } else {
      addAccount({
        name: accName.trim(),
        institutionLabel: 'Manual Ledger',
        type: accType,
        balance: Math.round(numeric * 100) / 100,
      });
    }
    setAccountModalOpen(false);
  };

  // Budget Handlers
  const openNewBudget = () => {
    if (!canAddMoreBudgets) {
      setBudgetLimitNotice(
        `Elevate Basic includes up to ${entitlements.maxBudgets} category budgets. Upgrade to Elevate Pro (₹199/month) for unlimited category budgets.`
      );
      return;
    }
    setBudgetLimitNotice(null);
    setEditingBudget(null);
    const defaultCat = expenseCategories[0]?.name ?? 'Housing & Utilities';
    setBudCategory(defaultCat);
    setBudBucket(expenseCategories[0]?.bucket ?? 'Needs');
    setBudLimit('');
    setBudErrors({});
    setBudgetModalOpen(true);
  };

  const openEditBudget = (b: CategoryBudget) => {
    setBudgetLimitNotice(null);
    setEditingBudget(b);
    setBudCategory(b.category);
    setBudLimit(String(b.monthlyLimit));
    setBudBucket(b.bucket);
    setBudErrors({});
    setBudgetModalOpen(true);
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {};
    const numeric = parseFloat(budLimit);
    if (!budCategory.trim()) {
      errors.category = 'Category name is required.';
    }
    if (!Number.isFinite(numeric) || numeric <= 0) {
      errors.limit = 'Monthly limit must be greater than 0.';
    }
    const existingForCategory = workspace.budgets.some(
      (b) => b.category.toLowerCase() === budCategory.trim().toLowerCase()
    );
    if (!editingBudget && !existingForCategory && !canAddMoreBudgets) {
      errors.category = `Elevate Basic caps monthly budgets at ${entitlements.maxBudgets} categories.`;
    }
    if (Object.keys(errors).length > 0) {
      setBudErrors(errors);
      return;
    }
    upsertBudget({
      id: editingBudget?.id,
      category: budCategory.trim(),
      monthlyLimit: Math.round(numeric * 100) / 100,
      bucket: budBucket,
    });
    setBudgetModalOpen(false);
  };

  // Recurring Bill Handlers
  const openNewBill = () => {
    setEditingBill(null);
    setBillTitle('');
    const defaultCat = expenseCategories[0]?.name ?? 'Housing & Utilities';
    setBillCategory(defaultCat);
    setBillBucket(expenseCategories[0]?.bucket ?? 'Needs');
    setBillAmount('');
    setBillCadence('Monthly');
    setBillDueDate(getTodayISO());
    setBillAccountId('');
    setBillActive(true);
    setBillErrors({});
    setBillModalOpen(true);
  };

  const openEditBill = (bill: RecurringBill) => {
    setEditingBill(bill);
    setBillTitle(bill.title);
    setBillCategory(bill.category);
    setBillBucket(bill.bucket);
    setBillAmount(String(bill.amount));
    setBillCadence(bill.cadence);
    setBillDueDate(bill.nextDueDate);
    setBillAccountId(bill.accountId ?? '');
    setBillActive(bill.active);
    setBillErrors({});
    setBillModalOpen(true);
  };

  const handleSaveBill = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {};
    const numeric = parseFloat(billAmount);
    if (!billTitle.trim()) {
      errors.title = 'Bill name is required.';
    } else if (billTitle.trim().length > 80) {
      errors.title = 'Bill name must be 80 characters or fewer.';
    }
    if (!billCategory.trim()) {
      errors.category = 'Category is required.';
    }
    if (!Number.isFinite(numeric) || numeric <= 0) {
      errors.amount = 'Amount must be greater than 0.';
    }
    if (!isValidISODate(billDueDate)) {
      errors.nextDueDate = 'Enter a valid next due date (YYYY-MM-DD).';
    }
    if (Object.keys(errors).length > 0) {
      setBillErrors(errors);
      return;
    }

    const payload: Omit<RecurringBill, 'id'> = {
      title: billTitle.trim(),
      category: billCategory.trim(),
      bucket: billBucket,
      amount: Math.round(numeric * 100) / 100,
      cadence: billCadence,
      nextDueDate: billDueDate,
      accountId: billAccountId || undefined,
      active: billActive,
    };

    if (editingBill) {
      updateRecurringBill(editingBill.id, payload);
    } else {
      addRecurringBill(payload);
    }
    setBillModalOpen(false);
  };

  // Category Handlers
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCatName.trim();
    if (!clean) {
      setCatErrors({ name: 'Category name is required.' });
      return;
    }
    if (clean.length > 40) {
      setCatErrors({ name: 'Category name must be 40 characters or fewer.' });
      return;
    }
    const res = addCategory({
      name: clean,
      type: newCatType,
      bucket: newCatType === 'expense' ? newCatBucket : undefined,
    });
    if (!res.ok) {
      setCatErrors({ name: res.error });
      return;
    }
    setNewCatName('');
    setCatErrors({});
  };

  // Monthly cash flow chart series
  const monthlySeries: MonthlyFlowDatum[] = useMemo(() => {
    const map = new Map<string, { income: number; expenses: number }>();
    for (const tx of workspace.transactions) {
      const mk = getMonthKey(tx.date);
      const curr = map.get(mk) ?? { income: 0, expenses: 0 };
      if (tx.type === 'income') curr.income += tx.amount;
      else curr.expenses += tx.amount;
      map.set(mk, curr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([monthKey, vals]) => ({
        monthKey,
        income: vals.income,
        expenses: vals.expenses,
      }));
  }, [workspace.transactions]);

  // Expense breakdown for selected month
  const expenseSlices = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const tx of workspace.transactions) {
      if (tx.type === 'expense' && getMonthKey(tx.date) === selectedMonth) {
        grouped.set(tx.category, (grouped.get(tx.category) ?? 0) + tx.amount);
      }
    }
    return Array.from(grouped.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], idx) => ({
        label,
        value,
        color: ELEVATE_CHART_PALETTE[idx % ELEVATE_CHART_PALETTE.length],
      }));
  }, [workspace.transactions, selectedMonth]);

  // Selected month spend by category (for budget progress)
  const selectedMonthSpendByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const tx of workspace.transactions) {
      if (tx.type === 'expense' && getMonthKey(tx.date) === selectedMonth) {
        const key = tx.category.toLowerCase();
        m.set(key, (m.get(key) ?? 0) + tx.amount);
      }
    }
    return m;
  }, [workspace.transactions, selectedMonth]);

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of workspace.accounts) {
      map.set(a.id, a.name);
    }
    return map;
  }, [workspace.accounts]);

  const uniqueLedgerCategories = useMemo(() => {
    const set = new Set<string>(workspace.categories.map((c) => c.name));
    for (const tx of workspace.transactions) {
      set.add(tx.category);
    }
    return Array.from(set).sort();
  }, [workspace.categories, workspace.transactions]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...workspace.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((tx) => {
        if (ledgerScope === 'month' && getMonthKey(tx.date) !== selectedMonth) {
          return false;
        }
        if (txFilter !== 'all' && tx.type !== txFilter) return false;
        if (
          categoryFilter !== 'all' &&
          tx.category.toLowerCase() !== categoryFilter.toLowerCase()
        ) {
          return false;
        }
        if (
          q &&
          !tx.description.toLowerCase().includes(q) &&
          !tx.category.toLowerCase().includes(q) &&
          !(tx.notes ?? '').toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      });
  }, [
    workspace.transactions,
    ledgerScope,
    selectedMonth,
    txFilter,
    categoryFilter,
    searchQuery,
  ]);

  // Pro: Advanced Spending Insights & 3-Month Cash-Flow Forecast strictly from entered records
  const proInsightsAndForecast = useMemo(() => {
    const prevMonth = shiftMonthKey(selectedMonth, -1);
    const prevExpenses = workspace.transactions
      .filter((t) => t.type === 'expense' && getMonthKey(t.date) === prevMonth)
      .reduce((s, t) => s + t.amount, 0);

    const momDelta = selectedMonthMetrics.expenses - prevExpenses;
    const momDeltaPct =
      prevExpenses > 0 ? (momDelta / prevExpenses) * 100 : null;

    const topCategory = expenseSlices[0] ?? null;
    const topCategorySharePct =
      topCategory && selectedMonthMetrics.expenses > 0
        ? (topCategory.value / selectedMonthMetrics.expenses) * 100
        : 0;

    const recurringIncomeSharePct =
      selectedMonthMetrics.income > 0
        ? (monthlyRecurringTotal / selectedMonthMetrics.income) * 100
        : null;

    const activeMonthCount = monthlySeries.length;
    const avgMonthlyIncome =
      activeMonthCount > 0
        ? monthlySeries.reduce((s, m) => s + m.income, 0) / activeMonthCount
        : 0;
    const avgMonthlyTxExpense =
      activeMonthCount > 0
        ? monthlySeries.reduce((s, m) => s + m.expenses, 0) / activeMonthCount
        : 0;
    const projectedMonthlyOutflow =
      avgMonthlyTxExpense > 0 ? avgMonthlyTxExpense : monthlyRecurringTotal;
    const projectedMonthlyNet = avgMonthlyIncome - projectedMonthlyOutflow;

    const forecastMonths = [1, 2, 3].map((offset) => {
      const monthKey = shiftMonthKey(selectedMonth, offset);
      return {
        monthKey,
        projectedInflow: avgMonthlyIncome,
        projectedOutflow: projectedMonthlyOutflow,
        projectedNet: projectedMonthlyNet,
        projectedEndingCash: netCashBalance + projectedMonthlyNet * offset,
      };
    });

    const hasAnyInputData =
      workspace.transactions.length > 0 ||
      workspace.recurringBills.some((b) => b.active);

    return {
      prevMonth,
      prevExpenses,
      momDelta,
      momDeltaPct,
      topCategory,
      topCategorySharePct,
      recurringIncomeSharePct,
      activeMonthCount,
      avgMonthlyIncome,
      projectedMonthlyOutflow,
      projectedMonthlyNet,
      forecastMonths,
      hasAnyInputData,
    };
  }, [
    selectedMonth,
    workspace.transactions,
    workspace.recurringBills,
    selectedMonthMetrics.expenses,
    selectedMonthMetrics.income,
    expenseSlices,
    monthlyRecurringTotal,
    monthlySeries,
    netCashBalance,
  ]);

  const handleExportCSV = async () => {
    setExportError(null);
    if (filteredTransactions.length === 0) {
      setExportError('No matching transactions available to export.');
      return;
    }
    setIsExporting(true);
    try {
      const authRes = await requestAuthorizedReportExport('flow_csv');
      if (!authRes.ok) {
        setExportError(
          authRes.error ||
            'CSV export requires Elevate Pro (₹199/month).'
        );
        return;
      }
      downloadCSV(
        `elevate-flow-${ledgerScope === 'month' ? selectedMonth : 'all'}-${getTodayISO()}.csv`,
        ['Date', 'Description', 'Category', 'Type', 'Bucket', 'Account', 'Amount', 'Notes'],
        filteredTransactions.map((t) => [
          t.date,
          t.description,
          t.category,
          t.type,
          t.bucket ?? '',
          t.accountId ? accountNameById.get(t.accountId) ?? '' : '',
          t.type === 'expense' ? -t.amount : t.amount,
          t.notes ?? '',
        ])
      );
      setActionMessage(`Exported ${filteredTransactions.length} ledger row(s) to CSV.`);
    } finally {
      setIsExporting(false);
    }
  };

  if (isHydrating) {
    return <FlowLoadingSkeleton />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {storageError && (
        <ErrorBanner message={storageError} onDismiss={clearStorageError} />
      )}
      {exportError && (
        <div className="space-y-2">
          <ErrorBanner message={exportError} onDismiss={() => setExportError(null)} />
          {!entitlements.downloadableReports && (
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigate('plans')}
              >
                Compare Plans · Elevate Pro
              </Button>
            </div>
          )}
        </div>
      )}
      {actionMessage && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#1E8A78]/10 border border-[#1E8A78]/25 text-xs sm:text-sm text-[#142A3B]">
          <span className="font-medium">{actionMessage}</span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-xs font-semibold text-[#1E8A78] hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header + Month Selector */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#1E8A78]">
            Elevate Flow · Personal Finance Manager
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
            Cash flow, budgets & recurring bills
          </h1>
          <p className="mt-1.5 text-sm text-[#425466]">
            All entries validate before saving and update your Dashboard totals from the same server-synced ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Active Month Switcher */}
          <div className="inline-flex items-center bg-white border border-[#142A3B]/15 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => shiftMonthKey(m, -1))}
              aria-label="Previous month"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#425466] hover:text-[#142A3B] hover:bg-[#F7F9FA] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-xs font-semibold text-[#142A3B] whitespace-nowrap">
              {formatMonthLong(selectedMonth)}
            </span>
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => shiftMonthKey(m, 1))}
              aria-label="Next month"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#425466] hover:text-[#142A3B] hover:bg-[#F7F9FA] cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Button variant="outline" onClick={() => setCatModalOpen(true)}>
            <Tag className="w-4 h-4" />
            <span>Categories</span>
          </Button>
          <Button variant="outline" onClick={openNewAccount}>
            <Landmark className="w-4 h-4" />
            <span>Add Account</span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => openNewTransaction('expense')}
          >
            <Plus className="w-4 h-4" />
            <span>Log Entry</span>
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-[#142A3B]/10">
          <div className="sm:pr-4">
            <StatMetric
              label="Net Cash Position"
              value={
                workspace.accounts.length > 0
                  ? formatCurrency(netCashBalance, currency)
                  : '—'
              }
              detail={
                workspace.accounts.length > 0
                  ? `${formatCurrency(totalCashAssets, currency)} cash · ${formatCurrency(totalShortTermLiabilities, currency)} card balance`
                  : 'Add manual accounts below'
              }
            />
          </div>
          <div className="pt-5 sm:pt-0 sm:px-4">
            <StatMetric
              label="Income"
              value={formatCurrency(selectedMonthMetrics.income, currency)}
              tone={selectedMonthMetrics.income > 0 ? 'teal' : 'default'}
              detail={`Period: ${selectedMonth}`}
            />
          </div>
          <div className="pt-5 lg:pt-0 lg:px-4">
            <StatMetric
              label="Expenses"
              value={formatCurrency(selectedMonthMetrics.expenses, currency)}
              detail={`Period: ${selectedMonth}`}
            />
          </div>
          <div className="pt-5 lg:pt-0 lg:pl-4">
            <StatMetric
              label="Monthly Net Surplus"
              value={formatCurrency(selectedMonthMetrics.net, currency)}
              tone={
                selectedMonthMetrics.net > 0
                  ? 'teal'
                  : selectedMonthMetrics.net < 0
                    ? 'negative'
                    : 'default'
              }
              detail={
                selectedMonthMetrics.income > 0
                  ? `${formatPercent(selectedMonthMetrics.rate)} savings rate`
                  : `${selectedMonthMetrics.count} entry(ies) in ${selectedMonth}`
              }
            />
          </div>
        </div>
      </Card>

      {/* Accounts + Monthly Category Budgets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5">
          <CardHeader
            title="Manual Accounts"
            subtitle="Checking, savings, cash reserves, and cards"
            action={
              <Button variant="ghost" size="sm" onClick={openNewAccount}>
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </Button>
            }
          />
          {workspace.accounts.length > 0 ? (
            <ul className="divide-y divide-[#142A3B]/8">
              {workspace.accounts.map((acc) => (
                <li
                  key={acc.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#142A3B] truncate">
                      {acc.name}
                    </p>
                    <p className="text-xs text-[#627384]">
                      {acc.type} · Updated {formatDateShort(acc.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`text-sm font-mono tabular-nums font-semibold mr-1 ${
                        acc.type === 'Credit Card'
                          ? 'text-[#B42318]'
                          : 'text-[#142A3B]'
                      }`}
                    >
                      {acc.type === 'Credit Card' ? '-' : ''}
                      {formatCurrency(acc.balance, currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditAccount(acc)}
                      aria-label={`Edit ${acc.name}`}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#425466] hover:text-[#142A3B] hover:bg-[#F7F9FA] cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAccount(acc.id)}
                      aria-label={`Delete ${acc.name}`}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#627384] hover:text-[#B42318] hover:bg-[#B42318]/8 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Landmark className="w-5 h-5" />}
              title="No accounts logged"
              description="Add your checking, savings, cash reserve, or card balances manually."
              actionLabel="Add First Account"
              onAction={openNewAccount}
            />
          )}
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader
            title="Monthly Category Budgets"
            subtitle={
              entitlements.maxBudgets !== null
                ? `Pacing for ${formatMonthLong(selectedMonth)} · ${workspace.budgets.length} / ${entitlements.maxBudgets} categories on Basic`
                : `Pacing for ${formatMonthLong(selectedMonth)}`
            }
            action={
              <Button variant="ghost" size="sm" onClick={openNewBudget}>
                <Plus className="w-4 h-4" />
                <span>Set Budget</span>
              </Button>
            }
          />
          {budgetLimitNotice && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#D5A64A]/12 border border-[#D5A64A]/35 flex flex-wrap items-center justify-between gap-3 text-xs text-[#142A3B]">
              <span>{budgetLimitNotice}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigate('plans')}
              >
                Compare Plans · Elevate Pro
              </Button>
            </div>
          )}
          {workspace.budgets.length > 0 ? (
            <div className="space-y-4">
              {workspace.budgets.map((b) => {
                const spent =
                  selectedMonthSpendByCat.get(b.category.toLowerCase()) ?? 0;
                const pct = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
                const over = spent > b.monthlyLimit;
                const near = !over && pct >= 85;
                const barColor = over
                  ? 'bg-[#B42318]'
                  : near
                    ? 'bg-[#D5A64A]'
                    : 'bg-[#1E8A78]';

                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-[#142A3B] truncate">
                          {b.category}
                        </span>
                        <span className="text-xs text-[#627384]">· {b.bucket}</span>
                        {over && (
                          <span className="text-xs font-semibold text-[#B42318]">
                            Over budget
                          </span>
                        )}
                        {near && (
                          <span className="text-xs font-semibold text-[#946C1B]">
                            Near limit
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs font-mono tabular-nums text-[#425466] mr-1">
                          <strong className="text-[#142A3B]">
                            {formatCurrency(spent, currency)}
                          </strong>{' '}
                          / {formatCurrency(b.monthlyLimit, currency)}
                        </span>
                        <button
                          type="button"
                          onClick={() => openEditBudget(b)}
                          aria-label={`Edit ${b.category} budget`}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#425466] hover:text-[#142A3B] hover:bg-[#F7F9FA] cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBudget(b.id)}
                          aria-label={`Remove ${b.category} budget`}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#627384] hover:text-[#B42318] hover:bg-[#B42318]/8 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#EEF2F5] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Wallet className="w-5 h-5" />}
              title="No monthly category budgets set"
              description="Define monthly spending targets for housing, groceries, or savings contributions."
              actionLabel="Set First Budget"
              onAction={openNewBudget}
            />
          )}
        </Card>
      </div>

      {/* Recurring Bills & Obligations */}
      <Card>
        <CardHeader
          title="Recurring Bills & Fixed Commitments"
          subtitle={
            workspace.recurringBills.length > 0
              ? `Active monthly equivalent: ${formatCurrency(monthlyRecurringTotal, currency)}/mo`
              : 'Track rent, utilities, subscriptions, and scheduled payments'
          }
          action={
            <Button variant="outline" size="sm" onClick={openNewBill}>
              <Plus className="w-4 h-4" />
              <span>Add Recurring Bill</span>
            </Button>
          }
        />

        {workspace.recurringBills.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workspace.recurringBills.map((bill) => {
              const days = daysUntil(bill.nextDueDate);
              const dueSoon = bill.active && days !== null && days <= 7;
              const monthlyEq = monthlyEquivalentBill(bill.amount, bill.cadence);

              return (
                <div
                  key={bill.id}
                  className={`p-4 rounded-xl border border-[#142A3B]/10 flex flex-col justify-between gap-3 ${
                    bill.active ? 'bg-white' : 'bg-[#F7F9FA]/80 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-[#627384]">
                        <span>{bill.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{bill.cadence}</span>
                        {!bill.active && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#425466]">Paused</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-[#142A3B] mt-0.5 truncate">
                        {bill.title}
                      </h3>
                      <p className="text-xs text-[#425466] mt-0.5 font-mono tabular-nums">
                        {formatCurrency(bill.amount, currency)} per cycle
                        {bill.cadence !== 'Monthly' &&
                          ` (${formatCurrency(monthlyEq, currency)}/mo)`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          updateRecurringBill(bill.id, { active: !bill.active })
                        }
                        aria-label={bill.active ? `Pause ${bill.title}` : `Resume ${bill.title}`}
                        className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-[#425466] hover:text-[#142A3B] hover:bg-[#F7F9FA] cursor-pointer"
                      >
                        {bill.active ? (
                          <PauseCircle className="w-4 h-4" />
                        ) : (
                          <PlayCircle className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditBill(bill)}
                        aria-label={`Edit ${bill.title}`}
                        className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-[#425466] hover:text-[#142A3B] hover:bg-[#F7F9FA] cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRecurringBill(bill.id)}
                        aria-label={`Delete ${bill.title}`}
                        className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-[#627384] hover:text-[#B42318] hover:bg-[#B42318]/8 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#142A3B]/8 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span
                      className={`inline-flex items-center gap-1.5 font-medium ${
                        dueSoon ? 'text-[#946C1B] font-semibold' : 'text-[#425466]'
                      }`}
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>
                        Next due {formatDateShort(bill.nextDueDate)}
                        {dueSoon && days !== null
                          ? days <= 0
                            ? ' (Due)'
                            : ` (${days}d)`
                          : ''}
                      </span>
                    </span>

                    {bill.active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          logRecurringBillPayment(bill.id);
                          setActionMessage(
                            `Recorded "${bill.title}" in ledger and advanced next due date.`
                          );
                        }}
                      >
                        Log Payment Now
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Repeat className="w-5 h-5" />}
            title="No recurring bills tracked"
            description="Add rent, utilities, or recurring subscriptions to monitor upcoming due dates and log payments in one click."
            actionLabel="Add First Recurring Bill"
            onAction={openNewBill}
          />
        )}
      </Card>

      {/* Monthly Cash Flow Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Monthly Cash Flow"
            subtitle="Up to 6 recent months of recorded entries"
          />
          {monthlySeries.length > 0 ? (
            <CashFlowBarChart data={monthlySeries} currency={currency} />
          ) : (
            <EmptyState
              icon={<ArrowUpRight className="w-5 h-5" />}
              title="No cash flow history yet"
              description="Add income and expense entries to visualize your monthly balance."
              actionLabel="Log First Entry"
              onAction={() => openNewTransaction('income')}
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Expense Mix"
            subtitle={`Category breakdown for ${formatMonthLong(selectedMonth)}`}
          />
          {expenseSlices.length > 0 ? (
            <AllocationDonutChart
              slices={expenseSlices}
              currency={currency}
              centerLabel="Spent"
            />
          ) : (
            <EmptyState
              icon={<ArrowDownLeft className="w-5 h-5" />}
              title={`No expenses in ${formatMonthLong(selectedMonth)}`}
              description="Logged expenses for this month break down automatically by category."
              actionLabel="Log Expense"
              onAction={() => openNewTransaction('expense')}
            />
          )}
        </Card>
      </div>

      {/* Transaction Ledger */}
      <Card>
        <CardHeader
          title="Transaction Ledger"
          subtitle="Search, edit, delete, or export your recorded entries"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isExporting}
                onClick={handleExportCSV}
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {isExporting
                    ? 'Verifying...'
                    : entitlements.downloadableReports
                      ? 'Export CSV'
                      : 'Export CSV (Pro)'}
                </span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openNewTransaction('expense')}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Entry</span>
              </Button>
            </div>
          }
        />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <SegmentedControl
              ariaLabel="Filter ledger by transaction type"
              value={txFilter}
              onChange={setTxFilter}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'income', label: 'Income' },
                { value: 'expense', label: 'Expenses' },
              ]}
            />

            <SegmentedControl
              ariaLabel="Filter ledger by month scope"
              value={ledgerScope}
              onChange={setLedgerScope}
              options={[
                { value: 'month', label: formatMonthLong(selectedMonth) },
                { value: 'all', label: 'All Months' },
              ]}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="min-h-[40px] px-3 py-2 text-xs sm:text-sm rounded-xl border border-[#142A3B]/15 bg-[#F7F9FA] text-[#142A3B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
            >
              <option value="all">All Categories</option>
              {uniqueLedgerCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-[#627384] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search description..."
                aria-label="Search transactions"
                className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm rounded-xl border border-[#142A3B]/15 bg-[#F7F9FA] text-[#142A3B] placeholder:text-[#627384] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>
        </div>

        {filteredTransactions.length > 0 ? (
          <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-[#142A3B]/10 text-xs font-medium text-[#627384]">
                  <th className="py-2.5 pr-4">Date</th>
                  <th className="py-2.5 pr-4">Description</th>
                  <th className="py-2.5 pr-4">Category</th>
                  <th className="py-2.5 pr-4">Account</th>
                  <th className="py-2.5 pr-4 text-right">Amount</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#142A3B]/8 text-sm">
                {filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-[#F7F9FA]/70 transition-colors"
                  >
                    <td className="py-3 pr-4 text-xs font-mono tabular-nums text-[#425466] whitespace-nowrap">
                      {formatDateShort(tx.date)}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-[#142A3B]">
                        {tx.description}
                      </p>
                      {tx.notes && (
                        <p className="text-xs text-[#627384] truncate max-w-xs">
                          {tx.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs text-[#425466]">
                      {tx.category}
                      {tx.bucket ? ` · ${tx.bucket}` : ''}
                    </td>
                    <td className="py-3 pr-4 text-xs text-[#627384]">
                      {tx.accountId
                        ? accountNameById.get(tx.accountId) ?? '—'
                        : '—'}
                    </td>
                    <td
                      className={`py-3 pr-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        tx.type === 'income'
                          ? 'text-[#1E8A78]'
                          : 'text-[#142A3B]'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatCurrency(tx.amount, currency)}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEditTransaction(tx)}
                        aria-label={`Edit ${tx.description}`}
                        className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-[#425466] hover:text-[#142A3B] hover:bg-[#142A3B]/5 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTransaction(tx.id)}
                        aria-label={`Delete ${tx.description}`}
                        className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-[#627384] hover:text-[#B42318] hover:bg-[#B42318]/8 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Wallet className="w-5 h-5" />}
            title="No matching entries"
            description={
              workspace.transactions.length === 0
                ? 'Log your first income or expense entry to start building your ledger.'
                : 'No entries match your active month, category, or search filters.'
            }
            actionLabel="Log Entry"
            onAction={() => openNewTransaction('expense')}
          />
        )}
      </Card>

      {/* Pro: Advanced Spending Insights & 3-Month Cash-Flow Forecast */}
      {entitlements.advancedSpendingInsights && entitlements.cashFlowForecasting ? (
        <Card>
          <CardHeader
            title="Advanced Spending Insights & Cash-Flow Forecast"
            subtitle="Deterministic metrics & 3-month projection derived strictly from your entered Flow balances, transactions, and recurring bills"
          />

          {proInsightsAndForecast.hasAnyInputData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10">
                  <p className="text-xs text-[#627384]">
                    Month-over-Month Spend Change
                  </p>
                  <p className="mt-1 text-lg font-bold font-mono tabular-nums text-[#142A3B]">
                    {proInsightsAndForecast.momDeltaPct !== null
                      ? `${proInsightsAndForecast.momDelta >= 0 ? '+' : ''}${formatCurrency(proInsightsAndForecast.momDelta, currency)}`
                      : '—'}
                  </p>
                  <p className="text-xs text-[#425466] mt-1">
                    {proInsightsAndForecast.momDeltaPct !== null
                      ? `${proInsightsAndForecast.momDeltaPct >= 0 ? '+' : ''}${proInsightsAndForecast.momDeltaPct.toFixed(1)}% vs. ${formatMonthLabel(proInsightsAndForecast.prevMonth)} (${formatCurrency(proInsightsAndForecast.prevExpenses, currency)})`
                      : `No expenses logged in ${formatMonthLabel(proInsightsAndForecast.prevMonth)} for comparison.`}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10">
                  <p className="text-xs text-[#627384]">
                    Top Spending Concentration ({formatMonthLabel(selectedMonth)})
                  </p>
                  <p className="mt-1 text-lg font-bold text-[#142A3B] truncate">
                    {proInsightsAndForecast.topCategory
                      ? proInsightsAndForecast.topCategory.label
                      : '—'}
                  </p>
                  <p className="text-xs text-[#425466] mt-1 font-mono tabular-nums">
                    {proInsightsAndForecast.topCategory
                      ? `${formatCurrency(proInsightsAndForecast.topCategory.value, currency)} (${proInsightsAndForecast.topCategorySharePct.toFixed(1)}% of monthly spend)`
                      : 'No expenses logged for selected month.'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10">
                  <p className="text-xs text-[#627384]">
                    Fixed Recurring Commitment Share
                  </p>
                  <p className="mt-1 text-lg font-bold font-mono tabular-nums text-[#142A3B]">
                    {proInsightsAndForecast.recurringIncomeSharePct !== null
                      ? `${proInsightsAndForecast.recurringIncomeSharePct.toFixed(1)}%`
                      : formatCurrency(monthlyRecurringTotal, currency)}
                  </p>
                  <p className="text-xs text-[#425466] mt-1">
                    {proInsightsAndForecast.recurringIncomeSharePct !== null
                      ? `${formatCurrency(monthlyRecurringTotal, currency)}/mo active bills vs. logged income`
                      : 'Active recurring monthly equivalent (log income to compute %)'}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#142A3B]/10 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#142A3B]">
                    3-Month Cash-Flow Forecast (From Entered Data)
                  </h3>
                  <p className="text-xs text-[#627384] mt-0.5">
                    Baseline uses your current net cash ({formatCurrency(netCashBalance, currency)}) plus{' '}
                    {proInsightsAndForecast.activeMonthCount > 0
                      ? `your ${proInsightsAndForecast.activeMonthCount}-month logged average (${formatCurrency(proInsightsAndForecast.avgMonthlyIncome, currency)}/mo inflow − ${formatCurrency(proInsightsAndForecast.projectedMonthlyOutflow, currency)}/mo outflow).`
                      : `active recurring commitments (${formatCurrency(monthlyRecurringTotal, currency)}/mo).`}
                  </p>
                </div>

                <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
                  <table className="w-full text-left border-collapse min-w-[520px]">
                    <thead>
                      <tr className="border-b border-[#142A3B]/10 text-xs font-medium text-[#627384]">
                        <th className="py-2 pr-4">Projected Month</th>
                        <th className="py-2 pr-4 text-right">Est. Inflow</th>
                        <th className="py-2 pr-4 text-right">Est. Outflow</th>
                        <th className="py-2 pr-4 text-right">Projected Net</th>
                        <th className="py-2 text-right">Est. Ending Cash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#142A3B]/8 text-sm">
                      {proInsightsAndForecast.forecastMonths.map((row) => (
                        <tr key={row.monthKey}>
                          <td className="py-2.5 pr-4 font-medium text-[#142A3B]">
                            {formatMonthLong(row.monthKey)}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#1E8A78]">
                            {formatCurrency(row.projectedInflow, currency)}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#142A3B]">
                            {formatCurrency(row.projectedOutflow, currency)}
                          </td>
                          <td
                            className={`py-2.5 pr-4 text-right font-mono tabular-nums font-semibold ${
                              row.projectedNet >= 0
                                ? 'text-[#1E8A78]'
                                : 'text-[#B42318]'
                            }`}
                          >
                            {row.projectedNet >= 0 ? '+' : ''}
                            {formatCurrency(row.projectedNet, currency)}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-[#142A3B]">
                            {formatCurrency(row.projectedEndingCash, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Wallet className="w-5 h-5" />}
              title="Enter transactions or recurring bills to unlock insights"
              description="Elevate never invents forecast baselines. Once you log income, expenses, or recurring commitments, month-over-month deltas and 3-month projections populate here."
            />
          )}
        </Card>
      ) : (
        <ProFeatureGate
          title="Advanced Spending Insights & 3-Month Cash-Flow Forecasting"
          description="Unlock month-over-month spend comparisons, category concentration analysis, and deterministic 3-month cash-flow projections computed from your entered Flow records on Elevate Pro (₹199/month)."
          onComparePlans={() => onNavigate('plans')}
        />
      )}

      {/* Add / Edit Transaction Modal */}
      <ModalSheet
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        title={editingTx ? 'Edit Cash Flow Entry' : 'Log Cash Flow Entry'}
        subtitle="All fields are validated before saving to your ledger."
      >
        <form onSubmit={handleSaveTransaction} noValidate className="space-y-4">
          <div className="flex justify-start">
            <SegmentedControl
              ariaLabel="Entry type"
              value={txType}
              onChange={(v) => {
                setTxType(v);
                const list = v === 'income' ? incomeCategories : expenseCategories;
                if (list.length > 0) {
                  setTxCategory(list[0].name);
                  if (list[0].bucket) setTxBucket(list[0].bucket);
                }
              }}
              options={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="tx-amount"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Amount ({currency})
              </label>
              <input
                id="tx-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={txAmount}
                aria-invalid={Boolean(txErrors.amount)}
                onChange={(e) => {
                  setTxAmount(e.target.value);
                  setTxErrors((prev) => ({ ...prev, amount: undefined }));
                }}
                placeholder="0.00"
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  txErrors.amount ? 'border-[#B42318]' : 'border-[#142A3B]/15'
                }`}
              />
              {txErrors.amount && (
                <p className="mt-1 text-xs text-[#B42318]">{txErrors.amount}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="tx-date"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Date
              </label>
              <input
                id="tx-date"
                type="date"
                value={txDate}
                aria-invalid={Boolean(txErrors.date)}
                onChange={(e) => {
                  setTxDate(e.target.value);
                  setTxErrors((prev) => ({ ...prev, date: undefined }));
                }}
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  txErrors.date ? 'border-[#B42318]' : 'border-[#142A3B]/15'
                }`}
              />
              {txErrors.date && (
                <p className="mt-1 text-xs text-[#B42318]">{txErrors.date}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="tx-desc"
              className="block text-xs font-semibold text-[#142A3B] mb-1.5"
            >
              Description
            </label>
            <input
              id="tx-desc"
              type="text"
              value={txDesc}
              aria-invalid={Boolean(txErrors.description)}
              onChange={(e) => {
                setTxDesc(e.target.value);
                setTxErrors((prev) => ({ ...prev, description: undefined }));
              }}
              placeholder={
                txType === 'income'
                  ? 'e.g., Monthly salary deposit'
                  : 'e.g., Weekly groceries'
              }
              className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                txErrors.description ? 'border-[#B42318]' : 'border-[#142A3B]/15'
              }`}
            />
            {txErrors.description && (
              <p className="mt-1 text-xs text-[#B42318]">
                {txErrors.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="tx-cat"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Category
              </label>
              <select
                id="tx-cat"
                value={txCategory}
                aria-invalid={Boolean(txErrors.category)}
                onChange={(e) => {
                  const val = e.target.value;
                  setTxCategory(val);
                  const found = workspace.categories.find(
                    (c) => c.name === val && c.type === txType
                  );
                  if (found?.bucket) setTxBucket(found.bucket);
                  setTxErrors((prev) => ({ ...prev, category: undefined }));
                }}
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  txErrors.category ? 'border-[#B42318]' : 'border-[#142A3B]/15'
                }`}
              >
                {(txType === 'income' ? incomeCategories : expenseCategories).map(
                  (c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  )
                )}
                {txCategory &&
                  !(txType === 'income'
                    ? incomeCategories
                    : expenseCategories
                  ).some((c) => c.name === txCategory) && (
                    <option value={txCategory}>{txCategory}</option>
                  )}
              </select>
              {txErrors.category && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {txErrors.category}
                </p>
              )}
            </div>

            {txType === 'expense' && (
              <div>
                <label
                  htmlFor="tx-bucket"
                  className="block text-xs font-semibold text-[#142A3B] mb-1.5"
                >
                  Guide Allocation Bucket
                </label>
                <select
                  id="tx-bucket"
                  value={txBucket}
                  onChange={(e) => setTxBucket(e.target.value as ExpenseBucket)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                >
                  <option value="Needs">Needs (Essential)</option>
                  <option value="Wants">Wants (Discretionary)</option>
                  <option value="Savings & Debt">Savings & Debt Payoff</option>
                </select>
              </div>
            )}
          </div>

          {workspace.accounts.length > 0 && (
            <div>
              <label
                htmlFor="tx-account"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Associated Account (Optional)
              </label>
              <select
                id="tx-account"
                value={txAccountId}
                onChange={(e) => setTxAccountId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              >
                <option value="">None selected</option>
                {workspace.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor="tx-notes"
              className="block text-xs font-semibold text-[#142A3B] mb-1.5"
            >
              Notes (Optional)
            </label>
            <input
              id="tx-notes"
              type="text"
              maxLength={140}
              value={txNotes}
              onChange={(e) => setTxNotes(e.target.value)}
              placeholder="Optional memo"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setTxModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary">
              {editingTx ? 'Save Changes' : 'Save Entry'}
            </Button>
          </div>
        </form>
      </ModalSheet>

      {/* Account Modal */}
      <ModalSheet
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        title={editingAccount ? 'Update Manual Account' : 'Add Manual Account'}
        subtitle="Track checking, savings, reserves, or card balances."
      >
        <form onSubmit={handleSaveAccount} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="acc-name"
              className="block text-xs font-semibold text-[#142A3B] mb-1.5"
            >
              Account Label
            </label>
            <input
              id="acc-name"
              type="text"
              value={accName}
              aria-invalid={Boolean(accErrors.name)}
              onChange={(e) => {
                setAccName(e.target.value);
                setAccErrors((p) => ({ ...p, name: undefined }));
              }}
              placeholder="e.g., Primary Checking"
              className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                accErrors.name ? 'border-[#B42318]' : 'border-[#142A3B]/15'
              }`}
            />
            {accErrors.name && (
              <p className="mt-1 text-xs text-[#B42318]">{accErrors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="acc-type"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Account Type
              </label>
              <select
                id="acc-type"
                value={accType}
                onChange={(e) => setAccType(e.target.value as AccountType)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              >
                <option value="Checking">Checking</option>
                <option value="Savings">Savings</option>
                <option value="Cash Reserve">Cash Reserve</option>
                <option value="Credit Card">Credit Card (Owed Balance)</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="acc-balance"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Current Balance ({currency})
              </label>
              <input
                id="acc-balance"
                type="number"
                step="0.01"
                min="0"
                value={accBalance}
                aria-invalid={Boolean(accErrors.balance)}
                onChange={(e) => {
                  setAccBalance(e.target.value);
                  setAccErrors((p) => ({ ...p, balance: undefined }));
                }}
                placeholder="0.00"
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  accErrors.balance ? 'border-[#B42318]' : 'border-[#142A3B]/15'
                }`}
              />
              {accErrors.balance && (
                <p className="mt-1 text-xs text-[#B42318]">{accErrors.balance}</p>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setAccountModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingAccount ? 'Save Changes' : 'Add Account'}
            </Button>
          </div>
        </form>
      </ModalSheet>

      {/* Budget Modal */}
      <ModalSheet
        open={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        title={editingBudget ? 'Edit Monthly Budget' : 'Set Monthly Category Budget'}
        subtitle="Define a monthly spending limit for an expense category."
      >
        <form onSubmit={handleSaveBudget} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="bud-cat"
              className="block text-xs font-semibold text-[#142A3B] mb-1.5"
            >
              Expense Category
            </label>
            <select
              id="bud-cat"
              value={budCategory}
              disabled={Boolean(editingBudget)}
              onChange={(e) => {
                const val = e.target.value;
                setBudCategory(val);
                const found = expenseCategories.find((c) => c.name === val);
                if (found?.bucket) setBudBucket(found.bucket);
                setBudErrors((p) => ({ ...p, category: undefined }));
              }}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] disabled:bg-[#F7F9FA]"
            >
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
              {budCategory &&
                !expenseCategories.some((c) => c.name === budCategory) && (
                  <option value={budCategory}>{budCategory}</option>
                )}
            </select>
            {budErrors.category && (
              <p className="mt-1 text-xs text-[#B42318]">{budErrors.category}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="bud-limit"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Monthly Limit ({currency})
              </label>
              <input
                id="bud-limit"
                type="number"
                step="0.01"
                min="0.01"
                value={budLimit}
                aria-invalid={Boolean(budErrors.limit)}
                onChange={(e) => {
                  setBudLimit(e.target.value);
                  setBudErrors((p) => ({ ...p, limit: undefined }));
                }}
                placeholder="500.00"
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  budErrors.limit ? 'border-[#B42318]' : 'border-[#142A3B]/15'
                }`}
              />
              {budErrors.limit && (
                <p className="mt-1 text-xs text-[#B42318]">{budErrors.limit}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="bud-bucket"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                50/30/20 Bucket
              </label>
              <select
                id="bud-bucket"
                value={budBucket}
                onChange={(e) => setBudBucket(e.target.value as ExpenseBucket)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              >
                <option value="Needs">Needs</option>
                <option value="Wants">Wants</option>
                <option value="Savings & Debt">Savings & Debt</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setBudgetModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary">
              {editingBudget ? 'Update Budget' : 'Save Budget'}
            </Button>
          </div>
        </form>
      </ModalSheet>

      {/* Recurring Bill Modal */}
      <ModalSheet
        open={billModalOpen}
        onClose={() => setBillModalOpen(false)}
        title={editingBill ? 'Edit Recurring Bill' : 'Add Recurring Bill'}
        subtitle="Schedule recurring bills and log payments directly into your Flow ledger."
      >
        <form onSubmit={handleSaveBill} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="bill-title"
              className="block text-xs font-semibold text-[#142A3B] mb-1.5"
            >
              Bill / Commitment Name
            </label>
            <input
              id="bill-title"
              type="text"
              value={billTitle}
              aria-invalid={Boolean(billErrors.title)}
              onChange={(e) => {
                setBillTitle(e.target.value);
                setBillErrors((p) => ({ ...p, title: undefined }));
              }}
              placeholder="e.g., Apartment Rent or Internet"
              className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                billErrors.title ? 'border-[#B42318]' : 'border-[#142A3B]/15'
              }`}
            />
            {billErrors.title && (
              <p className="mt-1 text-xs text-[#B42318]">{billErrors.title}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="bill-amount"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Amount ({currency})
              </label>
              <input
                id="bill-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={billAmount}
                aria-invalid={Boolean(billErrors.amount)}
                onChange={(e) => {
                  setBillAmount(e.target.value);
                  setBillErrors((p) => ({ ...p, amount: undefined }));
                }}
                placeholder="0.00"
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  billErrors.amount ? 'border-[#B42318]' : 'border-[#142A3B]/15'
                }`}
              />
              {billErrors.amount && (
                <p className="mt-1 text-xs text-[#B42318]">{billErrors.amount}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="bill-cadence"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Billing Cadence
              </label>
              <select
                id="bill-cadence"
                value={billCadence}
                onChange={(e) => setBillCadence(e.target.value as BillCadence)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              >
                {BILL_CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="bill-category"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Category
              </label>
              <select
                id="bill-category"
                value={billCategory}
                onChange={(e) => {
                  const val = e.target.value;
                  setBillCategory(val);
                  const found = expenseCategories.find((c) => c.name === val);
                  if (found?.bucket) setBillBucket(found.bucket);
                  setBillErrors((p) => ({ ...p, category: undefined }));
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              >
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              {billErrors.category && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {billErrors.category}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="bill-due"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Next Due Date
              </label>
              <input
                id="bill-due"
                type="date"
                value={billDueDate}
                aria-invalid={Boolean(billErrors.nextDueDate)}
                onChange={(e) => {
                  setBillDueDate(e.target.value);
                  setBillErrors((p) => ({ ...p, nextDueDate: undefined }));
                }}
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                  billErrors.nextDueDate
                    ? 'border-[#B42318]'
                    : 'border-[#142A3B]/15'
                }`}
              />
              {billErrors.nextDueDate && (
                <p className="mt-1 text-xs text-[#B42318]">
                  {billErrors.nextDueDate}
                </p>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setBillModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary">
              {editingBill ? 'Save Bill' : 'Add Recurring Bill'}
            </Button>
          </div>
        </form>
      </ModalSheet>

      {/* Manage Categories Modal */}
      <ModalSheet
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title="Manage Flow Categories"
        subtitle="Customize income and expense categories used in transactions, budgets, and bills."
      >
        <div className="space-y-5">
          <form
            onSubmit={handleAddCategory}
            noValidate
            className="p-4 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="new-cat-name"
                  className="block text-xs font-semibold text-[#142A3B] mb-1"
                >
                  New Category Name
                </label>
                <input
                  id="new-cat-name"
                  type="text"
                  value={newCatName}
                  aria-invalid={Boolean(catErrors.name)}
                  onChange={(e) => {
                    setNewCatName(e.target.value);
                    setCatErrors({});
                  }}
                  placeholder="e.g., Childcare or Subscriptions"
                  className={`w-full min-h-[40px] px-3 py-1.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78] ${
                    catErrors.name ? 'border-[#B42318]' : 'border-[#142A3B]/15'
                  }`}
                />
                {catErrors.name && (
                  <p className="mt-1 text-xs text-[#B42318]">{catErrors.name}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="new-cat-type"
                  className="block text-xs font-semibold text-[#142A3B] mb-1"
                >
                  Type
                </label>
                <select
                  id="new-cat-type"
                  value={newCatType}
                  onChange={(e) =>
                    setNewCatType(e.target.value as TransactionType)
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#142A3B]/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              {newCatType === 'expense' ? (
                <select
                  aria-label="Default allocation bucket"
                  value={newCatBucket}
                  onChange={(e) =>
                    setNewCatBucket(e.target.value as ExpenseBucket)
                  }
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#142A3B]/15 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                >
                  <option value="Needs">Needs</option>
                  <option value="Wants">Wants</option>
                  <option value="Savings & Debt">Savings & Debt</option>
                </select>
              ) : (
                <span className="text-xs text-[#627384]">
                  Used for income deposits
                </span>
              )}
              <Button type="submit" variant="secondary" size="sm">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Category</span>
              </Button>
            </div>
          </form>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {workspace.categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl border border-[#142A3B]/8 bg-white text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[#142A3B] truncate">
                    {cat.name}
                  </p>
                  <p className="text-xs text-[#627384]">
                    {cat.type === 'income' ? 'Income' : 'Expense'}
                    {cat.bucket ? ` · ${cat.bucket}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={workspace.categories.length <= 2}
                  onClick={() => deleteCategory(cat.id)}
                  aria-label={`Delete category ${cat.name}`}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#627384] hover:text-[#B42318] hover:bg-[#B42318]/8 disabled:opacity-30 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </ModalSheet>
    </div>
  );
}
