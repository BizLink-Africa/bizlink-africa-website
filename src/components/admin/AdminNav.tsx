'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/inquiries', label: 'Leads' },
  { href: '/admin/clients', label: 'Clients' },
  { href: '/admin/services', label: 'Services' },
  { href: '/admin/onboarding', label: 'Onboarding' },
  { href: '/admin/support-tickets', label: 'Support Tickets' },
  { href: '/admin/integration-health', label: 'Integration Health' },
  { href: '/admin/ai-agents', label: 'AI Agents' },
  { href: '/admin/staff', label: 'Staff & Roles' },
  { href: '/admin/audit-logs', label: 'Audit Logs' },
  { href: '/admin/notifications', label: 'Notifications' },
  { href: '/admin/settings', label: 'Settings' },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3 py-4 flex-1 overflow-y-auto">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? 'bg-white text-[#00342b]' : 'text-[#c4c7c7] hover:text-white hover:bg-white/5'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
