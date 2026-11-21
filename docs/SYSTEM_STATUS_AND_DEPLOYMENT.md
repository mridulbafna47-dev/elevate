# Elevate — System Status, Boundaries & Deployment Guide

## 1. Connected & Enforced Features

The following capabilities run against live backend endpoints in `server.ts` with server-side validation, access control, persistence, backups, and structured logging:

- **Account Authentication & Token Revocation**
  - `POST /api/auth/register`: Validates display name, normalized email, and 8–128 character password; stores per-user salted `scrypt` password hashes (`crypto.scryptSync`) and assigns least-privilege `member` role.
  - `POST /api/auth/login`: Sliding-window rate-limited (`429` after threshold) with constant-time password verification (`crypto.timingSafeEqual`).
  - `POST /api/auth/google`: Cryptographically verifies Firebase Google Sign-In RS256 ID tokens against Google's public x509 certificates, provisions or loads the member's server account, and issues a revocable Elevate session token.
  - `GET /api/auth/me`, `PATCH /api/auth/profile`, `POST /api/auth/change-password`, `POST /api/auth/logout`: Password updates and sign-out increment `tokenVersion`, immediately invalidating prior HMAC-SHA256 Bearer tokens (`401` on subsequent use).
  - Client sessions hold both the Elevate Bearer token and Gmail OAuth access token strictly in React memory (never persisted in `localStorage` or `sessionStorage`).
- **3-Step Guided Onboarding & Read-Only Gmail EMI/Expense Sync**
  - **Step 1 (Profile Questions)**: Persists user-entered age, insurance status & categories, active SIP count/contribution, and starting bank balance (`workspace.onboarding`) while seeding only explicit user-entered cash/SIP baseline records.
  - **Step 2 (Read-Only Gmail Integration)**: Uses client-side Google OAuth (`https://www.googleapis.com/auth/gmail.readonly`) to read financial alert messages and submits sanitized excerpts to authenticated `POST /api/gmail/analyze` (using Gemini when `GEMINI_API_KEY` is set or deterministic fallback otherwise) to classify `emi_due`, `emi_paid`, `sip_debit`, and `expense` items. Detected items require explicit user confirmation before importing into Elevate Flow.
  - **Step 3 (Integrated Dashboard Journey)**: Summarizes Step 1 baseline profile, Step 2 Gmail EMI/expense status, and tailored next actions across Flow, Wealth, Secure, and Guide.
- **Authenticated Workspace Persistence (`Flow`, `Guide`, `Wealth`, `Secure`)**
  - `GET /api/workspace`, `PUT /api/workspace`, `DELETE /api/workspace`: Scoped strictly to verified `req.userId`, written atomically under path-confined per-user files (`.elevate-data/workspaces/<userId>.json`), validated with `validateAndSanitizeWorkspace()`, and checked against plan limits (`maxBudgets`, `maxGoals`).
- **Server-Side Entitlements & Plan Lifecycle**
  - `GET /api/plans`, `GET /api/entitlements`, `POST /api/entitlements/change-plan`, `POST /api/entitlements/cancel`, `POST /api/reports/export`.
  - Basic (`maxBudgets: 4`, `maxGoals: 3`, `aiMonthlyQuota: 5`, no Pro exports/scenarios) and Pro (`aiMonthlyQuota: 50`, exports, scenarios, forecasting, unlimited budgets/goals) are enforced on the server before mutations or AI/export execution.
- **Automated & Manual Backups + Restore**
  - `GET /api/backups`, `POST /api/backups`, `POST /api/backups/:backupId/restore`, `GET /api/backups/:backupId/download`.
  - Creates throttled rolling `auto` checkpoints (15-minute interval when records exist), automatic `pre_reset` snapshots before `DELETE /api/workspace`, automatic `pre_restore` snapshots before restoring a checkpoint, and user-initiated `manual` snapshots. All backup IDs and paths are strictly validated and isolated per `userId`.
- **Structured Security & Activity Audit Logging**
  - Writes JSON-lines records to `.elevate-data/audit.log` (automatically rotated above 4 MB) with Bearer token and secret redaction. Users can inspect their own recent events via `GET /api/audit-logs`.
- **Server-Side AI Coaching Proxy (Elevate Guide)**
  - `POST /api/guide/ask` and `POST /api/guide/monthly-review` keep `GEMINI_API_KEY` strictly on the server, enforce monthly question quotas per authenticated user, strip unauthorized data scopes, and return structured non-advisory coaching payloads.

---

## 2. Simulated, Preview-Only, or Not-Yet-Connected Features

Elevate deliberately avoids fabricating external financial data and clearly surfaces every preview/manual boundary:

1. **Subscription Billing (`₹99/month` Basic & `₹199/month` Pro)**
   - **Status**: **Preview mode — no live payment processor is connected.**
   - Changing plans, scheduling period-end downgrades, or canceling/reactivating updates server-side entitlements immediately for evaluation without collecting cards or charging money.
   - To enable live billing later, integrate a payment provider webhook (e.g., Razorpay or Stripe) and restrict `POST /api/entitlements/change-plan` to verified webhook/checkout events.
2. **Bank Account Connections & Live Transaction Feeds**
   - **Status**: **Not connected (manual-first by design).**
   - Balances, accounts, transactions, category budgets, and recurring bills are user-entered or imported via JSON backup.
3. **Live Market Quotes & Portfolio Pricing**
   - **Status**: **Not connected (statement-confirmed manual entry).**
   - Holding units, cost basis, current values, and net worth snapshots reflect only user-entered numbers.
4. **Insurance Carrier Verification & External Alerts**
   - **Status**: **Not connected.**
   - Policy records and protection checklists are user-maintained registers; renewal reminders render inside Dashboard, Reports, and Elevate Secure without external email/SMS delivery.
5. **Runtime Environment Without `GEMINI_API_KEY`**
   - Live AI Q&A and AI Monthly Reviews require `GEMINI_API_KEY` on the server and return a clear `503` setup message if omitted. Deterministic calculators (emergency runway, 50/30/20 bucket mix, goal projections, cash-flow forecasts) operate without AI.

---

## 3. Pre-Deployment Checklist & Production Runbook

### Environment Variables

Configure the following secrets in your production runtime (never commit secrets or `.elevate-data/` to source control):

- `PORT` — HTTP port (`3000` default).
- `NODE_ENV=production` — Serves the compiled static bundle from `dist/` instead of Vite dev middleware.
- `ELEVATE_AUTH_SECRET` — Strong random secret (at least 32 characters) used to sign and verify HMAC session tokens across server restarts. If unset, the server generates an ephemeral random secret at startup (which invalidates tokens on restart).
- `GEMINI_API_KEY` — Required for live Elevate Guide AI Q&A and Monthly Reviews.

### Storage & Volume Persistence

- Server state is stored atomically on local disk under `.elevate-data/` (`users.json`, `entitlements.json`, `workspaces/`, `backups/`, `audit.log`).
- Deploy on a single Node.js instance with a persistent volume mounted for `.elevate-data/` (or mount a persistent directory and symlink/configure working directory storage). Multi-replica horizontal scaling would require migrating disk JSON stores to a shared database.

### Verification, Build & Startup Commands

Run the verification sequence in order before starting production:

```bash
npm install
npm test
npm run lint
npm run build
NODE_ENV=production npm start
```
