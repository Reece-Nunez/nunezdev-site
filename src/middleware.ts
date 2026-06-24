// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isPathAllowedForProspector, PROSPECTOR_HOME } from '@/lib/prospectorAccess';

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isDashboard = path.startsWith('/dashboard') || path.startsWith('/api/dashboard');
  const isApi = path.startsWith('/api');

  // Cheap short-circuit: a request without a Supabase auth cookie can't be an
  // authenticated owner or prospector, so there's nothing to enforce. Skipping
  // the (network) getUser() call keeps public pages, webhooks and cron routes
  // fast — important now that the matcher covers all of /api/*.
  const hasAuthCookie = req.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));

  if (!hasAuthCookie) {
    if (isDashboard) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('from', path);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  let res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: { headers: req.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Always let NextAuth endpoints pass (they must not be blocked by the
  // prospector allowlist below).
  if (path.startsWith('/api/auth')) return res;

  // Protect dashboard pages + their APIs: must be authenticated.
  if (isDashboard && !user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', path);
    return NextResponse.redirect(url);
  }

  // Deny-by-default backstop for the restricted `prospector` role. This is the
  // real guard for financial routes that still accept any org_member inline
  // (see the auth-drift note in authz.ts). The role flag lives on the JWT
  // (app_metadata), so this costs no extra DB query beyond getUser() above.
  if (user?.app_metadata?.role === 'prospector' && !isPathAllowedForProspector(path)) {
    if (isApi) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = PROSPECTOR_HOME;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
