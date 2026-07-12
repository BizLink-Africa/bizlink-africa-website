'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);

    if (error) {
      setErrorMessage('Invalid email or password.');
      return;
    }

    router.push('/admin/inquiries');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f3f3] px-6">
      <div className="w-full max-w-sm bg-white border border-[#bfc9c4] p-8">
        <div className="flex items-center gap-3 mb-8">
          <Image src="/bizlink-logo.jpg" alt="BizLink Africa Logo" width={40} height={40} className="object-contain" />
          <div>
            <p className="font-[Geist,sans-serif] font-bold text-[#00342b] leading-tight">BizLink Africa</p>
            <p className="text-xs text-[#707975]">Super Admin</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border-b border-[#bfc9c4] py-2.5 focus:border-[#00342b] focus:outline-none text-sm text-[#1b1c1c]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
