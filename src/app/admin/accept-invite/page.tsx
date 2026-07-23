'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const MIN_PASSWORD_LENGTH = 8;

export default function AcceptInvitePage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [expectedEmail, setExpectedEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/admin/login');
        return;
      }
      // The invite/reset link carries the intended recipient's email in
      // ?email=. If it doesn't match who's actually signed in, this browser
      // already had a different session active when the link's session got
      // established — showing the password form here would silently change
      // the WRONG account's password. Block it and let them fix it instead.
      const expected = new URLSearchParams(window.location.search).get('email');
      setExpectedEmail(expected);
      setSignedInEmail(user.email ?? null);
      setCheckingSession(false);
    });
  }, [router]);

  const handleSignOutAndRetry = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.push('/admin/inquiries');
    router.refresh();
  };

  if (checkingSession) {
    return null;
  }

  const emailMismatch = expectedEmail && signedInEmail && expectedEmail.toLowerCase() !== signedInEmail.toLowerCase();

  if (emailMismatch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f3f3] px-6">
        <div className="w-full max-w-sm bg-white border border-[#bfc9c4] p-8">
          <div className="flex items-center gap-3 mb-8">
            <Image src="/bizlink-logo.jpg" alt="BizLink Africa Logo" width={40} height={40} className="object-contain" />
            <div>
              <p className="font-bold text-[#00342b] leading-tight">BizLink Africa</p>
              <p className="text-xs text-[#707975]">Wrong Account Signed In</p>
            </div>
          </div>
          <p className="text-sm text-[#3f4945] mb-4 leading-relaxed">
            This link is for <span className="font-semibold">{expectedEmail}</span>, but this browser is currently
            signed in as <span className="font-semibold">{signedInEmail}</span>. Continuing would change the wrong
            account&apos;s password.
          </p>
          <p className="text-sm text-[#3f4945] mb-6 leading-relaxed">
            Sign out below, then ask a super admin to resend the invite (this link is now used up) and open the new
            one in a private/incognito window.
          </p>
          <button
            type="button"
            onClick={handleSignOutAndRetry}
            disabled={signingOut}
            className="w-full bg-[#00342b] text-white py-3 text-sm font-medium tracking-wide hover:bg-[#004d40] transition-colors disabled:opacity-60"
          >
            {signingOut ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f3f3] px-6">
      <div className="w-full max-w-sm bg-white border border-[#bfc9c4] p-8">
        <div className="flex items-center gap-3 mb-8">
          <Image src="/bizlink-logo.jpg" alt="BizLink Africa Logo" width={40} height={40} className="object-contain" />
          <div>
            <p className="font-bold text-[#00342b] leading-tight">BizLink Africa</p>
            <p className="text-xs text-[#707975]">Set Your Password</p>
          </div>
        </div>

        <p className="text-sm text-[#3f4945] mb-6">
          Welcome to the team. Choose a password to finish setting up your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="password">
              New Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border-b border-[#bfc9c4] py-2.5 focus:border-[#00342b] focus:outline-none text-sm text-[#1b1c1c]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-transparent border-b border-[#bfc9c4] py-2.5 focus:border-[#00342b] focus:outline-none text-sm text-[#1b1c1c]"
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#00342b] text-white py-3 text-sm font-medium tracking-wide hover:bg-[#004d40] transition-colors disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
