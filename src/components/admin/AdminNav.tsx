'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { TOP_LEVEL_LEAVES, NAV_GROUPS, type BadgeKey, type NavGroup } from '@/data/navigation';

// All nav hrefs, computed once — needed to detect when one item's href is a
// path-prefix of another's (e.g. "/admin/finance" is a prefix of
// "/admin/finance/proformas"). Without this, both would show "active" while
// viewing a proforma, since the dashboard hub and its sibling pages share a
// URL prefix.
const ALL_NAV_HREFS = [
  ...TOP_LEVEL_LEAVES.map((i) => i.href),
  ...NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href)),
];

// Exact match always counts. A prefix match (pathname is a real child path,
// e.g. a detail page under a list page) only counts if no OTHER nav item's
// href is a closer/more specific match for this pathname — otherwise a hub
// page like "/admin/finance" would stay highlighted on every finance
// sub-page, including its own siblings.
function isActiveHref(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !ALL_NAV_HREFS.some((other) => other !== href && (other === pathname || pathname.startsWith(`${other}/`)));
}

function groupContainsActivePath(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => isActiveHref(pathname, item.href));
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
  const active = isActiveHref(pathname, href);
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
  const permissionSet = new Set(permissions);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || permissionSet.has(item.permission)),
  })).filter((group) => group.items.length > 0);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initiallyOpen = new Set<string>();
    for (const group of visibleGroups) {
      if (groupContainsActivePath(group, pathname)) initiallyOpen.add(group.label);
    }
    return initiallyOpen;
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
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
        const isOpen = openGroups.has(group.label) || groupContainsActivePath(group, pathname);
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
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#94d3c1] hover:text-white transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#94d3c1] focus-visible:ring-offset-1 focus-visible:ring-offset-[#00342b]"
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
