import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Bypasses RLS entirely using the service_role key. Only ever import this
// from server-only code (route handlers) that has already validated its
// own inputs — never from a page, layout, or 'use client' component.
// Used narrowly by the public inquiry submission route, which must be able
// to update notification_status after the anon-scoped insert (anon can
// insert but, by design, cannot update — see the website_leads RLS policies).
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
