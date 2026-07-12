'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      className="text-xs font-medium tracking-wide border border-[#94d3c1] text-[#afefdd] px-3 py-1.5 hover:bg-[#004d40] transition-colors"
    >
      Sign Out
    </button>
  );
}
