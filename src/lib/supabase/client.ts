import { createBrowserClient } from '@supabase/ssr';

// @supabase/ssr's own default (400 days — the browser-enforced ceiling on
// any cookie's Max-Age) is what "Remember me" checked maps to; unchecked
// trades that away for a short-lived cookie so the browser forces a
// re-login well within the same day.
const REMEMBER_ME_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
const NOT_REMEMBERED_MAX_AGE_SECONDS = 60 * 60 * 8;

export function createClient(options?: { rememberMe?: boolean }) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: options?.rememberMe === false ? NOT_REMEMBERED_MAX_AGE_SECONDS : REMEMBER_ME_MAX_AGE_SECONDS,
      },
    }
  );
}
