'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { NAV_LINKS } from '@/data/website';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#00342b]';

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      <nav className="flex justify-between items-center w-full px-4 sm:px-6 md:px-16 lg:px-24 py-2 bg-[#fbf9f8]/80 backdrop-blur-md border-b border-[#bfc9c4]">

        {/* Logo */}
        <Link href="/" className={`flex items-center gap-3 shrink-0 ${FOCUS_RING}`}>
          <Image
            src="/bizlink-logo.jpg"
            alt="BizLink Africa Logo"
            width={52}
            height={52}
            className="object-contain"
            priority
          />
          <span className="hidden sm:block font-[Geist,sans-serif] font-bold text-lg text-[#00342b]">
            BizLink Africa
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex gap-8 items-center">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`text-sm font-medium tracking-wide transition-colors duration-200 ${FOCUS_RING} ${
                  active
                    ? 'text-[#00342b] border-b-2 border-[#00342b] pb-0.5'
                    : 'text-[#3f4945] hover:text-[#00342b]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* CTA + Mobile Toggle */}
        <div className="flex items-center gap-3">
          <Link
            href="/contact"
            className={`hidden md:inline-flex bg-[#00342b] text-white px-5 py-2.5 text-sm font-medium tracking-wide hover:bg-[#004d40] transition-colors active:scale-95 ${FOCUS_RING}`}
          >
            Start Your Journey
          </Link>
          <button
            className={`md:hidden p-2 text-[#1b1c1c] ${FOCUS_RING}`}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div id="mobile-nav-menu" className="md:hidden bg-[#fbf9f8] border-t border-[#bfc9c4] px-6 py-4 flex flex-col gap-4">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`text-sm font-medium tracking-wide py-1 ${FOCUS_RING} ${
                  active ? 'text-[#00342b] font-semibold' : 'text-[#3f4945]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/contact"
            onClick={() => setMobileOpen(false)}
            className={`mt-2 inline-flex justify-center bg-[#00342b] text-white px-5 py-3 text-sm font-medium tracking-wide hover:bg-[#004d40] transition-colors ${FOCUS_RING}`}
          >
            Start Your Journey
          </Link>
        </div>
      )}
    </header>
  );
}
