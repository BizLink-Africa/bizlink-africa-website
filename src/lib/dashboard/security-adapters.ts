import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { OPEN_SECURITY_INCIDENT_STATUSES } from '@/data/securityIncidents';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface SecurityOverview {
  failedLoginsCount: number;
  suspiciousLoginsCount: number;
  activeSessionsCount: number;
  lockedAccountsCount: number;
  mfaEnabledCount: number;
  mfaTotalStaffCount: number;
  securityIncidentsCount: number;
  permissionChangeAlertsCount: number;
  apiCredentialActivityCount: number;
  securityRisksCount: number;
  openSecurityEventsCount: number;
}

// Security Dashboard KPIs — distinct page from the Compliance Dashboard
// (compliance-adapters.ts). failedLogins/suspiciousLogins are real, live
// data from login_events (populated by the actual login page, see
// src/app/admin/login/actions.ts) — everything else here is either a real
// table count or an explicitly-labeled manually-tracked flag
// (mfaEnabledCount, see staff_profiles.mfa_enabled migration comment).
export async function getSecurityOverview(supabase: Supabase): Promise<SecurityOverview | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: recentFailedLogins, error: e1 },
    { data: sessions, error: e2 },
    { data: staffRows, error: e3 },
    { data: incidents, error: e4 },
    { data: permissionChangeEvents, error: e5 },
    { data: credentials, error: e6 },
    { data: riskEvents, error: e7 },
  ] = await Promise.all([
    supabase.from('login_events').select('email, occurred_at').eq('success', false).gte('occurred_at', thirtyDaysAgo),
    supabase.from('user_sessions').select('id').eq('revoked', false),
    supabase.from('staff_profiles').select('id, is_active, mfa_enabled'),
    supabase.from('security_incidents').select('id, status'),
    supabase.from('security_events').select('id').eq('event_type', 'permission_change').gte('created_at', thirtyDaysAgo),
    supabase.from('provisioning_credentials').select('id').gte('created_at', thirtyDaysAgo),
    supabase.from('security_events').select('id, severity, status'),
  ]);

  if (e1 || e2 || e3 || e4 || e5 || e6 || e7 || !recentFailedLogins || !sessions || !staffRows || !incidents || !permissionChangeEvents || !credentials || !riskEvents) {
    return null;
  }

  // Suspicious = 3+ failed attempts for the same email within the last 24h.
  const failedCountByEmail = new Map<string, number>();
  for (const l of recentFailedLogins) {
    if (l.occurred_at < twentyFourHoursAgo) continue;
    failedCountByEmail.set(l.email, (failedCountByEmail.get(l.email) ?? 0) + 1);
  }
  const suspiciousLoginsCount = [...failedCountByEmail.values()].filter((count) => count >= 3).length;

  const activeStaff = staffRows.filter((s) => s.is_active);
  const openEventStatuses = ['open', 'investigating'];

  return {
    failedLoginsCount: recentFailedLogins.length,
    suspiciousLoginsCount,
    activeSessionsCount: sessions.length,
    lockedAccountsCount: staffRows.filter((s) => !s.is_active).length,
    mfaEnabledCount: activeStaff.filter((s) => s.mfa_enabled).length,
    mfaTotalStaffCount: activeStaff.length,
    securityIncidentsCount: incidents.filter((i) => OPEN_SECURITY_INCIDENT_STATUSES.includes(i.status)).length,
    permissionChangeAlertsCount: permissionChangeEvents.length,
    apiCredentialActivityCount: credentials.length,
    securityRisksCount: riskEvents.filter((e) => openEventStatuses.includes(e.status) && (e.severity === 'warning' || e.severity === 'critical')).length,
    openSecurityEventsCount: riskEvents.filter((e) => openEventStatuses.includes(e.status)).length,
  };
}
