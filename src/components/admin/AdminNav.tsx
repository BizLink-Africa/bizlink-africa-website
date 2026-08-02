'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { TOP_LEVEL_LEAVES, NAV_GROUPS, type BadgeKey, type NavGroup } from '@/data/navigation';

// Matches the `lg` breakpoint already used for the drawer/overlay toggle in
// AdminSidebar.tsx (Tailwind's default lg = 1024px) — below it, only one
// top-level group may stay open at a time (accordion); at/above it, groups
// toggle independently, as before.
const MOBILE_QUERY = '(max-width: 1023px)';

function matchMediaSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => (matchMediaSupported() ? window.matchMedia(MOBILE_QUERY).matches : false));

  useEffect(() => {
    if (!matchMediaSupported()) return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const handleChange = () => setIsMobile(mql.matches);
    handleChange();
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}

// All nav hrefs, computed once — needed to detect when one item's href is a
// path-prefix of another's (e.g. "/admin/finance" is a prefix of
// "/admin/finance/proformas"). Without this, both would show "active" while
// viewing a proforma, since the dashboard hub and its sibling pages share a
// URL prefix.
const ALL_NAV_HREFS = [
  ...TOP_LEVEL_LEAVES.map((i) => i.href),
  ...NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)),
];

// A handful of items (e.g. "Payout Approvals", "Failed Payouts") reuse an
// existing list page's own status filter instead of being a new page, so
// their nav href carries a query string (e.g. "/admin/payouts?status=failed").
const QUERY_FILTERED_HREFS = new Set(ALL_NAV_HREFS.filter((h) => h.includes('?')));

// currentFullPath includes the query string; pathname does not (Next's
// usePathname() strips it). A query-filtered href only matches an exact
// full-URL match — never a prefix, since it's always a leaf filter view.
// A plain href matches exactly or by prefix as before, UNLESS a
// query-filtered sibling is the exact current page, in which case that
// more specific entry should be the one highlighted instead (e.g. viewing
// "/admin/payouts?status=failed" must highlight "Failed Payouts", not the
// plain "Merchant Payouts" entry that shares the same base path).
function isActiveHref(pathname: string, currentFullPath: string, href: string): boolean {
  if (href.includes('?')) return currentFullPath === href;
  if (pathname === href) return !QUERY_FILTERED_HREFS.has(currentFullPath);
  if (!pathname.startsWith(`${href}/`)) return false;
  return !ALL_NAV_HREFS.some((other) => other !== href && (other === pathname || pathname.startsWith(`${other}/`)));
}

function groupContainsActivePath(group: NavGroup, pathname: string, currentFullPath: string): boolean {
  return group.items.some((item) => isActiveHref(pathname, currentFullPath, item.href));
}

function Badge({ count, label }: { count: number; label?: string }) {
  if (count <= 0) return null;
  return (
    <span
      role="status"
      aria-label={`${count} ${label ?? 'pending'}`}
      className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function NavLink({ href, label, badgeCount, onNavigate }: { href: string; label: string; badgeCount?: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const currentFullPath = search ? `${pathname}?${search}` : pathname;
  const active = isActiveHref(pathname, currentFullPath, href);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      title={label}
      className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors rounded-sm border-l-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#94d3c1] focus-visible:ring-offset-1 focus-visible:ring-offset-[#00342b] ${
        active
          ? 'bg-white text-[#00342b] font-semibold border-[#00342b]'
          : 'text-[#c4c7c7] font-normal border-transparent hover:text-white hover:bg-white/5'
      }`}
    >
      <span className="truncate">{label}</span>
      {typeof badgeCount === 'number' && <Badge count={badgeCount} label={`pending in ${label}`} />}
    </Link>
  );
}

export default function AdminNav({
  permissions,
  badgeCounts,
  onNavigate,
}: {
  permissions: string[];
  badgeCounts: Record<BadgeKey, number>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const currentFullPath = search ? `${pathname}?${search}` : pathname;
  const permissionSet = new Set(permissions);
  const isMobile = useIsMobile();

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || permissionSet.has(item.permission)),
  })).filter((group) => group.items.length > 0);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initiallyOpen = new Set<string>();
    for (const group of visibleGroups) {
      if (groupContainsActivePath(group, pathname, currentFullPath)) initiallyOpen.add(group.label);
    }
    return initiallyOpen;
  });

  // Below the lg breakpoint, opening a group closes every other one
  // (accordion) so a long menu stays scannable on a phone-width drawer.
  // At/above lg, groups toggle independently, as before.
  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const isOpen = prev.has(label);
      if (isMobile) return isOpen ? new Set<string>() : new Set([label]);
      const next = new Set(prev);
      if (isOpen) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const visibleTopLevel = TOP_LEVEL_LEAVES.filter((item) => !item.permission || permissionSet.has(item.permission));

  return (
    <nav aria-label="Admin navigation" className="flex flex-col gap-1 px-3 py-4 flex-1 overflow-y-auto">
      {visibleTopLevel.map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} onNavigate={onNavigate} />
      ))}

      {visibleGroups.map((group) => {
        const hasActiveItem = groupContainsActivePath(group, pathname, currentFullPath);
        const isOpen = openGroups.has(group.label) || hasActiveItem;
        const groupBadgeTotal = group.items.reduce((sum, item) => {
          if (!item.badgeKey) return sum;
          return sum + (badgeCounts[item.badgeKey] ?? 0);
        }, 0);
        const panelId = `nav-group-${group.label.toLowerCase().replace(/\s+/g, '-')}`;
        const Icon = group.icon;

        return (
          <div key={group.label} className="mt-4 first:mt-0">
            <button
              type="button"
              onClick={() => toggleGroup(group.label)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              title={group.label}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#94d3c1] focus-visible:ring-offset-1 focus-visible:ring-offset-[#00342b] ${
                hasActiveItem ? 'text-white' : 'text-[#94d3c1] hover:text-white'
              }`}
            >
              <Icon size={14} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{group.label}</span>
              {groupBadgeTotal > 0 && <Badge count={groupBadgeTotal} label={`items need attention in ${group.label}`} />}
              <ChevronDown
                size={14}
                className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${groupBadgeTotal > 0 ? '' : 'ml-auto'}`}
                aria-hidden="true"
              />
            </button>
            {isOpen && (
              <div id={panelId} className="flex flex-col gap-1 pl-7 mt-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    badgeCount={item.badgeKey ? badgeCounts[item.badgeKey] : undefined}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
