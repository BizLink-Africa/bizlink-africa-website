import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminSidebar from './AdminSidebar';
import type { BadgeKey } from '@/data/navigation';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

const ZERO_BADGE_COUNTS: Record<BadgeKey, number> = {
  actionQueue: 0,
  criticalTickets: 0,
  failedIntegrations: 0,
  overdueInvoices: 0,
  pendingApprovals: 0,
  pendingContracts: 0,
  openSecurityEvents: 0,
  pendingComplianceReviews: 0,
  failedNotifications: 0,
  failedWebhooks: 0,
  failedJobs: 0,
  activeIncidents: 0,
  pendingApprovalWorkflowActions: 0,
};

const LONG_EMAIL = 'a-very-long-staff-email-address-for-truncation-testing@bizlinkafrica.net';

describe('AdminSidebar — Times New Roman scope', () => {
  it('puts the .admin-sidebar class on both the desktop/drawer aside and the mobile top bar', () => {
    const { container } = render(
      <AdminSidebar roleLabel="Super Admin" email="ceo@bizlinkafrica.net" permissions={[]} badgeCounts={ZERO_BADGE_COUNTS} />
    );
    const scoped = container.querySelectorAll('.admin-sidebar');
    // One is the mobile top bar div, the other is the <aside> drawer itself
    // — both carry real sidebar text (the company name appears in both).
    expect(scoped.length).toBe(2);
    expect(container.querySelector('aside.admin-sidebar')).not.toBeNull();
  });

  it('keeps the company name at weight 700 and the role label unbolded (400)', () => {
    render(
      <AdminSidebar roleLabel="Super Admin" email="ceo@bizlinkafrica.net" permissions={[]} badgeCounts={ZERO_BADGE_COUNTS} />
    );
    const names = screen.getAllByText('BizLink Africa');
    const asideName = names.find((n) => n.tagName === 'P');
    expect(asideName?.className).toMatch(/\bfont-bold\b/);

    const role = screen.getByText('Super Admin', { selector: 'p' });
    expect(role.className).not.toMatch(/font-(bold|semibold|medium)/);
  });
});

describe('AdminSidebar — account section', () => {
  it('truncates a long email with an ellipsis class and exposes the full address via title (hover tooltip)', () => {
    render(
      <AdminSidebar roleLabel="Super Admin" email={LONG_EMAIL} permissions={[]} badgeCounts={ZERO_BADGE_COUNTS} />
    );

    const emailNode = screen.getByText(LONG_EMAIL);
    expect(emailNode).toHaveAttribute('title', LONG_EMAIL);
    expect(emailNode.className).toMatch(/\btruncate\b/);
  });

  it('keeps Sign Out reachable in the account section', () => {
    render(
      <AdminSidebar roleLabel="Super Admin" email="ceo@bizlinkafrica.net" permissions={[]} badgeCounts={ZERO_BADGE_COUNTS} />
    );
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });
});

describe('AdminSidebar — mobile drawer', () => {
  it('opens via the hamburger button and closes via Escape (keyboard-operable overlay)', async () => {
    render(
      <AdminSidebar roleLabel="Super Admin" email="ceo@bizlinkafrica.net" permissions={[]} badgeCounts={ZERO_BADGE_COUNTS} />
    );
    const user = userEvent.setup();

    const openButton = screen.getByRole('button', { name: /open navigation menu/i });
    await user.click(openButton);
    expect(openButton).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(openButton).toHaveAttribute('aria-expanded', 'false');
  });
});
