import Image from 'next/image';
import Link from 'next/link';
import { requireActiveMerchant } from '@/lib/supabase/merchant-dal';
import SignOutButton from './SignOutButton';

export default async function ProtectedMerchantLayout({ children }: { children: React.ReactNode }) {
  const merchant = await requireActiveMerchant();

  return (
    <div className="min-h-screen bg-[#f5f3f3] flex flex-col">
      <header className="bg-[#00342b] text-white">
        <div className="max-w-3xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Image src="/bizlink-logo.jpg" alt="BizLink Africa logo" width={32} height={32} className="rounded-sm object-contain shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">{merchant.businessName}</p>
              <p className="text-xs text-[#94d3c1] leading-tight">Merchant Portal</p>
            </div>
          </div>
          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <Link href="/merchant/statement" className="text-[#94d3c1] hover:text-white transition-colors">Statement</Link>
          </nav>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
