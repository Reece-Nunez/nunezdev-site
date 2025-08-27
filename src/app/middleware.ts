// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

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
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid calling supabase.auth.getUser() or getSession() if user is not authenticated
  // These methods are expensive and shouldn't run on every request
  const { data: { user } } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;

  // protect all dashboard routes + APIs under it
  if (path.startsWith('/dashboard') || path.startsWith('/api/dashboard')) {
    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('from', path);
      return NextResponse.redirect(url);
    }
  }

  // Always let NextAuth endpoints pass (in case you add more)
  if (path.startsWith('/api/auth')) return res;

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/dashboard/:path*', '/api/auth/:path*'],
};
