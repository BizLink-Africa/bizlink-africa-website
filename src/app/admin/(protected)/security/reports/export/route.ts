import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { maskSecrets } from '@/lib/security/mask';

const VALID_TYPES = new Set(['security-events', 'security-incidents', 'sessions', 'logins']);

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',') + '\r\n';
}

export async function GET(request: Request) {
  try {
    await requirePermission('security.reports.export');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? '';
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
  }

  const supabase = await createClient();
  let csv = '';

  if (type === 'security-events') {
    const { data } = await supabase.from('security_events').select('event_type, severity, description, actor, ip_address, status, created_at');
    csv += csvRow(['Security Events Report — descriptions masked, never full secrets']);
    csv += '\r\n';
    csv += csvRow(['Type', 'Severity', 'Description', 'User', 'IP', 'Investigation Status', 'Timestamp']);
    for (const r of data ?? []) {
      csv += csvRow([r.event_type, r.severity, maskSecrets(r.description), r.actor ?? '', r.ip_address ?? '', r.status, r.created_at]);
    }
  }

  if (type === 'security-incidents') {
    const { data } = await supabase.from('security_incidents').select('incident_number, title, severity, status, detection_date, resolved_at, containment, resolution');
    csv += csvRow(['Security Incidents Report — containment/resolution masked, never full secrets']);
    csv += '\r\n';
    csv += csvRow(['Incident #', 'Title', 'Severity', 'Status', 'Detected', 'Resolved', 'Containment', 'Resolution']);
    for (const r of data ?? []) {
      csv += csvRow([r.incident_number ?? '', r.title, r.severity, r.status, r.detection_date, r.resolved_at ?? '', maskSecrets(r.containment), maskSecrets(r.resolution)]);
    }
  }

  if (type === 'sessions') {
    const { data } = await supabase.from('user_sessions').select('device, ip_address, login_at, last_active_at, revoked, revoked_by, staff_profiles(full_name)');
    csv += csvRow(['Session Report']);
    csv += '\r\n';
    csv += csvRow(['Staff Member', 'Device', 'IP', 'Login', 'Last Active', 'Revoked', 'Revoked By']);
    for (const r of (data ?? []) as unknown as { device: string | null; ip_address: string | null; login_at: string; last_active_at: string; revoked: boolean; revoked_by: string | null; staff_profiles: { full_name: string } | null }[]) {
      csv += csvRow([r.staff_profiles?.full_name ?? '', r.device ?? '', r.ip_address ?? '', r.login_at, r.last_active_at, r.revoked ? 'Yes' : 'No', r.revoked_by ?? '']);
    }
  }

  if (type === 'logins') {
    const { data } = await supabase.from('login_events').select('email, success, ip_address, failure_reason, occurred_at').order('occurred_at', { ascending: false }).limit(5000);
    csv += csvRow(['Login Activity Report']);
    csv += '\r\n';
    csv += csvRow(['Email', 'Result', 'IP', 'Failure Reason', 'Timestamp']);
    for (const r of data ?? []) {
      csv += csvRow([r.email, r.success ? 'Success' : 'Failed', r.ip_address ?? '', r.failure_reason ?? '', r.occurred_at]);
    }
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bizlink-${type}-report.csv"`,
    },
  });
}
