import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { maskSecrets } from '@/lib/security/mask';

const VALID_TYPES = new Set([
  'integration-health', 'api-requests', 'webhook-deliveries', 'deployments', 'background-jobs', 'incidents', 'ai-agents',
]);

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
    await requirePermission('technology.reports.export');
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

  if (type === 'integration-health') {
    const { data } = await supabase.from('integration_health').select('service_type, integration_type, environment, api_status, success_rate_percentage, avg_response_time_ms, technical_owner, incident_status');
    csv += csvRow(['Integration Health Report']);
    csv += '\r\n';
    csv += csvRow(['Service Type', 'Integration Type', 'Environment', 'API Status', 'Success Rate', 'Avg Response Time (ms)', 'Technical Owner', 'Incident Status']);
    for (const r of data ?? []) {
      csv += csvRow([r.service_type, r.integration_type ?? '', r.environment, r.api_status, r.success_rate_percentage ?? '', r.avg_response_time_ms ?? '', r.technical_owner ?? '', r.incident_status]);
    }
  }

  if (type === 'api-requests') {
    const { data } = await supabase.from('api_request_logs').select('occurred_at, endpoint, method, response_code, response_time_ms, error_category, environment').order('occurred_at', { ascending: false }).limit(2000);
    csv += csvRow(['API Request Report — endpoints masked, never full secrets']);
    csv += '\r\n';
    csv += csvRow(['Timestamp', 'Endpoint', 'Method', 'Response Code', 'Response Time (ms)', 'Error Category', 'Environment']);
    for (const r of data ?? []) {
      csv += csvRow([r.occurred_at, maskSecrets(r.endpoint), r.method, r.response_code, r.response_time_ms ?? '', r.error_category, r.environment]);
    }
  }

  if (type === 'webhook-deliveries') {
    const { data } = await supabase.from('webhook_deliveries').select('endpoint, event, delivery_status, retry_count, failure_reason, created_at').order('created_at', { ascending: false }).limit(2000);
    csv += csvRow(['Webhook Delivery Report']);
    csv += '\r\n';
    csv += csvRow(['Endpoint', 'Event', 'Delivery Status', 'Retries', 'Failure Reason', 'Created']);
    for (const r of data ?? []) {
      csv += csvRow([r.endpoint, r.event, r.delivery_status, r.retry_count, r.failure_reason ?? '', r.created_at]);
    }
  }

  if (type === 'deployments') {
    const { data } = await supabase.from('deployments').select('application, environment, version, status, started_by, start_time, end_time, rollback_status').order('created_at', { ascending: false });
    csv += csvRow(['Deployment Report']);
    csv += '\r\n';
    csv += csvRow(['Application', 'Environment', 'Version', 'Status', 'Started By', 'Start Time', 'End Time', 'Rollback Status']);
    for (const r of data ?? []) {
      csv += csvRow([r.application, r.environment, r.version, r.status, r.started_by ?? '', r.start_time ?? '', r.end_time ?? '', r.rollback_status]);
    }
  }

  if (type === 'background-jobs') {
    const { data } = await supabase.from('background_jobs').select('job_name, queue, status, retries, failure_reason, started_at, completed_at').order('created_at', { ascending: false });
    csv += csvRow(['Background Jobs Report']);
    csv += '\r\n';
    csv += csvRow(['Job Name', 'Queue', 'Status', 'Retries', 'Failure Reason', 'Started', 'Completed']);
    for (const r of data ?? []) {
      csv += csvRow([r.job_name, r.queue, r.status, r.retries, r.failure_reason ?? '', r.started_at ?? '', r.completed_at ?? '']);
    }
  }

  if (type === 'incidents') {
    const { data } = await supabase.from('technical_incidents').select('title, severity, status, created_at, resolved_at, root_cause').order('created_at', { ascending: false });
    csv += csvRow(['Technical Incidents Report']);
    csv += '\r\n';
    csv += csvRow(['Title', 'Severity', 'Status', 'Opened', 'Resolved', 'Root Cause']);
    for (const r of data ?? []) {
      csv += csvRow([r.title, r.severity, r.status, r.created_at, r.resolved_at ?? '', r.root_cause ?? '']);
    }
  }

  if (type === 'ai-agents') {
    const { data } = await supabase.from('ai_agent_configs').select('agent_name, agent_type, agent_status, channel, deployment_status, usage_count, last_activity_at');
    csv += csvRow(['AI Agent Report']);
    csv += '\r\n';
    csv += csvRow(['Agent Name', 'Agent Type', 'Status', 'Channel', 'Deployment', 'Usage', 'Last Activity']);
    for (const r of data ?? []) {
      csv += csvRow([r.agent_name ?? '', r.agent_type, r.agent_status, r.channel ?? '', r.deployment_status, r.usage_count, r.last_activity_at ?? '']);
    }
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bizlink-${type}-report.csv"`,
    },
  });
}
