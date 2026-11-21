import { BillCadence, InsurancePolicy, PremiumCadence } from '../types/finance';

export function formatCurrency(amount: number, currency = 'USD'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `$${safe.toFixed(2)}`;
  }
}

export function formatCompactCurrency(amount: number, currency = 'USD'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: Math.abs(safe) >= 10000 ? 'compact' : 'standard',
      maximumFractionDigits: Math.abs(safe) >= 10000 ? 1 : 0,
    }).format(safe);
  } catch {
    return `$${Math.round(safe).toLocaleString('en-US')}`;
  }
}

export function formatPercent(value: number, includeSign = false): string {
  if (!Number.isFinite(value)) return '0.0%';
  const prefix = includeSign && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

export function formatDateShort(isoDate: string): string {
  if (!isoDate) return '—';
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function formatMonthLong(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getMonthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const date = new Date(y, m - 1 + deltaMonths, 1);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

export function isValidISODate(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === isoDate;
}

export function daysUntil(isoDate: string): number | null {
  if (!isoDate) return null;
  const target = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function annualizePremium(amount: number, cadence: PremiumCadence): number {
  if (!Number.isFinite(amount)) return 0;
  switch (cadence) {
    case 'Monthly':
      return amount * 12;
    case 'Quarterly':
      return amount * 4;
    case 'Annual':
      return amount;
  }
}

export function monthlyEquivalentPremium(policy: InsurancePolicy): number {
  return annualizePremium(policy.premiumAmount, policy.premiumCadence) / 12;
}

export function monthlyEquivalentBill(amount: number, cadence: BillCadence): number {
  if (!Number.isFinite(amount)) return 0;
  switch (cadence) {
    case 'Weekly':
      return (amount * 52) / 12;
    case 'Biweekly':
      return (amount * 26) / 12;
    case 'Monthly':
      return amount;
    case 'Quarterly':
      return amount / 3;
    case 'Annual':
      return amount / 12;
  }
}

export function advanceDueDate(isoDate: string, cadence: BillCadence): string {
  const base = isValidISODate(isoDate)
    ? new Date(`${isoDate}T00:00:00`)
    : new Date();
  switch (cadence) {
    case 'Weekly':
      base.setDate(base.getDate() + 7);
      break;
    case 'Biweekly':
      base.setDate(base.getDate() + 14);
      break;
    case 'Monthly':
      base.setMonth(base.getMonth() + 1);
      break;
    case 'Quarterly':
      base.setMonth(base.getMonth() + 3);
      break;
    case 'Annual':
      base.setFullYear(base.getFullYear() + 1);
      break;
  }
  return base.toISOString().slice(0, 10);
}

export function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csv = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
