'use client';

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import AdminNav from './AdminNav';
import SignOutButton from './SignOutButton';
import type { BadgeKey } from '@/data/navigation';

export default function AdminSidebar({
  roleLabel,
  email,
  permissions,
  badgeCounts,
}: {
  roleLabel: string;
  email: string;
  permissions: string[];
  badgeCounts: Record<BadgeKey, number>;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Keyboard parity with the click-to-close overlay — the drawer must be
  // dismissible without a pointer for the mobile/tablet layout to be
  // accessible.
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile top bar — sidebar is a drawer below the lg breakpoint */}
      <div className="admin-sidebar lg:hidden sticky top-0 z-40 flex items-center justify-between bg-[#00342b] text-white px-4 py-3">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/bizlink-logo.jpg" alt="BizLink Africa Logo" width={28} height={28} className="object-contain rounded-sm" />
          <span className="font-bold text-sm">BizLink Africa</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="admin-sidebar"
          className="p-2"
        >
          <Menu size={22} />
        </button>
      </div>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="admin-sidebar"
        className={`admin-sidebar w-72 shrink-0 bg-[#00342b] text-white flex flex-col fixed lg:sticky top-0 h-screen z-50 transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-5 border-b border-white/10">
          <Link href="/admin" className="flex items-center gap-3 min-w-0" onClick={() => setMobileOpen(false)}>
            <Image src="/bizlink-logo.jpg" alt="BizLink Africa Logo" width={44} height={44} className="object-contain rounded-sm shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-base leading-tight truncate" title="BizLink Africa">BizLink Africa</p>
              <p className="text-xs text-[#94d3c1] truncate" title={roleLabel}>{roleLabel}</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="lg:hidden p-1 text-white/70 hover:text-white shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <Suspense fallback={<div className="flex-1" />}>
          <AdminNav permissions={permissions} badgeCounts={badgeCounts} onNavigate={() => setMobileOpen(false)} />
        </Suspense>

        <div className="px-4 py-4 border-t border-white/10 space-y-3 shrink-0">
          <p className="text-[13px] text-[#dfe6e3] truncate" title={email}>{email}</p>
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}
