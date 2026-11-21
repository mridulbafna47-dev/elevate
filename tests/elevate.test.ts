import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createElevateApp, createEmptyWorkspace } from '../server.ts';
import {
  advanceDueDate,
  annualizePremium,
  daysUntil,
  isValidISODate,
  monthlyEquivalentBill,
  serializeCSV,
} from '../src/utils/format.ts';

let server: http.Server;
let baseUrl = '';
let tempDataDir = '';

async function api(
  route: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
    rawBody?: string;
  } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const res = await fetch(`${baseUrl}${route}`, {
    method: options.method ?? 'GET',
    headers,
    body:
      options.rawBody !== undefined
        ? options.rawBody
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

before(async () => {
  tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'elevate-test-'));
  const app = await createElevateApp({
    dataDir: tempDataDir,
    tokenSecret: crypto.createHash('sha256').update('test-secret-key').digest(),
    enableVite: false,
    disableRateLimit: true,
  });
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (tempDataDir && fs.existsSync(tempDataDir)) {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
});

test('Authentication lifecycle: register, duplicate rejection, login, profile update, password change, logout revocation', async () => {
  // Weak password rejected
  const weak = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Alice', email: 'alice@example.com', password: 'short' },
  });
  assert.equal(weak.status, 400);

  // Register Alice
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Alice Morgan',
      email: 'Alice@Example.com',
      password: 'Password123!',
    },
  });
  assert.equal(reg.status, 201);
  assert.ok(typeof reg.json?.token === 'string');
  assert.equal((reg.json?.user as Record<string, unknown>)?.email, 'alice@example.com');
  assert.equal((reg.json?.user as Record<string, unknown>)?.role, 'member');

  // Duplicate email rejected
  const dup = await api('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Alice Clone',
      email: 'alice@example.com',
      password: 'Password123!',
    },
  });
  assert.equal(dup.status, 409);

  // Wrong password rejected
  const badLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'alice@example.com', password: 'WrongPassword!' },
  });
  assert.equal(badLogin.status, 401);

  // Valid login succeeds
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'alice@example.com', password: 'Password123!' },
  });
  assert.equal(login.status, 200);
  const oldToken = String(login.json?.token);

  // Unauthenticated & tampered tokens fail 401
  const noAuth = await api('/api/workspace');
  assert.equal(noAuth.status, 401);

  const tampered = await api('/api/workspace', {
    token: `${oldToken.slice(0, -4)}XXXX`,
  });
  assert.equal(tampered.status, 401);

  // Profile update persists
  const patch = await api('/api/auth/profile', {
    method: 'PATCH',
    token: oldToken,
    body: { name: 'Alice M.' },
  });
  assert.equal(patch.status, 200);
  assert.equal((patch.json?.user as Record<string, unknown>)?.name, 'Alice M.');

  // Password change revokes old token and issues working fresh token
  const pwRes = await api('/api/auth/change-password', {
    method: 'POST',
    token: oldToken,
    body: { currentPassword: 'Password123!', newPassword: 'NewPassword456!' },
  });
  assert.equal(pwRes.status, 200);
  const freshToken = String(pwRes.json?.token);
  assert.notEqual(freshToken, oldToken);

  const oldAfterPw = await api('/api/auth/me', { token: oldToken });
  assert.equal(oldAfterPw.status, 401);

  const freshMe = await api('/api/auth/me', { token: freshToken });
  assert.equal(freshMe.status, 200);

  // Logout immediately revokes active token
  const logout = await api('/api/auth/logout', {
    method: 'POST',
    token: freshToken,
  });
  assert.equal(logout.status, 200);

  const afterLogout = await api('/api/workspace', { token: freshToken });
  assert.equal(afterLogout.status, 401);
});

test('Access control & isolation: users cannot access another user backups, workspace, or audit logs', async () => {
  const userA = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'User A', email: 'usera@example.com', password: 'SecretPasswordA1' },
  });
  const userB = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'User B', email: 'userb@example.com', password: 'SecretPasswordB1' },
  });
  assert.equal(userA.status, 201);
  assert.equal(userB.status, 201);

  const tokenA = String(userA.json?.token);
  const tokenB = String(userB.json?.token);

  // User A saves workspace record & creates backup
  const wsA = createEmptyWorkspace();
  wsA.accounts.push({
    id: 'acc_a1',
    name: 'User A Checking',
    institutionLabel: 'Manual Bank',
    type: 'Checking',
    balance: 2500,
    updatedAt: '2025-02-01',
  });
  const saveA = await api('/api/workspace', {
    method: 'PUT',
    token: tokenA,
    body: { workspace: wsA },
  });
  assert.equal(saveA.status, 200);

  const bkpA = await api('/api/backups', {
    method: 'POST',
    token: tokenA,
    body: { note: 'User A Private Backup' },
  });
  assert.equal(bkpA.status, 201);
  const backupAId = String((bkpA.json?.backup as Record<string, unknown>)?.id);

  // User B gets empty workspace, zero User A backups, and cannot restore/download User A's backup
  const getB = await api('/api/workspace', { token: tokenB });
  assert.equal(getB.status, 200);
  assert.equal(((getB.json?.workspace as Record<string, unknown>)?.accounts as unknown[]).length, 0);

  const listBackupsB = await api('/api/backups', { token: tokenB });
  assert.equal(listBackupsB.status, 200);
  assert.equal((listBackupsB.json?.backups as unknown[]).length, 0);

  const restoreCross = await api(`/api/backups/${backupAId}/restore`, {
    method: 'POST',
    token: tokenB,
  });
  assert.ok(restoreCross.status === 404 || restoreCross.status === 403);

  const downloadCross = await api(`/api/backups/${backupAId}/download`, {
    method: 'GET',
    token: tokenB,
  });
  assert.ok(downloadCross.status === 404 || downloadCross.status === 403);

  // Path traversal attempt rejected
  const traversal = await api('/api/backups/..%2F..%2Fusers/download', {
    method: 'GET',
    token: tokenB,
  });
  assert.equal(traversal.status, 404);

  // Audit logs only return User B's own events
  const logsB = await api('/api/audit-logs', { token: tokenB });
  assert.equal(logsB.status, 200);
  const details = (logsB.json?.logs as Array<{ detail: string }>).map((l) => l.detail);
  assert.ok(!details.some((d) => d.includes(backupAId)));
});

test('Server validation, quota enforcement, plan lifecycle, and backup restore', async () => {
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Plan Tester', email: 'plans@example.com', password: 'PlanPassword99!' },
  });
  assert.equal(reg.status, 201);
  const token = String(reg.json?.token);

  // Malformed JSON returns 400
  const malformed = await api('/api/workspace', {
    method: 'PUT',
    token,
    rawBody: '{"broken_json":',
  });
  assert.equal(malformed.status, 400);

  // Invalid transaction amount/date rejected with 400
  const badWs = createEmptyWorkspace();
  badWs.transactions.push({
    id: 'tx_bad',
    date: '2025-02-29', // invalid non-leap date
    description: 'Bad Tx',
    category: 'Salary',
    type: 'income',
    amount: 100,
  });
  const badSave = await api('/api/workspace', {
    method: 'PUT',
    token,
    body: { workspace: badWs },
  });
  assert.equal(badSave.status, 400);

  // Basic plan enforces max 4 budgets and max 3 goals on server
  const quotaWs = createEmptyWorkspace();
  quotaWs.budgets = [1, 2, 3, 4, 5].map((n) => ({
    id: `bud_${n}`,
    category: `Cat ${n}`,
    monthlyLimit: 100,
    bucket: 'Needs' as const,
  }));
  const basicBudgetBlocked = await api('/api/workspace', {
    method: 'PUT',
    token,
    body: { workspace: quotaWs },
  });
  assert.equal(basicBudgetBlocked.status, 403);
  assert.equal(basicBudgetBlocked.json?.code, 'PLAN_QUOTA_EXCEEDED');

  // Basic blocks report CSV export authorization
  const basicExport = await api('/api/reports/export', {
    method: 'POST',
    token,
    body: { reportType: 'reports_ledger_csv' },
  });
  assert.equal(basicExport.status, 403);

  // Upgrade to Pro unlocks unlimited budgets & report export
  const upgrade = await api('/api/entitlements/change-plan', {
    method: 'POST',
    token,
    body: { targetPlan: 'pro', timing: 'immediate' },
  });
  assert.equal(upgrade.status, 200);
  assert.equal((upgrade.json?.entitlement as Record<string, unknown>)?.plan, 'pro');

  const proBudgetAllowed = await api('/api/workspace', {
    method: 'PUT',
    token,
    body: { workspace: quotaWs },
  });
  assert.equal(proBudgetAllowed.status, 200);

  const proExportAllowed = await api('/api/reports/export', {
    method: 'POST',
    token,
    body: { reportType: 'reports_ledger_csv' },
  });
  assert.equal(proExportAllowed.status, 200);
  assert.equal(proExportAllowed.json?.authorized, true);

  // Backup + Clear Workspace (pre_reset backup) + Restore round-trip
  const manualBackup = await api('/api/backups', {
    method: 'POST',
    token,
    body: { note: 'Five budgets checkpoint' },
  });
  assert.equal(manualBackup.status, 201);
  const bkpId = String((manualBackup.json?.backup as Record<string, unknown>)?.id);

  const cleared = await api('/api/workspace', { method: 'DELETE', token });
  assert.equal(cleared.status, 200);
  assert.equal(
    ((cleared.json?.workspace as Record<string, unknown>)?.budgets as unknown[]).length,
    0
  );

  const restored = await api(`/api/backups/${bkpId}/restore`, {
    method: 'POST',
    token,
  });
  assert.equal(restored.status, 200);
  assert.equal(
    ((restored.json?.workspace as Record<string, unknown>)?.budgets as unknown[]).length,
    5
  );

  // Immediate cancellation locks Guide AI (returns 403 SUBSCRIPTION_ENDED)
  const cancelImm = await api('/api/entitlements/cancel', {
    method: 'POST',
    token,
    body: { timing: 'immediate' },
  });
  assert.equal(cancelImm.status, 200);
  assert.equal((cancelImm.json?.entitlement as Record<string, unknown>)?.status, 'ended');

  const guideEnded = await api('/api/guide/ask', {
    method: 'POST',
    token,
    body: { question: 'What is an emergency fund?' },
  });
  assert.equal(guideEnded.status, 403);
  assert.equal(guideEnded.json?.code, 'SUBSCRIPTION_ENDED');
});

test('Financial utilities: date validation, month-end clamping, recurring bills, premiums, and CSV formula sanitization', () => {
  // Date validation including leap years
  assert.equal(isValidISODate('2024-02-29'), true);
  assert.equal(isValidISODate('2025-02-29'), false);
  assert.equal(isValidISODate('2025-04-31'), false);
  assert.equal(isValidISODate('2025-03-15'), true);

  // Month-end clamping on recurring bill advancement
  assert.equal(advanceDueDate('2025-01-31', 'Monthly'), '2025-02-28');
  assert.equal(advanceDueDate('2024-01-31', 'Monthly'), '2024-02-29');
  assert.equal(advanceDueDate('2025-01-31', 'Annual'), '2026-01-31');
  assert.equal(advanceDueDate('2024-02-29', 'Annual'), '2025-02-28');

  // DST-safe daysUntil check
  assert.equal(daysUntil('2025-03-10', '2025-03-01'), 9);
  assert.equal(daysUntil('2025-03-01', '2025-03-01'), 0);

  // Bill & premium normalization
  assert.equal(annualizePremium(100, 'Monthly'), 1200);
  assert.equal(annualizePremium(300, 'Quarterly'), 1200);
  assert.equal(annualizePremium(1200, 'Annual'), 1200);
  assert.equal(Math.round(monthlyEquivalentBill(1200, 'Annual')), 100);

  // CSV formula neutralization preserves numeric negatives while prefixing formula triggers
  const csv = serializeCSV(
    ['Description', 'Amount'],
    [
      ['=HYPERLINK("http://bad")', -42.5],
      ['+CMD', 100],
      ['-cmd|test', 10],
    ]
  );
  const lines = csv.split('\n');
  assert.equal(lines[1], `"'=HYPERLINK(""http://bad"")",-42.5`);
  assert.equal(lines[2], `'+CMD,100`);
  assert.equal(lines[3], `'-cmd|test,10`);
});

test('Onboarding persistence, Gmail financial email classification, and Google Sign-In auth flow', async () => {
  // Register standard user and verify onboarding defaults + Step 1 & gmailItems sanitization
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Journey User', email: 'journey@example.com', password: 'JourneyPassword1!' },
  });
  assert.equal(reg.status, 201);
  const token = String(reg.json?.token);
  const initialOb = (reg.json?.workspace as Record<string, unknown>)?.onboarding as Record<string, unknown>;
  assert.equal(initialOb?.completed, false);
  assert.equal(initialOb?.currentStep, 1);

  // Unauthenticated /api/gmail/analyze must return 401
  const unauthGmail = await api('/api/gmail/analyze', {
    method: 'POST',
    body: { emails: [] },
  });
  assert.equal(unauthGmail.status, 401);

  // Classify realistic EMI due, EMI paid, SIP debit, and expense emails
  const analyzeRes = await api('/api/gmail/analyze', {
    method: 'POST',
    token,
    body: {
      emails: [
        {
          messageId: 'msg_emi_due_1',
          subject: 'HDFC Home Loan EMI Due Reminder',
          from: 'HDFC Bank <alerts@hdfcbank.net>',
          dateISO: '2025-03-01',
          snippet: 'Your Home Loan EMI of Rs. 32,500 is due on 2025-03-05.',
          bodyText: 'Dear Customer, please ensure balance for EMI of INR 32,500 payable by 2025-03-05.',
        },
        {
          messageId: 'msg_emi_paid_1',
          subject: 'ICICI Car Loan EMI Paid Successfully',
          from: 'ICICI Bank <alerts@icicibank.com>',
          dateISO: '2025-02-28',
          snippet: 'Auto-debit EMI payment of ₹14,200 has been debited and processed.',
          bodyText: 'Your monthly loan installment EMI of Rs. 14,200 was debited successfully.',
        },
        {
          messageId: 'msg_sip_1',
          subject: 'Mutual Fund SIP Confirmation - Nifty 50 Index',
          from: 'CAMS <donotreply@camsonline.com>',
          dateISO: '2025-02-25',
          snippet: 'Your systematic investment SIP of ₹10,000 has been processed.',
          bodyText: 'Folio 912345: SIP installment of INR 10,000 confirmed.',
        },
        {
          messageId: 'msg_exp_1',
          subject: 'Transaction Alert: Swiggy Order',
          from: 'Axis Bank <alerts@axisbank.com>',
          dateISO: '2025-02-27',
          snippet: 'Rs. 640.50 spent on your card ending 4421 at Swiggy.',
          bodyText: 'UPI / Card purchase of ₹640.50 at Swiggy.',
        },
      ],
    },
  });
  assert.equal(analyzeRes.status, 200);
  const detected = analyzeRes.json?.items as Array<Record<string, unknown>>;
  assert.equal(detected.length, 4);

  const byMsg = new Map(detected.map((d) => [String(d.messageId), d]));
  assert.equal(byMsg.get('msg_emi_due_1')?.kind, 'emi_due');
  assert.equal(byMsg.get('msg_emi_due_1')?.amount, 32500);
  assert.equal(byMsg.get('msg_emi_due_1')?.dueDate, '2025-03-05');

  assert.equal(byMsg.get('msg_emi_paid_1')?.kind, 'emi_paid');
  assert.equal(byMsg.get('msg_emi_paid_1')?.amount, 14200);

  assert.equal(byMsg.get('msg_sip_1')?.kind, 'sip_debit');
  assert.equal(byMsg.get('msg_sip_1')?.amount, 10000);

  assert.equal(byMsg.get('msg_exp_1')?.kind, 'expense');
  assert.equal(byMsg.get('msg_exp_1')?.amount, 640.5);
  assert.equal(byMsg.get('msg_exp_1')?.category, 'Groceries & Dining');

  // Persist onboarding Step 1 answers + Gmail items on workspace
  const ws = createEmptyWorkspace();
  ws.onboarding = {
    completed: true,
    currentStep: 3,
    completedStep1: true,
    age: 31,
    hasInsurance: true,
    insuranceTypes: ['Health', 'Life'],
    sipCount: 3,
    monthlySipAmount: 15000,
    startingBalance: 240000,
    gmailConnected: true,
    gmailEmail: 'journey@example.com',
  };
  ws.gmailItems = detected as typeof ws.gmailItems;

  const saved = await api('/api/workspace', {
    method: 'PUT',
    token,
    body: { workspace: ws },
  });
  assert.equal(saved.status, 200);
  const savedOb = (saved.json?.workspace as Record<string, unknown>)?.onboarding as Record<string, unknown>;
  assert.equal(savedOb?.age, 31);
  assert.equal(savedOb?.hasInsurance, true);
  assert.deepEqual(savedOb?.insuranceTypes, ['Health', 'Life']);
  assert.equal(savedOb?.sipCount, 3);
  assert.equal(savedOb?.startingBalance, 240000);
  assert.equal(savedOb?.completed, true);

  // Google Sign-In verification on isolated server instance
  const missingTokenRes = await api('/api/auth/google', {
    method: 'POST',
    body: {},
  });
  assert.equal(missingTokenRes.status, 400);

  const googleDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'elevate-google-test-'));
  let googleServer: http.Server | null = null;
  try {
    const gApp = await createElevateApp({
      dataDir: googleDataDir,
      tokenSecret: crypto.createHash('sha256').update('google-test-secret').digest(),
      enableVite: false,
      disableRateLimit: true,
      verifyGoogleIdToken: async (idToken: string) => {
        if (idToken === 'valid-mock-firebase-token') {
          return {
            sub: 'google-sub-123',
            email: 'guser@example.com',
            name: 'Google Tester',
            email_verified: true,
          };
        }
        return null;
      },
    });
    googleServer = http.createServer(gApp);
    const gUrl = await new Promise<string>((resolve) => {
      googleServer!.listen(0, '127.0.0.1', () => {
        const addr = googleServer!.address();
        resolve(`http://127.0.0.1:${addr && typeof addr === 'object' ? addr.port : 0}`);
      });
    });

    const badGoogleRes = await fetch(`${gUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'bad-token' }),
    });
    assert.equal(badGoogleRes.status, 401);

    const goodGoogleRes = await fetch(`${gUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'valid-mock-firebase-token' }),
    });
    assert.equal(goodGoogleRes.status, 200);
    const gPayload = (await goodGoogleRes.json()) as Record<string, unknown>;
    assert.ok(typeof gPayload.token === 'string');
    assert.equal((gPayload.user as Record<string, unknown>)?.authProvider, 'google');
    assert.equal(
      ((gPayload.workspace as Record<string, unknown>)?.onboarding as Record<string, unknown>)?.gmailConnected,
      true
    );
  } finally {
    if (googleServer) {
      await new Promise<void>((resolve) => googleServer!.close(() => resolve()));
    }
    if (fs.existsSync(googleDataDir)) {
      fs.rmSync(googleDataDir, { recursive: true, force: true });
    }
  }
});

