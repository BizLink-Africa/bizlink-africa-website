'use server';

import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';

// Runs pre-auth (a failed login has no session at all, and even a
// successful one hasn't necessarily propagated a server-visible cookie in
// the same tick) — so this always uses the service-role client rather than
// the RLS-scoped one. login_events has no insert policy for anon/
// authenticated at all (see the migration); only the service role can write
// here, which is what makes this safe to call from an unauthenticated page.
// Never throws — a logging failure must not block or alter the login flow.
export async function recordLoginEvent(input: { email: string; success: boolean; failureReason?: string }): Promise<void> {
  try {
    const headerList = await headers();
    const ipAddress = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const userAgent = headerList.get('user-agent') ?? null;

    const supabase = createServiceClient();
    const { error } = await supabase.from('login_events').insert({
      email: input.email.trim().toLowerCase(),
      success: input.success,
      ip_address: ipAddress,
      user_agent: userAgent,
      failure_reason: input.success ? null : input.failureReason?.slice(0, 200) ?? null,
    });

    if (error) {
      console.error('Failed to record login event', error);
    }
  } catch (err) {
    console.error('Failed to record login event', err);
  }
}
