import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  Compass,
  Lock,
  Mail,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useElevate } from '../../context/ElevateContext';
import { Button } from '../ui/Button';
import { GoogleSignInButton } from '../ui/GoogleSignInButton';
import { ModalSheet } from '../ui/ModalSheet';

const HERO_IMAGE_PATH = '/src/assets/images/hero_elevate_study_1795272061392.jpg';

export function LandingPage() {
  const { register, login, loginWithGoogle } = useElevate();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const openAuthModal = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthError(null);
    setPasswordInput('');
    setConfirmPasswordInput('');
    setAuthModalOpen(true);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setAuthError(null);

    const cleanEmail = emailInput.trim();
    if (!cleanEmail) {
      setAuthError('Please enter your email address.');
      return;
    }

    if (authMode === 'register') {
      const cleanName = nameInput.trim();
      if (!cleanName) {
        setAuthError('Please enter your name or household label.');
        return;
      }
      if (passwordInput.length < 8) {
        setAuthError('Password must be at least 8 characters long.');
        return;
      }
      if (passwordInput !== confirmPasswordInput) {
        setAuthError('Passwords do not match.');
        return;
      }

      setIsSubmitting(true);
      const res = await register({
        name: cleanName,
        email: cleanEmail,
        password: passwordInput,
      });
      setIsSubmitting(false);
      if (!res.ok) {
        setAuthError(res.error || 'Could not create your account.');
        return;
      }
      setAuthModalOpen(false);
      return;
    }

    if (!passwordInput) {
      setAuthError('Please enter your password.');
      return;
    }
    setIsSubmitting(true);
    const res = await login({
      email: cleanEmail,
      password: passwordInput,
    });
    setIsSubmitting(false);
    if (!res.ok) {
      setAuthError(res.error || 'Invalid email or password.');
      return;
    }
    setAuthModalOpen(false);
  };

  const handleGoogleAuth = async () => {
    if (isSubmitting) return;
    setAuthError(null);
    setIsSubmitting(true);
    const res = await loginWithGoogle();
    setIsSubmitting(false);
    if (!res.ok) {
      setAuthError(res.error || 'Could not sign in with Google.');
      return;
    }
    setAuthModalOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FA] text-[#142A3B]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#142A3B]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element brand wordmark */}
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-tight text-[#142A3B] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A78] rounded-md"
          >
            Elevate
          </a>

          {/* Zone 2: 4 concise single-line nav links */}
          <nav
            aria-label="Landing navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#425466]"
          >
            <a
              href="#pillars"
              className="hover:text-[#142A3B] transition-colors whitespace-nowrap shrink-0 py-1"
            >
              Pillars
            </a>
            <a
              href="#dashboard-overview"
              className="hover:text-[#142A3B] transition-colors whitespace-nowrap shrink-0 py-1"
            >
              Dashboard
            </a>
            <a
              href="#privacy"
              className="hover:text-[#142A3B] transition-colors whitespace-nowrap shrink-0 py-1"
            >
              Privacy
            </a>
            <a
              href="#plans"
              className="hover:text-[#142A3B] transition-colors whitespace-nowrap shrink-0 py-1"
            >
              Plans
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <Button
              variant="primary"
              size="sm"
              onClick={() => openAuthModal('login')}
            >
              <span>Sign In</span>
            </Button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Split */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 sm:pt-14 sm:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-semibold tracking-wide text-[#1E8A78]">
                Personal Financial Well-Being
              </p>
              <h1 className="mt-3 text-4xl sm:text-5xl font-bold text-[#142A3B] tracking-tight leading-[1.1] text-wrap:balance">
                Your entire financial life, elevated.
              </h1>
              <p className="mt-5 text-base sm:text-lg text-[#425466] leading-relaxed max-w-xl">
                One calm, structured workspace connecting daily cash flow, guided savings planning, statement-confirmed investments, and insurance organization—built strictly around the numbers you enter.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => openAuthModal('register')}
                >
                  <span>Open Your Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <a
                  href="#pillars"
                  className="inline-flex items-center min-h-[48px] px-4 text-sm font-semibold text-[#142A3B] hover:text-[#1E8A78] transition-colors whitespace-nowrap"
                >
                  Explore the four pillars
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-64 sm:h-80 lg:h-full min-h-[320px] rounded-2xl overflow-hidden border border-[#142A3B]/10 bg-[#E8EEF2]">
                {!imgFailed ? (
                  <img
                    src={HERO_IMAGE_PATH}
                    alt="Minimalist oak study desk with dark navy leather ledger notebook and brass pen in morning sunlight"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#142A3B] to-[#1E8A78] text-white">
                    <Wallet className="w-10 h-10 mb-3 opacity-85" />
                    <p className="font-display text-lg font-semibold">
                      Elevate Financial Study
                    </p>
                    <p className="text-xs text-white/80 mt-1 max-w-xs">
                      Personal finance, coaching, investments, and insurance in one workspace.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Four Pillars Editorial Grid */}
        <section
          id="pillars"
          className="border-t border-[#142A3B]/10 bg-white py-14 sm:py-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-10 sm:mb-12">
              <p className="text-xs font-semibold text-[#1E8A78]">
                Four Connected Pillars
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
                Structured clarity across cash, strategy, investments, and protection
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <article className="p-6 sm:p-7 rounded-2xl border border-[#142A3B]/10 bg-[#F7F9FA]/60">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-mono font-semibold text-[#1E8A78]">
                    01. Elevate Flow
                  </span>
                  <Wallet className="w-5 h-5 text-[#1E8A78]" />
                </div>
                <h3 className="mt-3 text-lg font-semibold text-[#142A3B]">
                  Personal Finance Manager
                </h3>
                <p className="mt-2 text-sm text-[#425466] leading-relaxed">
                  Record checking, savings, and card balances alongside monthly income, categorized expenses, and spending limits—with CSV export whenever you need it.
                </p>
              </article>

              <article className="p-6 sm:p-7 rounded-2xl border border-[#142A3B]/10 bg-[#F7F9FA]/60">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-mono font-semibold text-[#946C1B]">
                    02. Elevate Guide
                  </span>
                  <Compass className="w-5 h-5 text-[#946C1B]" />
                </div>
                <h3 className="mt-3 text-lg font-semibold text-[#142A3B]">
                  Financial Coach
                </h3>
                <p className="mt-2 text-sm text-[#425466] leading-relaxed">
                  Size your emergency runway against real monthly essentials, compare spending across 50/30/20 buckets, and project timelines for your savings goals.
                </p>
              </article>

              <article className="p-6 sm:p-7 rounded-2xl border border-[#142A3B]/10 bg-[#F7F9FA]/60">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-mono font-semibold text-[#142A3B]">
                    03. Elevate Wealth
                  </span>
                  <TrendingUp className="w-5 h-5 text-[#142A3B]" />
                </div>
                <h3 className="mt-3 text-lg font-semibold text-[#142A3B]">
                  Investment Tracker
                </h3>
                <p className="mt-2 text-sm text-[#425466] leading-relaxed">
                  Log asset classes, units, cost basis, and statement-confirmed valuations. Capture dated net worth snapshots to chart your own real history.
                </p>
              </article>

              <article className="p-6 sm:p-7 rounded-2xl border border-[#142A3B]/10 bg-[#F7F9FA]/60">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-mono font-semibold text-[#1E8A78]">
                    04. Elevate Secure
                  </span>
                  <ShieldCheck className="w-5 h-5 text-[#1E8A78]" />
                </div>
                <h3 className="mt-3 text-lg font-semibold text-[#142A3B]">
                  Insurance Organiser
                </h3>
                <p className="mt-2 text-sm text-[#425466] leading-relaxed">
                  Maintain a calm register of health, life, disability, auto, and property policies with coverage limits, deductibles, and renewal reminders.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Dashboard & Reports Preview */}
        <section
          id="dashboard-overview"
          className="border-t border-[#142A3B]/10 bg-[#F7F9FA] py-14 sm:py-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5">
              <p className="text-xs font-semibold text-[#1E8A78]">
                Unified Workspace Shell
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
                One dashboard connecting every decision
              </h2>
              <p className="mt-3 text-sm sm:text-base text-[#425466] leading-relaxed">
                Inside the authenticated shell, switch effortlessly between Dashboard, Flow, Guide, Wealth, Secure, Reports, and Settings across desktop sidebar and mobile bottom navigation.
              </p>
              <div className="mt-6">
                <Button
                  variant="primary"
                  onClick={() => openAuthModal('login')}
                >
                  <span>Enter Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div
              id="reports-preview"
              className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {[
                {
                  title: 'Income & Expense Pacing',
                  desc: 'Monthly inflows, outflows, and net surplus calculated directly from your ledger.',
                },
                {
                  title: 'Budget Status & Alerts',
                  desc: 'Track category utilization with clear over-budget and near-limit indicators.',
                },
                {
                  title: 'Goals & Upcoming Renewals',
                  desc: 'Monitor target savings progress alongside policies renewing within 60 days.',
                },
                {
                  title: 'Reports & Export Control',
                  desc: 'Generate cross-pillar summaries and download CSV or JSON records anytime.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-5 rounded-2xl bg-white border border-[#142A3B]/10"
                >
                  <BarChart3 className="w-4 h-4 text-[#1E8A78] mb-2.5" />
                  <h3 className="text-sm font-semibold text-[#142A3B]">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-[#425466] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Guided 3-Step Workspace Setup Journey */}
        <section
          id="journey-preview"
          className="border-t border-[#142A3B]/10 bg-white py-14 sm:py-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-10">
              <p className="text-xs font-semibold text-[#1E8A78]">
                Guided First-Run Journey
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
                Three structured steps from sign-in to clarity
              </h2>
              <p className="mt-2 text-sm text-[#425466] leading-relaxed">
                Every new workspace opens with a clear three-step path so your dashboard reflects your real starting balance, SIPs, insurance coverage, and email-verified bills.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl border border-[#142A3B]/10 bg-[#F7F9FA]/70 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono font-semibold text-[#1E8A78]">
                    Step 01 · Profile Questions
                  </span>
                  <h3 className="mt-2.5 text-lg font-semibold text-[#142A3B]">
                    Tailor Your Baseline
                  </h3>
                  <p className="mt-2 text-sm text-[#425466] leading-relaxed">
                    Answer five quick questions—your age, existing insurance status and types, active SIP count, and starting bank balance—to establish your workspace.
                  </p>
                </div>
                <p className="mt-5 pt-4 border-t border-[#142A3B]/10 text-xs font-mono text-[#627384]">
                  Feeds Flow · Wealth · Secure
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-[#142A3B]/10 bg-[#F7F9FA]/70 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono font-semibold text-[#946C1B]">
                    Step 02 · Read-Only Gmail Sync
                  </span>
                  <h3 className="mt-2.5 text-lg font-semibold text-[#142A3B]">
                    Detect EMIs &amp; Expenses
                  </h3>
                  <p className="mt-2 text-sm text-[#425466] leading-relaxed">
                    Optionally connect Gmail (read-only) to scan for EMI due alerts, EMIs paid, SIP debits, and transaction receipts—always waiting for your approval before importing.
                  </p>
                </div>
                <p className="mt-5 pt-4 border-t border-[#142A3B]/10 text-xs font-mono text-[#627384] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#1E8A78]" />
                  <span>Review before adding to Flow</span>
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-[#1E8A78]/35 bg-white flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono font-semibold text-[#142A3B]">
                    Step 03 · Unified Dashboard
                  </span>
                  <h3 className="mt-2.5 text-lg font-semibold text-[#142A3B]">
                    Your Complete Journey View
                  </h3>
                  <p className="mt-2 text-sm text-[#425466] leading-relaxed">
                    Land on your live Dashboard showing your cash position, imported EMIs, SIP schedule, insurance reminders, and prioritized next actions across every pillar.
                  </p>
                </div>
                <p className="mt-5 pt-4 border-t border-[#142A3B]/10 text-xs font-mono text-[#1E8A78]">
                  Single source of truth
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Plans Comparison Preview */}
        <section
          id="plans"
          className="border-t border-[#142A3B]/10 bg-white py-14 sm:py-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-10">
              <p className="text-xs font-semibold text-[#1E8A78]">
                Simple Monthly Plans · Preview Mode
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-[#142A3B] tracking-tight">
                Start with Elevate Basic or unlock full insights with Pro
              </h2>
              <p className="mt-2 text-sm text-[#425466]">
                Payment provider integration is not live yet—no card is required or charged when evaluating Basic or Pro entitlements inside the app.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 sm:p-7 rounded-2xl border border-[#142A3B]/10 bg-[#F7F9FA]/70 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#142A3B]">Elevate Basic</h3>
                  <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#142A3B]">
                    ₹99<span className="text-sm font-sans font-normal text-[#627384]">/month</span>
                  </p>
                  <p className="mt-2 text-sm text-[#425466]">
                    Essential personal finance tracking across all four pillars.
                  </p>
                  <ul className="mt-5 space-y-2 text-sm text-[#142A3B]">
                    {[
                      'Core dashboard & manual Flow tracking',
                      'Basic monthly budgets (up to 4 categories)',
                      'Manual Wealth holdings & up to 3 goals',
                      'Secure policy records & renewal reminders',
                      'Limited Guide AI questions (5/month)',
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-[#1E8A78] mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => openAuthModal('register')}
                  >
                    <span>Start with Basic Preview</span>
                  </Button>
                </div>
              </div>

              <div className="p-6 sm:p-7 rounded-2xl border border-[#1E8A78]/40 bg-white flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#142A3B]">Elevate Pro</h3>
                  <p className="mt-2 text-3xl font-bold font-mono tabular-nums text-[#142A3B]">
                    ₹199<span className="text-sm font-sans font-normal text-[#627384]">/month</span>
                  </p>
                  <p className="mt-2 text-sm text-[#425466]">
                    Deeper insights, forecasting from your data, and full export tools.
                  </p>
                  <ul className="mt-5 space-y-2 text-sm text-[#142A3B]">
                    {[
                      'Advanced spending insights & cash-flow forecasting',
                      'Higher fair-use Guide AI allowance (50/month)',
                      'Scenario comparisons & richer portfolio drift analysis',
                      'Unlimited goals & unlimited category budgets',
                      'Coverage summaries & downloadable CSV reports',
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-[#1E8A78] mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => openAuthModal('register')}
                  >
                    <span>Explore Elevate Pro Preview</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy & Non-Fabrication Commitment */}
        <section
          id="privacy"
          className="border-t border-[#142A3B]/10 bg-[#F7F9FA] py-14 sm:py-16"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="w-11 h-11 rounded-xl bg-[#142A3B]/6 text-[#142A3B] flex items-center justify-center mx-auto mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#142A3B]">
              Zero fabricated numbers. Private, authenticated workspace.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#425466] leading-relaxed">
              Elevate does not connect to external banks, scrape account credentials, simulate market prices, or insert placeholder balances. Every account starts clean with empty states until you enter your own records, isolated behind server-side authentication with automatic and manual backups.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#142A3B]/10 bg-[#F7F9FA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-4 text-xs text-[#627384]">
          <p className="font-semibold text-[#142A3B]">
            Elevate · Your entire financial life, elevated.
          </p>
          <p>
            Authenticated server storage · Manual-first architecture · Billing preview mode
          </p>
        </div>
      </footer>

      {/* Sign In / Create Account Sheet */}
      <ModalSheet
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        title={
          authMode === 'register'
            ? 'Create Your Elevate Account'
            : 'Sign In to Elevate'
        }
        subtitle="Your financial records are scoped exclusively to your account on the Elevate server."
      >
        <div className="space-y-4">
          {/* Segmented Mode Toggle */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F7F9FA] border border-[#142A3B]/10"
          >
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'login'}
              onClick={() => {
                setAuthMode('login');
                setAuthError(null);
              }}
              className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white text-[#142A3B] border border-[#142A3B]/10'
                  : 'text-[#627384] hover:text-[#142A3B]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'register'}
              onClick={() => {
                setAuthMode('register');
                setAuthError(null);
              }}
              className={`min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                authMode === 'register'
                  ? 'bg-white text-[#142A3B] border border-[#142A3B]/10'
                  : 'text-[#627384] hover:text-[#142A3B]'
              }`}
            >
              Create Account
            </button>
          </div>

          <div className="pt-1">
            <GoogleSignInButton
              onClick={handleGoogleAuth}
              disabled={isSubmitting}
              label={
                authMode === 'register'
                  ? 'Continue with Google'
                  : 'Sign in with Google'
              }
              className="w-full"
            />
            <p className="mt-2 text-[11px] text-[#627384] text-center">
              Includes optional read-only Gmail access for detecting EMI due/paid alerts and expenses in Step 2.
            </p>
          </div>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-[#142A3B]/10" />
            <span className="mx-3 shrink-0 text-[11px] font-medium text-[#627384]">
              or continue with email
            </span>
            <div className="flex-grow border-t border-[#142A3B]/10" />
          </div>

          {authError && (
            <div
              role="alert"
              className="px-3.5 py-2.5 rounded-xl bg-[#B42318]/8 border border-[#B42318]/25 text-xs font-medium text-[#B42318]"
            >
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label
                  htmlFor="elevate-auth-name"
                  className="block text-xs font-semibold text-[#142A3B] mb-1.5"
                >
                  Full Name or Household Label
                </label>
                <input
                  id="elevate-auth-name"
                  type="text"
                  required
                  maxLength={80}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g., Alex Morgan"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="elevate-auth-email"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Email Address
              </label>
              <input
                id="elevate-auth-email"
                type="email"
                required
                autoComplete="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>

            <div>
              <label
                htmlFor="elevate-auth-password"
                className="block text-xs font-semibold text-[#142A3B] mb-1.5"
              >
                Password {authMode === 'register' ? '(Minimum 8 characters)' : ''}
              </label>
              <input
                id="elevate-auth-password"
                type="password"
                required
                minLength={authMode === 'register' ? 8 : 1}
                maxLength={128}
                autoComplete={
                  authMode === 'register' ? 'new-password' : 'current-password'
                }
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
              />
            </div>

            {authMode === 'register' && (
              <div>
                <label
                  htmlFor="elevate-auth-confirm-password"
                  className="block text-xs font-semibold text-[#142A3B] mb-1.5"
                >
                  Confirm Password
                </label>
                <input
                  id="elevate-auth-confirm-password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#142A3B]/15 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E8A78]"
                />
              </div>
            )}

            <p className="text-xs text-[#627384] leading-relaxed">
              Workspaces begin empty until you add entries. Session tokens remain strictly in active memory and revoke cleanly on sign-out.
            </p>

            <div className="pt-2 flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setAuthModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="secondary" disabled={isSubmitting}>
                <span>
                  {isSubmitting
                    ? authMode === 'register'
                      ? 'Creating Account…'
                      : 'Signing In…'
                    : authMode === 'register'
                      ? 'Create Account'
                      : 'Sign In'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      </ModalSheet>
    </div>
  );
}
