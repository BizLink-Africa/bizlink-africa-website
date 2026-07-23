'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

export async function addForecastNote(period: string, scenarioNotes: string): Promise<{ success: boolean; message?: string }> {
  let user;
  try {
    user = await requirePermission('forecasting.manage');
  } catch {
    return { success: false, message: 'You do not have permission to add forecast notes.' };
  }

  if (!period.trim() || !scenarioNotes.trim()) {
    return { success: false, message: 'Period and scenario notes are required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('financial_forecast_notes').insert({
    period: period.trim().slice(0, 50),
    scenario_notes: scenarioNotes.trim().slice(0, 2000),
    created_by: user.email,
  });

  if (error) {
    console.error('Failed to add forecast note', error);
    return { success: false, message: 'Failed to save scenario note.' };
  }

  await logAuditEvent({
    performedBy: user.email ?? 'unknown',
    actionType: 'create',
    module: 'financial_forecast_notes',
    newValue: { period },
  });

  revalidatePath('/admin/finance/forecasting');
  return { success: true };
}
