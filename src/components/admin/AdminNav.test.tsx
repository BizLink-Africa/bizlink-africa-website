import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminNav from './AdminNav';
import { NAV_GROUPS, type BadgeKey } from '@/data/navigation';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

let mockPathname = '/admin';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
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

// Super Admin holds every permission referenced anywhere in NAV_GROUPS, so
// this exercises the fully-expanded nav exactly as a super admin sees it.
const ALL_PERMISSIONS = Array.from(
  new Set(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.permission).filter((p): p is string => Boolean(p))))
);

describe('AdminNav', () => {
  it('renders group labels in title case, not visually uppercased', () => {
    mockPathname = '/admin';
    render(<AdminNav permissions={ALL_PERMISSIONS} badgeCounts={ZERO_BADGE_COUNTS} />);

    const financeHeading = screen.getByRole('button', { name: /finance/i });
    expect(financeHeading).toHaveTextContent('Finance');
    expect(financeHeading.className).not.toMatch(/\buppercase\b/);
  });

  it('gives restricted roles only their authorized groups', () => {
    mockPathname = '/admin';
    render(<AdminNav permissions={['tickets.view']} badgeCounts={ZERO_BADGE_COUNTS} />);

    expect(screen.getByRole('button', { name: /customer support/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^finance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /governance/i })).not.toBeInTheDocument();
  });

  it('auto-expands the group containing the active route and marks the link active', () => {
    mockPathname = '/admin/finance/invoices';
    render(<AdminNav permissions={ALL_PERMISSIONS} badgeCounts={ZERO_BADGE_COUNTS} />);

    const financeButton = screen.getByRole('button', { name: /finance/i });
    expect(financeButton).toHaveAttribute('aria-expanded', 'true');

    const invoicesLink = screen.getByRole('link', { name: 'Invoices' });
    expect(invoicesLink).toHaveAttribute('aria-current', 'page');
    expect(invoicesLink.className).toMatch(/border-\[#00342b\]/);
    expect(invoicesLink.className).toMatch(/font-semibold/);
  });

  it('toggles a group open/closed on click and flips aria-expanded/chevron', async () => {
    mockPathname = '/admin';
    render(<AdminNav permissions={ALL_PERMISSIONS} badgeCounts={ZERO_BADGE_COUNTS} />);

    const user = userEvent.setup();
    const complianceButton = screen.getByRole('button', { name: /compliance & security/i });
    expect(complianceButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /security events/i })).not.toBeInTheDocument();

    await user.click(complianceButton);
    expect(complianceButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /security events/i })).toBeInTheDocument();

    await user.click(complianceButton);
    expect(complianceButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('hides a badge when its count is zero and shows it with an accessible label when nonzero', () => {
    mockPathname = '/admin/compliance/security-events';
    const { rerender } = render(<AdminNav permissions={ALL_PERMISSIONS} badgeCounts={ZERO_BADGE_COUNTS} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(
      <AdminNav permissions={ALL_PERMISSIONS} badgeCounts={{ ...ZERO_BADGE_COUNTS, openSecurityEvents: 3 }} />
    );
    const badge = screen.getAllByRole('status')[0];
    expect(badge).toHaveTextContent('3');
    expect(badge).toHaveAccessibleName(/3/);
  });

  it('caps the displayed badge count at 99+', () => {
    mockPathname = '/admin/compliance/security-events';
    render(
      <AdminNav permissions={ALL_PERMISSIONS} badgeCounts={{ ...ZERO_BADGE_COUNTS, openSecurityEvents: 250 }} />
    );
    expect(screen.getAllByText('99+')[0]).toBeInTheDocument();
  });

  it('gives every nav link a title attribute for tooltip access on truncated labels', () => {
    mockPathname = '/admin';
    render(<AdminNav permissions={ALL_PERMISSIONS} badgeCounts={ZERO_BADGE_COUNTS} />);
    const complianceHeading = screen.getByRole('button', { name: /compliance & security/i });
    expect(complianceHeading).toHaveAttribute('title', 'Compliance & Security');
  });

  it('keeps the longest group/item labels truncatable so Times New Roman\'s wider glyphs cannot overflow the sidebar', () => {
    // Executive Action Center only renders once its group is open — put the
    // active route inside Executive Management so that group auto-expands.
    mockPathname = '/admin/ceo/actions';
    render(<AdminNav permissions={ALL_PERMISSIONS} badgeCounts={ZERO_BADGE_COUNTS} />);

    for (const name of ['Executive Management', 'Compliance & Security']) {
      const heading = screen.getByRole('button', { name });
      expect(heading.querySelector('span.truncate')).toHaveTextContent(name);
    }

    const actionCenterLink = screen.getByRole('link', { name: 'Executive Action Center' });
    expect(actionCenterLink.querySelector('span.truncate')).toHaveTextContent('Executive Action Center');
  });

  it('gives inactive child links weight 400 while the active item keeps its existing semibold accent (unchanged)', () => {
    mockPathname = '/admin/contracts';
    render(<AdminNav permissions={ALL_PERMISSIONS} badgeCounts={ZERO_BADGE_COUNTS} />);

    const contractsLink = screen.getByRole('link', { name: 'Contracts' });
    expect(contractsLink.className).toMatch(/font-semibold/);
    expect(contractsLink.className).toMatch(/border-\[#00342b\]/);

    // Same group as Contracts (Operations), so it's guaranteed rendered —
    // sibling groups that don't contain the active route start collapsed.
    const siblingLink = screen.getByRole('link', { name: 'Service Delivery' });
    expect(siblingLink.className).toMatch(/font-normal/);
    expect(siblingLink.className).not.toMatch(/font-semibold/);
  });

  it('leaves lucide icon markup on group headers unaffected by the font change', () => {
    mockPathname = '/admin';
    render(<AdminNav permissions={ALL_PERMISSIONS} badgeCounts={ZERO_BADGE_COUNTS} />);
    const financeHeading = screen.getByRole('button', { name: /finance/i });
    expect(financeHeading.querySelector('svg.lucide')).not.toBeNull();
  });

  describe('CRM & Sales — permission-gated items and the Services rename', () => {
    // The group starts collapsed unless the active route falls inside it, so
    // every case below opens it explicitly via the header button, matching
    // the existing "toggles a group open/closed" test above.
    async function openCrmGroup() {
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /crm & sales/i }));
    }

    it('shows only the items a restricted CRM role is permitted to see', async () => {
      mockPathname = '/admin';
      render(<AdminNav permissions={['leads.view']} badgeCounts={ZERO_BADGE_COUNTS} />);
      await openCrmGroup();

      expect(screen.getByRole('link', { name: 'Leads' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Opportunities' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Proposals' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'CRM Reports' })).not.toBeInTheDocument();
    });

    it('hides the entire group for a role with none of its permissions', () => {
      mockPathname = '/admin';
      render(<AdminNav permissions={['tickets.view']} badgeCounts={ZERO_BADGE_COUNTS} />);
      expect(screen.queryByRole('button', { name: /crm & sales/i })).not.toBeInTheDocument();
    });

    it('renders the Services item under its new "Solutions & Services" label while keeping the original route and permission', async () => {
      mockPathname = '/admin';
      render(<AdminNav permissions={['services.view']} badgeCounts={ZERO_BADGE_COUNTS} />);
      await openCrmGroup();

      const link = screen.getByRole('link', { name: 'Solutions & Services' });
      expect(link).toHaveAttribute('href', '/admin/services');
      expect(screen.queryByRole('link', { name: /^Services$/ })).not.toBeInTheDocument();
    });

    it('grants a full CRM role every item with its correct route', async () => {
      mockPathname = '/admin';
      const crmPermissions = [
        'dashboard.crm.view',
        'leads.view',
        'clients.view',
        'opportunities.view',
        'services.view',
        'proposals.view',
        'crm.followups.view',
        'crm.reports.view',
      ];
      render(<AdminNav permissions={crmPermissions} badgeCounts={ZERO_BADGE_COUNTS} />);
      await openCrmGroup();

      const expected: [string, string][] = [
        ['CRM Dashboard', '/admin/crm'],
        ['Leads', '/admin/inquiries'],
        ['Clients', '/admin/clients'],
        ['Opportunities', '/admin/crm/opportunities'],
        ['Solutions & Services', '/admin/services'],
        ['Proposals', '/admin/crm/proposals'],
        ['Sales Pipeline', '/admin/crm/pipeline'],
        ['Follow-Ups', '/admin/crm/follow-ups'],
        ['Client Contacts', '/admin/crm/contacts'],
        ['CRM Reports', '/admin/crm/reports'],
      ];
      for (const [label, href] of expected) {
        expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
      }
    });

    it('ties Sales Pipeline visibility to dashboard.crm.view, the same permission as the CRM Dashboard', async () => {
      mockPathname = '/admin';
      render(<AdminNav permissions={['dashboard.crm.view']} badgeCounts={ZERO_BADGE_COUNTS} />);
      await openCrmGroup();

      expect(screen.getByRole('link', { name: 'CRM Dashboard' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Sales Pipeline' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Leads' })).not.toBeInTheDocument();
    });

    it('gives Client Contacts the same clients.view gate as the Clients list, not a dedicated permission', async () => {
      mockPathname = '/admin';
      render(<AdminNav permissions={['clients.view']} badgeCounts={ZERO_BADGE_COUNTS} />);
      await openCrmGroup();

      expect(screen.getByRole('link', { name: 'Clients' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Client Contacts' })).toBeInTheDocument();
    });
  });
});
