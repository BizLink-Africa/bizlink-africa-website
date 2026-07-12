import Image from 'next/image';
import Link from 'next/link';
import { verifyAdminSession } from '@/lib/supabase/dal';
import SignOutButton from '@/components/admin/SignOutButton';
import AdminNav from '@/components/admin/AdminNav';

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await verifyAdminSession();

  return (
    <div className="min-h-screen bg-[#f5f3f3] flex">
      <aside className="w-56 shrink-0 bg-[#00342b] text-white flex flex-col sticky top-0 h-screen">
        <Link href="/admin" className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <Image src="/bizlink-logo.jpg" alt="BizLink Africa Logo" width={32} height={32} className="object-contain rounded-sm shrink-0" />
          <div>
            <p className="font-[Geist,sans-serif] font-bold leading-tight">BizLink Africa</p>
            <p className="text-xs text-[#94d3c1]">Super Admin</p>
          </div>
        </Link>

        <AdminNav />

        <div className="px-4 py-4 border-t border-white/10 space-y-3">
          <p className="text-xs text-[#c4c7c7] break-all">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="px-6 md:px-10 py-8 flex-1 w-full">{children}</main>
      </div>
    </div>
  );
}
