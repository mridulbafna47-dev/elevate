import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Landmark,
  Plus,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  AccountType,
  ExpenseBucket,
  ManualAccount,
  TransactionType,
} from '../../types/finance';
import { useElevate } from '../../context/ElevateContext';
import {
  downloadCSV,
  formatCurrency,
  formatDateShort,
  getMonthKey,
  getTodayISO,
} from '../../utils/format';
import { Card, CardHeader } from '../ui/Card';
import { StatMetric } from '../ui/StatMetric';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ModalSheet } from '../ui/ModalSheet';
import { CashFlowBarChart, MonthlyFlowDatum } from '../charts/CashFlowBarChart';
import {
  AllocationDonutChart,
  ELEVATE_CHART_PALETTE,
} from '../charts/AllocationDonutChart';

const DEFAULT_CATEGORIES = [
  'Housing & Utilities',
  'Groceries & Dining',
  'Transport & Transit',
  'Healthcare & Insurance',
  'Personal & Leisure',
  'Goal Contributions',
  'Salary',
  'Freelance / Other Income',
];

export function FlowPillar() {
  const {
    workspace,
    totalCashAssets,
    totalShortTermLiabilities,
    netCashBalance,
    currentMonthKey,
    monthlyIncome,
    monthlyExpenses,
    monthlyNetFlow,
    addAccount,
    updateAccount,
    deleteAccount,
    addTransaction,
    deleteTransaction,
    upsertBudget,
    deleteBudget,
  } = useElevate();

  const currency = workspace.currency;

  // Ledger filters
  const [txFilter, setTxFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ManualAccount | null>(null);

  // Transaction form
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [txDate, setTxDate] = useState(getTodayISO());
  const [txDesc, setTxDesc] = useState('');
  const [txCategory, setTxCategory] = useState('Groceries & Dining');
  const [txBucket, setTxBucket] = useState<ExpenseBucket>('Needs');
  const [txAmount, setTxAmount] = useState('');
  const [txAccountId, setTxAccountId] = useState('');

  // Account form
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('Checking');
  const [accBalance, setAccBalance] = useState('');

  // Budget form
  const [budCategory, setBudCategory] = useState('Housing & Utilities');
  const [budLimit, setBudLimit] = useState('');
  const [budBucket, setBudBucket] = useState<ExpenseBucket>('Needs');

  const openNewAccount = () => {
    setEditingAccount(null);
    setAccName('');
    setAccType('Checking');
    setAccBalance('');
    setAccountModalOpen(true);
  };

  const openEditAccount = (acc: ManualAccount) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccType(acc.type);
    setAccBalance(String(acc.balance));
    setAccountModalOpen(true);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = parseFloat(accBalance);
    if (!accName.trim() || !Number.isFinite(numeric)) return;

    if (editingAccount) {
      updateAccount(editingAccount.id, {
        name: accName.trim(),
        type: accType,
        balance: Math.max(0, numeric),
      });
    } else {
      addAccount({
        name: accName.trim(),
        institutionLabel: 'Manual Ledger',
        type: accType,
        balance: Math.max(0, numeric),
      });
    }
    setAccountModalOpen(false);
  };

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = parseFloat(txAmount);
    if (!txDesc.trim() || !Number.isFinite(numeric) || numeric <= 0) return;

    addTransaction({
      date: txDate || getTodayISO(),
      description: txDesc.trim(),
      category: txCategory.trim() || 'General',
      type: txType,
      bucket: txType === 'expense' ? txBucket : undefined,
      amount: numeric,
      accountId: txAccountId || undefined,
    });
    setTxDesc('');
    setTxAmount('');
    setTxModalOpen(false);
  };

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = parseFloat(budLimit);
    if (!budCategory.trim() || !Number.isFinite(numeric) || numeric <= 0) return;
    upsertBudget({
      category: budCategory.trim(),
      monthlyLimit: numeric,
      bucket: budBucket,
    });
    setBudLimit('');
    setBudgetModalOpen(false);
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

  // Expense breakdown for current month
  const expenseSlices = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const tx of workspace.transactions) {
      if (tx.type === 'expense' && getMonthKey(tx.date) === currentMonthKey) {
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
  }, [workspace.transactions, currentMonthKey]);

  // Budget spending map for current month
  const currentMonthSpendByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const tx of workspace.transactions) {
      if (tx.type === 'expense' && getMonthKey(tx.date) === currentMonthKey) {
        const key = tx.category.toLowerCase();
        m.set(key, (m.get(key) ?? 0) + tx.amount);
      }
    }
    return m;
  }, [workspace.transactions, currentMonthKey]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...workspace.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((tx) => {
        if (txFilter !== 'all' && tx.type !== txFilter) return false;
        if (
          q &&
          !tx.description.toLowerCase().includes(q) &&
          !tx.category.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      });
  }, [workspace.transactions, txFilter, searchQuery]);

  const handleExportCSV = () => {
    downloadCSV(
      `elevate-flow-ledger-${getTodayISO()}.csv`,
      ['Date', 'Description', 'Category', 'Type', 'Bucket', 'Amount'],
      filteredTransactions.map((t) => [
        t.date,
        t.description,
        t.category,
        t.type,
        t.bucket ?? '',
        t.type === 'expense' ? -t.amount : t.amount,
      ])
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#1E8A78]">
            Elevate Flow · Personal Finance Manager
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
            Cash flow, budgets & accounts
          </h1>
          <p className="mt-1.5 text-sm text-[#425466]">
            Manual ledger control — track real inflows, outflows, and spending limits without external bank links.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button variant="outline" onClick={openNewAccount}>
            <Landmark className="w-4 h-4" />
            <span>Add Account</span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setTxType('expense');
              setTxCategory('Groceries & Dining');
              setTxModalOpen(true);
            }}
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
              value={formatCurrency(netCashBalance, currency)}
              detail={`${formatCurrency(totalCashAssets, currency)} cash · ${formatCurrency(totalShortTermLiabilities, currency)} card balance`}
            />
          </div>
          <div className="pt-5 sm:pt-0 sm:px-4">
            <StatMetric
              label="This Month Income"
              value={formatCurrency(monthlyIncome, currency)}
              tone="teal"
              detail={`Period: ${currentMonthKey}`}
            />
          </div>
          <div className="pt-5 lg:pt-0 lg:px-4">
            <StatMetric
              label="This Month Expenses"
              value={formatCurrency(monthlyExpenses, currency)}
              detail={`Period: ${currentMonthKey}`}
            />
          </div>
          <div className="pt-5 lg:pt-0 lg:pl-4">
            <StatMetric
              label="Monthly Net Surplus"
              value={formatCurrency(monthlyNetFlow, currency)}
              tone={
                monthlyNetFlow > 0
                  ? 'teal'
                  : monthlyNetFlow < 0
                    ? 'negative'
                    : 'default'
              }
              detail={monthlyNetFlow >= 0 ? 'Positive cash accumulation' : 'Outflows exceed inflows'}
            />
          </div>
        </div>
      </Card>

      {/* Accounts + Budgets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Manual Accounts */}
        <Card className="lg:col-span-5">
          <CardHeader
            title="Manual Accounts"
            subtitle="Balances updated directly by you"
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
                  <button
                    type="button"
                    onClick={() => openEditAccount(acc)}
                    className="min-w-0 text-left flex-1 py-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78] rounded-md"
                  >
                    <p className="text-sm font-medium text-[#142A3B] truncate">
                      {acc.name}
                    </p>
                    <p className="text-xs text-[#627384]">
                      {acc.type} · Updated {formatDateShort(acc.updatedAt)}
                    </p>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-sm font-mono tabular-nums font-semibold ${
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
                      onClick={() => deleteAccount(acc.id)}
                      aria-label={`Remove ${acc.name}`}
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

        {/* Monthly Category Budgets */}
        <Card className="lg:col-span-7">
          <CardHeader
            title="Monthly Category Budgets"
            subtitle={`Pacing for ${currentMonthKey}`}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBudgetModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                <span>Set Limit</span>
              </Button>
            }
          />
          {workspace.budgets.length > 0 ? (
            <div className="space-y-4">
              {workspace.budgets.map((b) => {
                const spent =
                  currentMonthSpendByCat.get(b.category.toLowerCase()) ?? 0;
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
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono tabular-nums text-[#425466]">
                          <strong className="text-[#142A3B]">
                            {formatCurrency(spent, currency)}
                          </strong>{' '}
                          / {formatCurrency(b.monthlyLimit, currency)}
                        </span>
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
              onAction={() => setBudgetModalOpen(true)}
            />
          )}
        </Card>
      </div>

      {/* Charts */}
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
              onAction={() => setTxModalOpen(true)}
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="This Month Expense Mix"
            subtitle={`Spending breakdown for ${currentMonthKey}`}
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
              title="No expenses this month"
              description="Logged expenses for the current month will break down automatically by category."
              actionLabel="Log Expense"
              onAction={() => {
                setTxType('expense');
                setTxModalOpen(true);
              }}
            />
          )}
        </Card>
      </div>

      {/* Transaction Ledger */}
      <Card>
        <CardHeader
          title="Transaction Ledger"
          subtitle="Searchable record of your manual inflows and outflows"
          action={
            filteredTransactions.length > 0 ? (
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </Button>
            ) : undefined
          }
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <SegmentedControl
            ariaLabel="Filter ledger by transaction type"
            value={txFilter}
            onChange={setTxFilter}
            options={[
              { value: 'all', label: 'All Entries' },
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expenses' },
            ]}
          />

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#627384] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description or category..."
              aria-label="Search transactions"
              className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm rounded-xl border border-[#142A3B]/15 bg-[#F7F9FA] text-[#142A3B] placeholder:text-[#627384] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
            />
          </div>
        </div>

        {filteredTransactions.length > 0 ? (
          <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
            <table className="w-full text-left border-collapse min-w-[540px]">
              <thead>
                <tr className="border-b border-[#142A3B]/10 text-xs font-medium text-[#627384]">
                  <th className="py-2.5 pr-4">Date</th>
                  <th className="py-2.5 pr-4">Description</th>
                  <th className="py-2.5 pr-4">Category</th>
                  <th className="py-2.5 pr-4 text-right">Amount</th>
                  <th className="py-2.5 w-10 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#142A3B]/8 text-sm">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#F7F9FA]/70 transition-colors">
                    <td className="py-3 pr-4 text-xs font-mono tabular-nums text-[#425466] whitespace-nowrap">
                      {formatDateShort(tx.date)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-[#142A3B]">
                      {tx.description}
                    </td>
                    <td className="py-3 pr-4 text-xs text-[#425466]">
                      {tx.category}
                      {tx.bucket ? ` · ${tx.bucket}` : ''}
                    </td>
                    <td
                      className={`py-3 pr-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                        tx.type === 'income' ? 'text-[#1E8A78]' : 'text-[#142A3B]'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatCurrency(tx.amount, currency)}
                    </td>
                    <td className="py-3 text-right">
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
                : 'No entries match your active search or filter.'
            }
            actionLabel="Log Entry"
            onAction={() => setTxModalOpen(true)}
          />
        )}
      </Card>

      {/* Log Transaction Modal */}
      <ModalSheet
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        title="Log Cash Flow Entry"
        subtitle="Record an income deposit or expense manually."
      >
        <form onSubmit={handleSaveTransaction} className="space-y-4">
          <div className="flex justify-start">
            <SegmentedControl
              ariaLabel="Entry type"
              value={txType}
              onChange={(v) => {
                setTxType(v);
                setTxCategory(v === 'income' ? 'Salary' : 'Groceries & Dining');
              }}
              options={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Amount ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Date
              </label>
              <input
                type="date"
                required
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
              Description
            </label>
            <input
              type="text"
              required
              value={txDesc}
              onChange={(e) => setTxDesc(e.target.value)}
              placeholder={
                txType === 'income'
                  ? 'e.g., Monthly paycheck'
                  : 'e.g., Weekly groceries'
              }
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Category
              </label>
              <input
                type="text"
                list="elevate-categories"
                required
                value={txCategory}
                onChange={(e) => setTxCategory(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
              <datalist id="elevate-categories">
                {DEFAULT_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {txType === 'expense' && (
              <div>
                <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                  Guide Allocation Bucket
                </label>
                <select
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
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Associated Account (Optional)
              </label>
              <select
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

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setTxModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary">
              Save Entry
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
        <form onSubmit={handleSaveAccount} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
              Account Label
            </label>
            <input
              type="text"
              required
              value={accName}
              onChange={(e) => setAccName(e.target.value)}
              placeholder="e.g., Primary Checking"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Account Type
              </label>
              <select
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
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Current Balance ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={accBalance}
                onChange={(e) => setAccBalance(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
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
        title="Set Monthly Category Budget"
        subtitle="Define a target spending limit for a category."
      >
        <form onSubmit={handleSaveBudget} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
              Category Name
            </label>
            <input
              type="text"
              list="elevate-categories"
              required
              value={budCategory}
              onChange={(e) => setBudCategory(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                Monthly Limit ({currency})
              </label>
              <input
                type="number"
                step="1"
                min="1"
                required
                value={budLimit}
                onChange={(e) => setBudLimit(e.target.value)}
                placeholder="500"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#142A3B] mb-1.5">
                50/30/20 Bucket
              </label>
              <select
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
              Save Budget
            </Button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
}
