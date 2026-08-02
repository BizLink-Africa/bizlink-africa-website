'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/merchant/login');
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      className="flex items-center gap-1.5 text-xs font-medium text-[#c4c7c7] hover:text-white transition-colors disabled:opacity-60"
    >
      <LogOut size={14} aria-hidden="true" />
      {signingOut ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
