import 'server-only';
import { createClient } from '@/lib/supabase/server';

interface AuditEventInput {
  performedBy: string;
  actionType: string;
  module: string;
  recordId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

// Never throws — a failed audit write must not break the mutation that
// triggered it. Failures are just logged server-side.
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('audit_logs').insert({
    performed_by: input.performedBy,
    action_type: input.actionType,
    module: input.module,
    record_id: input.recordId ?? null,
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
  });

  if (error) {
    console.error('Failed to write audit log', input, error);
  }
}
