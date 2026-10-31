import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Route protection proxy for Forge Civic.
 * Protects municipal government command center routes.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Intercept /gov and sub-routes
  if (pathname.startsWith('/gov')) {
    const token =
      req.cookies.get('sb-access-token')?.value ||
      req.cookies.get('sb-token')?.value;

    const role = req.cookies.get('sb-user-role')?.value;

    // 1. Unauthenticated -> redirect to /auth with return URL
    if (!token) {
      const authUrl = new URL('/auth', req.url);
      authUrl.searchParams.set('redirect', '/gov');
      return NextResponse.redirect(authUrl);
    }

    // 2. Authenticated as non-gov citizen -> redirect to feed with security alert
    if (role === 'citizen') {
      const feedUrl = new URL('/', req.url);
      feedUrl.searchParams.set('unauthorized', 'gov');
      return NextResponse.redirect(feedUrl);
    }

    // 3. Authenticated as 'gov' -> proceed
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/gov', '/gov/:path*'],
};

