import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Next.js 16 renamed Middleware to Proxy (same mechanism/file convention,
// new name). This refreshes the Supabase session cookie on every request
// and does an optimistic redirect for /admin routes. It is not the real
// security boundary — verifyAdminSession() in src/lib/supabase/dal.ts
// re-checks against Supabase Auth for actual data access.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
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

  const path = request.nextUrl.pathname;
  const isLoginRoute = path === '/admin/login';

  if (path.startsWith('/admin') && !isLoginRoute && !user) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  if (isLoginRoute && user) {
    return NextResponse.redirect(new URL('/admin/inquiries', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
