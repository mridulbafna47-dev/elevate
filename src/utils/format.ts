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
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n))) return isoDate;
  const [y, m, d] = parts;
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

export function formatMonthLong(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMonthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const date = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  const ny = date.getUTCFullYear();
  const nm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

export function isValidISODate(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const [y, m, d] = isoDate.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(parsed.getTime())) return false;
  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

export function daysUntil(isoDate: string, referenceISO = getTodayISO()): number | null {
  if (!isValidISODate(isoDate) || !isValidISODate(referenceISO)) return null;
  const [ty, tm, td] = isoDate.split('-').map(Number);
  const [ry, rm, rd] = referenceISO.split('-').map(Number);
  const targetMs = Date.UTC(ty, tm - 1, td);
  const refMs = Date.UTC(ry, rm - 1, rd);
  return Math.round((targetMs - refMs) / (1000 * 60 * 60 * 24));
}

export function annualizePremium(amount: number, cadence: PremiumCadence): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
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
  if (!Number.isFinite(amount) || amount < 0) return 0;
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

function addMonthsClampedUTC(y: number, mZeroBased: number, d: number, deltaMonths: number): string {
  const targetMonthIndex = mZeroBased + deltaMonths;
  const firstOfTarget = new Date(Date.UTC(y, targetMonthIndex, 1));
  const ty = firstOfTarget.getUTCFullYear();
  const tm = firstOfTarget.getUTCMonth();
  const daysInTargetMonth = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, daysInTargetMonth);
  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function advanceDueDate(isoDate: string, cadence: BillCadence): string {
  const safeISO = isValidISODate(isoDate) ? isoDate : getTodayISO();
  const [y, m, d] = safeISO.split('-').map(Number);

  switch (cadence) {
    case 'Weekly': {
      const dt = new Date(Date.UTC(y, m - 1, d + 7));
      return dt.toISOString().slice(0, 10);
    }
    case 'Biweekly': {
      const dt = new Date(Date.UTC(y, m - 1, d + 14));
      return dt.toISOString().slice(0, 10);
    }
    case 'Monthly':
      return addMonthsClampedUTC(y, m - 1, d, 1);
    case 'Quarterly':
      return addMonthsClampedUTC(y, m - 1, d, 3);
    case 'Annual':
      return addMonthsClampedUTC(y, m - 1, d, 12);
  }
}

export function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function sanitizeCSVCell(val: string | number): string {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : '0';
  }
  const raw = String(val ?? '');
  // Guard against spreadsheet formula injection (=, +, @, \t, \r, or non-numeric leading -)
  const isNumericNegative = /^-\d+(\.\d+)?$/.test(raw.trim());
  const needsFormulaGuard =
    /^[=+@\t\r]/.test(raw) || (/^-/.test(raw) && !isNumericNegative);
  const safe = needsFormulaGuard ? `'${raw}` : raw;
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n') || safe.includes('\r')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function serializeCSV(headers: string[], rows: (string | number)[][]): string {
  return [
    headers.map(sanitizeCSVCell).join(','),
    ...rows.map((r) => r.map(sanitizeCSVCell).join(',')),
  ].join('\n');
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const csv = serializeCSV(headers, rows);
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
