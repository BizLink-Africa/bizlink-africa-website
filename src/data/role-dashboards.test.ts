import { describe, expect, it } from 'vitest';
import { DEFAULT_DASHBOARD_ROUTE, ROLE_DASHBOARD_ROUTES, getDashboardRouteForRole } from './role-dashboards';

describe('getDashboardRouteForRole', () => {
  it('maps every seeded role (see 20260716000000_create_rbac_foundation.sql) to its own dashboard', () => {
    expect(getDashboardRouteForRole('super_admin')).toBe('/admin');
    expect(getDashboardRouteForRole('ceo')).toBe('/admin/ceo');
    expect(getDashboardRouteForRole('cfo')).toBe('/admin/finance');
    expect(getDashboardRouteForRole('cto')).toBe('/admin/cto');
    expect(getDashboardRouteForRole('operations')).toBe('/admin/operations');
    expect(getDashboardRouteForRole('customer_support')).toBe('/admin/support');
    expect(getDashboardRouteForRole('marketing')).toBe('/admin/marketing');
    expect(getDashboardRouteForRole('compliance_security')).toBe('/admin/compliance');
  });

  it('falls back to the Overview page for an unmapped role, null, or undefined', () => {
    expect(getDashboardRouteForRole('some_future_role')).toBe(DEFAULT_DASHBOARD_ROUTE);
    expect(getDashboardRouteForRole(null)).toBe(DEFAULT_DASHBOARD_ROUTE);
    expect(getDashboardRouteForRole(undefined)).toBe(DEFAULT_DASHBOARD_ROUTE);
  });

  it('has exactly 8 entries, matching the number of seeded roles', () => {
    expect(Object.keys(ROLE_DASHBOARD_ROUTES)).toHaveLength(8);
  });
});
