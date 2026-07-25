'use client';

import Image from 'next/image';
import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Mail, MapPin, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { COMPANY } from '@/data/website';
import { DEFAULT_DASHBOARD_ROUTE, getDashboardRouteForRole } from '@/data/role-dashboards';
import { recordLoginEvent } from './actions';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_AUTH_ERROR = 'Unable to sign in. Check your credentials and try again.';
const SUPPORT_TROUBLE_THRESHOLD = 3;

// window is unavailable during SSR, so the server (and the very first
// client render, pre-hydration) must both report "not expired" — a plain
// useState+useEffect would setState after mount instead, which is exactly
// the cascading-render pattern the react-hooks lint rule flags.
// useSyncExternalStore's getServerSnapshot is the built-in escape hatch for
// browser-only values that need to stay hydration-safe.
function subscribeNever() {
  return () => {};
}
function readSessionExpiredParam(): boolean {
  return new URLSearchParams(window.location.search).get('expired') === '1';
}
function readSessionExpiredServerSnapshot(): boolean {
  return false;
}

function ContactDetails() {
  return (
    <div className="space-y-3 text-sm">
      <p className="font-semibold text-white">Need Assistance?</p>
      <div className="space-y-1.5 text-white/80">
        <p className="flex items-center gap-2">
          <Mail size={14} className="shrink-0" aria-hidden="true" />
          <a href={`mailto:${COMPANY.emailSupport}`} className="hover:underline">
            {COMPANY.emailSupport}
          </a>
        </p>
        <p className="flex items-center gap-2">
          <Phone size={14} className="shrink-0" aria-hidden="true" />
          <a href={COMPANY.phoneLink} className="hover:underline">
            {COMPANY.phone}
          </a>
        </p>
        <p className="flex items-center gap-2">
          <MapPin size={14} className="shrink-0" aria-hidden="true" />
          Temboni, Ubungo, Dar es Salaam
        </p>
      </div>
      <p className="pt-1 text-xs text-white/60">{COMPANY.copyright}</p>
    </div>
  );
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const sessionExpired = useSyncExternalStore(
    subscribeNever,
    readSessionExpiredParam,
    readSessionExpiredServerSnapshot
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Email and password are required.');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    setSubmitting(true);

    const supabase = createClient({ rememberMe });
    const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });

    // Fire-and-forget audit write — swallow transport-level failures here too
    // (not just inside the action itself) so a flaky dev-server response
    // never surfaces as an unhandled rejection in the browser console.
    recordLoginEvent({ email: trimmedEmail, success: !error, failureReason: error?.message }).catch(() => {});

    if (error || !data.user) {
      setSubmitting(false);
      setFailedAttempts((n) => n + 1);
      // Deliberately generic — never confirms or denies that an account
      // exists for the entered email.
      setErrorMessage(GENERIC_AUTH_ERROR);
      return;
    }

    // Signed in successfully — never leave the button stuck on "Signing
    // in..." if the role lookup or navigation itself fails for any reason;
    // the user is already authenticated, so falling back to the Overview
    // page is always safe. Deliberately no router.refresh() after push():
    // push() already fetches fresh data for the destination route, and
    // calling refresh() in the same tick interrupts that pending navigation
    // in the real App Router — leaving the button stuck on "Signing in…"
    // until a manual reload.
    try {
      const { data: staff } = await supabase
        .from('staff_profiles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle();
      router.push(getDashboardRouteForRole(staff?.role ?? null));
    } catch {
      router.push(DEFAULT_DASHBOARD_ROUTE);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden md:flex-row">
      {/* Branding panel */}
      <div className="relative w-full overflow-hidden bg-gradient-to-br from-[#003f32] via-[#005b46] to-[#007a5c] text-white md:w-[38%] md:shrink-0 lg:w-[45%]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10 bg-white/5" />
          <div className="absolute -left-20 top-1/3 h-56 w-56 rounded-full bg-[#94d3c1]/10" />
          <div className="absolute bottom-0 right-0 h-96 w-96 translate-x-1/3 translate-y-1/4 rounded-full bg-white/5" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '22px 22px' }}
          />
        </div>

        <div className="relative z-10 flex flex-col gap-8 px-6 py-8 sm:px-10 md:h-full md:justify-between md:px-10 md:py-12 lg:px-14 lg:py-14">
          <div className="flex items-center gap-3">
            <Image
              src="/bizlink-logo.jpg"
              alt="BizLink Africa logo"
              width={44}
              height={44}
              className="rounded-md object-contain"
              priority
            />
            <span className="text-lg font-bold tracking-tight">BizLink Africa</span>
          </div>

          <div className="md:max-w-md">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Welcome to BizLink Africa</h1>
            <p className="mt-3 text-sm font-medium text-[#afefdd] sm:text-base">
              Business management, AI automation and digital solutions portal.
            </p>
            <p className="mt-4 hidden text-sm leading-relaxed text-white/80 md:block">
              Access your authorized dashboard to manage clients, operations, finance, technology, customer
              support, compliance and business performance.
            </p>
          </div>

          <div className="hidden md:block">
            <ContactDetails />
          </div>

          <details className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm md:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-white marker:hidden">
              Need assistance?
              <span aria-hidden="true">+</span>
            </summary>
            <div className="mt-3">
              <ContactDetails />
            </div>
          </details>
        </div>
      </div>

      {/* Login form */}
      <div className="flex flex-1 items-center justify-center bg-[#fbf9f8] px-4 py-10 sm:px-6 md:py-12">
        <div className="w-full max-w-[420px]">
          <div className="rounded-2xl border border-[#bfc9c4] bg-white p-8 shadow-lg sm:p-10">
            <h2 className="text-xl font-bold text-[#00342b] sm:text-2xl">Sign in to your account</h2>

            {sessionExpired && !errorMessage && (
              <p
                role="status"
                className="mt-5 rounded-md border border-[#bfc9c4] bg-[#f5f3f3] px-3 py-2 text-sm text-[#3f4945]"
              >
                Your session has expired. Please sign in again.
              </p>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
              <div>
                <label htmlFor="email" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#707975]">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={errorMessage ? true : undefined}
                  aria-describedby={errorMessage ? 'login-error' : undefined}
                  className="w-full rounded-md border border-[#bfc9c4] px-3 py-2.5 text-sm text-[#1b1c1c] focus:border-[#00342b] focus:outline-none focus:ring-2 focus:ring-[#00342b]/20"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#707975]">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={errorMessage ? true : undefined}
                    aria-describedby={errorMessage ? 'login-error' : undefined}
                    className="w-full rounded-md border border-[#bfc9c4] px-3 py-2.5 pr-11 text-sm text-[#1b1c1c] focus:border-[#00342b] focus:outline-none focus:ring-2 focus:ring-[#00342b]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-[#707975] hover:text-[#00342b] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b]/40"
                  >
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center text-sm">
                <label className="flex cursor-pointer select-none items-center gap-2 text-[#3f4945]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-[#bfc9c4] accent-[#00342b]"
                  />
                  Remember me
                </label>
              </div>

              {errorMessage && (
                <p id="login-error" role="alert" aria-live="assertive" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[#00342b] py-3 text-sm font-semibold tracking-wide text-white transition-colors hover:bg-[#004d40] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {submitting ? 'Signing in…' : 'Sign In'}
              </button>

              {failedAttempts >= SUPPORT_TROUBLE_THRESHOLD && (
                <p role="status" className="text-xs text-[#707975]">
                  Still having trouble? Contact{' '}
                  <a href={`mailto:${COMPANY.emailSupport}`} className="underline">
                    {COMPANY.emailSupport}
                  </a>{' '}
                  for help regaining access.
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
