import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getDashboardRouteForRole } from '@/data/role-dashboards';

// Next.js 16 renamed Middleware to Proxy (same mechanism/file convention,
// new name). This is the host-separation boundary between the public
// marketing site and the admin portal — both are one Next.js app/one Vercel
// project (see docs/VERCEL_PRODUCTION_SETUP.md for why), so hostname is the
// only thing that actually separates them; nothing here should ever be
// bypassable by just changing the path.
const PUBLIC_HOSTS = new Set(['bizlinkafrica.net', 'www.bizlinkafrica.net']);
const ADMIN_HOST = 'admin.bizlinkafrica.net';
const PRODUCTION_HOSTS = new Set([...PUBLIC_HOSTS, ADMIN_HOST]);

// Vercel sets VERCEL_ENV to 'production' only for the production deployment
// (preview deployments get 'preview', `next dev` gets nothing at all) — this
// is the one env var that reliably distinguishes "the real production
// domains must be enforced" from "any host, including a preview *.vercel.app
// URL or localhost, is fine to allow through unrestricted."
function isProductionHostGuardActive(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

function hostnameFromHeader(request: NextRequest): string {
  return (request.headers.get('host') ?? '').split(':')[0].toLowerCase();
}

// A deliberately generic 404 — same shape a genuinely missing route would
// return. Do not add a body that reveals *why* the request was rejected
// (wrong host vs. admin path on a public host are both real signals to an
// attacker); "prefer a non-disclosing 404" per the production security spec.
function notFound(): NextResponse {
  return new NextResponse('Not Found', { status: 404 });
}

export async function proxy(request: NextRequest) {
  const host = hostnameFromHeader(request);
  const incomingPath = request.nextUrl.pathname;

  if (isProductionHostGuardActive()) {
    // Unrecognized Host header in production (a stale DNS entry, a
    // misconfigured domain alias, or a spoofed Host on a direct IP request)
    // — reject rather than silently serving the app under an unknown name.
    if (!PRODUCTION_HOSTS.has(host)) {
      return notFound();
    }

    // The admin app must never be reachable through the public hostnames,
    // even though it's the same deployment under the hood.
    if (PUBLIC_HOSTS.has(host) && incomingPath.startsWith('/admin')) {
      return notFound();
    }
  }

  // On the admin host, every route the admin app cares about already lives
  // under /admin/* (that's the existing convention this reuses rather than
  // restructuring) — this rewrite just means the admin host's own root and
  // any bare path resolve into that tree instead of falling through to the
  // public marketing pages that happen to live at those same paths in this
  // one shared app. Purely a routing rewrite: the browser's URL bar is
  // untouched, and every existing /admin/... link and redirect target in
  // the codebase keeps working exactly as it does today.
  const isAdminHost = host === ADMIN_HOST;
  const effectivePath =
    isAdminHost && !incomingPath.startsWith('/admin')
      ? incomingPath === '/'
        ? '/admin'
        : `/admin${incomingPath}`
      : incomingPath;

  // Everything below this point is the existing Supabase session gate,
  // unchanged in behavior — it only runs for /admin/* traffic so public
  // page views never pay for a cookie-based auth round trip they don't
  // need.
  if (!effectivePath.startsWith('/admin')) {
    return NextResponse.next();
  }

  const rewriteUrl =
    effectivePath !== incomingPath ? new URL(effectivePath + request.nextUrl.search, request.url) : null;

  let response = rewriteUrl ? NextResponse.rewrite(rewriteUrl, { request }) : NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = rewriteUrl ? NextResponse.rewrite(rewriteUrl, { request }) : NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = effectivePath === '/admin/login';
  // Staff invite links land here directly. Supabase appends the session as
  // a URL fragment (#access_token=...), which never reaches the server —
  // only the browser can see it. So this route must stay reachable with no
  // cookie-based session yet; the page itself (client-side) picks up the
  // fragment, establishes the session, then does its own auth check.
  const isAcceptInviteRoute = effectivePath === '/admin/accept-invite';

  if (!isLoginRoute && !isAcceptInviteRoute && !user) {
    const loginUrl = new URL('/admin/login', request.url);
    // A stale/expired sb- cookie was present but getUser() rejected it —
    // distinct from a fresh visitor who was never signed in — so the login
    // page can show "your session expired" instead of a blank sign-in form.
    const hadSupabaseCookie = request.cookies.getAll().some((c) => c.name.startsWith('sb-'));
    if (hadSupabaseCookie) loginUrl.searchParams.set('expired', '1');
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute && user) {
    const { data: staff } = await supabase
      .from('staff_profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    return NextResponse.redirect(new URL(getDashboardRouteForRole(staff?.role ?? null), request.url));
  }

  // X-Robots-Tag is defense-in-depth, not a security control (see
  // robots.ts/admin's layout metadata for the primary crawler exclusion) —
  // this is the one header that genuinely differs by host/path, so it's
  // set here rather than in next.config.ts's static headers() (which has
  // no access to the request at build time).
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml)$).*)'],
};
