'use client';

import Image from 'next/image';
import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Mail, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { COMPANY } from '@/data/website';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_AUTH_ERROR = 'Unable to sign in. Check your credentials and try again.';
const NO_ACCOUNT_ERROR = 'This account is not linked to a merchant. Contact BizLink Africa for access.';

function subscribeNever() {
  return () => {};
}
function readQueryFlag(name: string): boolean {
  return new URLSearchParams(window.location.search).get(name) === '1';
}
function readServerSnapshot(): boolean {
  return false;
}

export default function MerchantLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionExpired = useSyncExternalStore(subscribeNever, () => readQueryFlag('expired'), readServerSnapshot);
  const noAccount = useSyncExternalStore(subscribeNever, () => readQueryFlag('no_account'), readServerSnapshot);

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

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });

    if (error || !data.user) {
      setSubmitting(false);
      setErrorMessage(GENERIC_AUTH_ERROR);
      return;
    }

    router.push('/merchant/onboarding/terms');
  };

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden md:flex-row bg-[#fbf9f8]">
      <div className="relative w-full overflow-hidden bg-gradient-to-br from-[#003f32] via-[#005b46] to-[#007a5c] text-white md:w-[38%] md:shrink-0 lg:w-[45%]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10 bg-white/5" />
          <div className="absolute -left-20 top-1/3 h-56 w-56 rounded-full bg-[#94d3c1]/10" />
        </div>

        <div className="relative z-10 flex flex-col gap-8 px-6 py-8 sm:px-10 md:h-full md:justify-between md:px-10 md:py-12 lg:px-14 lg:py-14">
          <div className="flex items-center gap-3">
            <Image src="/bizlink-logo.jpg" alt="BizLink Africa logo" width={44} height={44} className="rounded-md object-contain" priority />
            <span className="text-lg font-bold tracking-tight">BizLink Africa</span>
          </div>

          <div className="md:max-w-md">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Merchant Portal</h1>
            <p className="mt-3 text-sm font-medium text-[#afefdd] sm:text-base">
              Onboarding, terms acceptance, and settlement coordination.
            </p>
          </div>

          <div className="hidden md:block space-y-1.5 text-sm text-white/80">
            <p className="flex items-center gap-2">
              <Mail size={14} className="shrink-0" aria-hidden="true" />
              <a href={`mailto:${COMPANY.emailSupport}`} className="hover:underline">{COMPANY.emailSupport}</a>
            </p>
            <p className="flex items-center gap-2">
              <Phone size={14} className="shrink-0" aria-hidden="true" />
              <a href={COMPANY.phoneLink} className="hover:underline">{COMPANY.phone}</a>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 md:py-12">
        <div className="w-full max-w-[420px]">
          <div className="rounded-2xl border border-[#bfc9c4] bg-white p-8 shadow-lg sm:p-10">
            <h2 className="text-xl font-bold text-[#00342b] sm:text-2xl">Sign in to your merchant account</h2>

            {sessionExpired && !errorMessage && (
              <p role="status" className="mt-5 rounded-md border border-[#bfc9c4] bg-[#f5f3f3] px-3 py-2 text-sm text-[#3f4945]">
                Your session has expired. Please sign in again.
              </p>
            )}
            {noAccount && !errorMessage && (
              <p role="status" className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {NO_ACCOUNT_ERROR}
              </p>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
              <div>
                <label htmlFor="email" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#707975]">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={errorMessage ? true : undefined}
                  className="w-full rounded-md border border-[#bfc9c4] px-3 py-2.5 text-sm text-[#1b1c1c] focus:border-[#00342b] focus:outline-none focus:ring-2 focus:ring-[#00342b]/20"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#707975]">Password</label>
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

              {errorMessage && (
                <p role="alert" aria-live="assertive" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
