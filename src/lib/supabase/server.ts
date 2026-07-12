import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Bound to the signed-in admin's session cookies. Reads/writes go through
// the "authenticated" RLS policies on website_leads — never bypasses them.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component with no response to write to.
            // Safe to ignore as long as proxy.ts refreshes the session.
          }
        },
      },
    }
  );
}
