import { ElevateWorkspace } from '../types/finance';

export const EMPTY_WORKSPACE: ElevateWorkspace = {
  currency: 'USD',
  isSampleTemplate: false,
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

/**
 * Fictional planning template provided strictly as an optional user-triggered
 * walkthrough of Elevate's charts and cross-pillar connections.
 * Never loaded automatically without explicit user action.
 */
export function buildSampleTemplate(): ElevateWorkspace {
  const now = new Date();
  const ym = (offsetMonths: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };
  const futureDate = (daysAhead: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().slice(0, 10);
  };
  const today = now.toISOString().slice(0, 10);

  return {
    currency: 'USD',
    isSampleTemplate: true,
    accounts: [
      {
        id: 'acc_sample_1',
        name: 'Household Checking (Sample)',
        institutionLabel: 'Manual Ledger',
        type: 'Checking',
        balance: 4850,
        updatedAt: today,
      },
      {
        id: 'acc_sample_2',
        name: 'Emergency Reserve (Sample)',
        institutionLabel: 'Manual Ledger',
        type: 'Cash Reserve',
        balance: 18500,
        updatedAt: today,
      },
      {
        id: 'acc_sample_3',
        name: 'Monthly Card Balance (Sample)',
        institutionLabel: 'Manual Ledger',
        type: 'Credit Card',
        balance: 640,
        updatedAt: today,
      },
    ],
    budgets: [
      { id: 'bud_1', category: 'Housing & Utilities', monthlyLimit: 2100, bucket: 'Needs' },
      { id: 'bud_2', category: 'Groceries & Dining', monthlyLimit: 850, bucket: 'Needs' },
      { id: 'bud_3', category: 'Transport & Transit', monthlyLimit: 320, bucket: 'Needs' },
      { id: 'bud_4', category: 'Personal & Leisure', monthlyLimit: 450, bucket: 'Wants' },
      { id: 'bud_5', category: 'Goal Contributions', monthlyLimit: 1200, bucket: 'Savings & Debt' },
    ],
    transactions: [
      { id: 'tx_1', date: `${ym(-2)}-01`, description: 'Primary Salary Deposit (Sample)', category: 'Salary', type: 'income', amount: 5800, accountId: 'acc_sample_1' },
      { id: 'tx_2', date: `${ym(-2)}-03`, description: 'Monthly Rent & Utilities', category: 'Housing & Utilities', type: 'expense', bucket: 'Needs', amount: 2050, accountId: 'acc_sample_1' },
      { id: 'tx_3', date: `${ym(-2)}-12`, description: 'Supermarket & Pantry', category: 'Groceries & Dining', type: 'expense', bucket: 'Needs', amount: 720, accountId: 'acc_sample_1' },
      { id: 'tx_4', date: `${ym(-2)}-18`, description: 'Commute & Fuel', category: 'Transport & Transit', type: 'expense', bucket: 'Needs', amount: 260, accountId: 'acc_sample_1' },
      { id: 'tx_5', date: `${ym(-2)}-24`, description: 'Reserve Transfer', category: 'Goal Contributions', type: 'expense', bucket: 'Savings & Debt', amount: 1100, accountId: 'acc_sample_2' },

      { id: 'tx_6', date: `${ym(-1)}-01`, description: 'Primary Salary Deposit (Sample)', category: 'Salary', type: 'income', amount: 5800, accountId: 'acc_sample_1' },
      { id: 'tx_7', date: `${ym(-1)}-03`, description: 'Monthly Rent & Utilities', category: 'Housing & Utilities', type: 'expense', bucket: 'Needs', amount: 2080, accountId: 'acc_sample_1' },
      { id: 'tx_8', date: `${ym(-1)}-11`, description: 'Weekly Groceries', category: 'Groceries & Dining', type: 'expense', bucket: 'Needs', amount: 790, accountId: 'acc_sample_1' },
      { id: 'tx_9', date: `${ym(-1)}-16`, description: 'Books & Weekend Outing', category: 'Personal & Leisure', type: 'expense', bucket: 'Wants', amount: 340, accountId: 'acc_sample_3' },
      { id: 'tx_10', date: `${ym(-1)}-25`, description: 'Index Contribution', category: 'Goal Contributions', type: 'expense', bucket: 'Savings & Debt', amount: 1200, accountId: 'acc_sample_2' },

      { id: 'tx_11', date: `${ym(0)}-01`, description: 'Primary Salary Deposit (Sample)', category: 'Salary', type: 'income', amount: 5800, accountId: 'acc_sample_1' },
      { id: 'tx_12', date: `${ym(0)}-03`, description: 'Monthly Rent & Utilities', category: 'Housing & Utilities', type: 'expense', bucket: 'Needs', amount: 2050, accountId: 'acc_sample_1' },
      { id: 'tx_13', date: `${ym(0)}-08`, description: 'Neighborhood Market', category: 'Groceries & Dining', type: 'expense', bucket: 'Needs', amount: 540, accountId: 'acc_sample_1' },
      { id: 'tx_14', date: `${ym(0)}-11`, description: 'Transit Pass', category: 'Transport & Transit', type: 'expense', bucket: 'Needs', amount: 195, accountId: 'acc_sample_1' },
      { id: 'tx_15', date: `${ym(0)}-14`, description: 'Dining & Cultural Events', category: 'Personal & Leisure', type: 'expense', bucket: 'Wants', amount: 280, accountId: 'acc_sample_3' },
      { id: 'tx_16', date: `${ym(0)}-15`, description: 'Emergency Reserve Top-Up', category: 'Goal Contributions', type: 'expense', bucket: 'Savings & Debt', amount: 1000, accountId: 'acc_sample_2' },
    ],
    holdings: [
      {
        id: 'hold_1',
        name: 'Broad Market Equity Index (Sample)',
        symbol: 'INDEX-EQ',
        assetClass: 'Equities & Index Funds',
        accountLabel: 'Taxable Brokerage',
        units: 120,
        costBasis: 31200,
        currentValue: 36400,
        valuedAt: today,
        notes: 'Fictional sample entry — replace with your own statement figures.',
      },
      {
        id: 'hold_2',
        name: 'Intermediate Bond Fund (Sample)',
        symbol: 'BOND-CORE',
        assetClass: 'Fixed Income & Bonds',
        accountLabel: 'Retirement Account',
        units: 210,
        costBasis: 14500,
        currentValue: 15100,
        valuedAt: today,
      },
      {
        id: 'hold_3',
        name: 'Short-Term Treasury Bills (Sample)',
        symbol: 'TBILL',
        assetClass: 'Cash & Treasury',
        accountLabel: 'Treasury Reserve',
        units: 80,
        costBasis: 7900,
        currentValue: 8050,
        valuedAt: today,
      },
    ],
    snapshots: [
      { id: 'snap_1', date: `${ym(-3)}-28`, totalInvestedValue: 53400, totalCashValue: 20100, note: 'Quarterly check-in (Sample)' },
      { id: 'snap_2', date: `${ym(-2)}-28`, totalInvestedValue: 55200, totalCashValue: 21200, note: 'Monthly check-in (Sample)' },
      { id: 'snap_3', date: `${ym(-1)}-28`, totalInvestedValue: 57600, totalCashValue: 22100, note: 'Monthly check-in (Sample)' },
      { id: 'snap_4', date: today, totalInvestedValue: 59550, totalCashValue: 22710, note: 'Current template snapshot' },
    ],
    policies: [
      {
        id: 'pol_1',
        policyName: 'Comprehensive Health Plan (Sample)',
        provider: 'Regional Health Carrier',
        category: 'Health',
        policyReference: 'SAMPLE-HLT-01',
        coverageLimit: 1000000,
        deductible: 2500,
        premiumAmount: 380,
        premiumCadence: 'Monthly',
        renewalDate: futureDate(110),
        beneficiaryOrInsured: 'Primary Household',
      },
      {
        id: 'pol_2',
        policyName: '20-Year Term Life Policy (Sample)',
        provider: 'Mutual Life Assurance',
        category: 'Life',
        policyReference: 'SAMPLE-LIF-02',
        coverageLimit: 500000,
        deductible: 0,
        premiumAmount: 420,
        premiumCadence: 'Annual',
        renewalDate: futureDate(28),
        beneficiaryOrInsured: 'Designated Beneficiary',
      },
      {
        id: 'pol_3',
        policyName: 'Renters & Personal Property (Sample)',
        provider: 'Coastal Mutual',
        category: 'Home & Renters',
        policyReference: 'SAMPLE-REN-03',
        coverageLimit: 75000,
        deductible: 1000,
        premiumAmount: 240,
        premiumCadence: 'Annual',
        renewalDate: futureDate(195),
        beneficiaryOrInsured: 'Primary Residence',
      },
    ],
    goals: [
      {
        id: 'goal_1',
        title: '6-Month Emergency Reserve',
        targetAmount: 24000,
        currentSaved: 18500,
        monthlyContribution: 900,
        targetDate: futureDate(210),
      },
      {
        id: 'goal_2',
        title: 'Home Down Payment Fund',
        targetAmount: 45000,
        currentSaved: 14200,
        monthlyContribution: 1100,
        targetDate: futureDate(840),
      },
    ],
    guideSettings: {
      emergencyTargetMonths: 6,
      customMonthlyEssentialBaseline: null,
      completedActionIds: [],
    },
  };
}
