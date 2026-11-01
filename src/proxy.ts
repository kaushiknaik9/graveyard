import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Route protection proxy for Forge Civic.
 * Strictly enforces role-based URL access control:
 * - Unauthenticated users are redirected to /auth and cannot access the feed or gov inbox.
 * - Citizens can only access the feed / and are forbidden from /gov.
 * - Municipal officials can access both / and /gov.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token =
    req.cookies.get('sb-access-token')?.value ||
    req.cookies.get('sb-token')?.value;

  const role = req.cookies.get('sb-user-role')?.value;

  // 1. Root Citizen Feed /
  // Only authenticated citizens and municipal officials can access
  if (pathname === '/') {
    if (!token) {
      const authUrl = new URL('/auth', req.url);
      return NextResponse.redirect(authUrl);
    }
    return NextResponse.next();
  }

  // 2. Municipal Command Center /gov and sub-routes
  // ONLY authenticated 'gov' accounts can access
  if (pathname.startsWith('/gov')) {
    if (!token) {
      const authUrl = new URL('/auth', req.url);
      authUrl.searchParams.set('redirect', '/gov');
      return NextResponse.redirect(authUrl);
    }

    // Citizens attempting to access /gov by URL are strictly redirected to /
    if (role === 'citizen') {
      const feedUrl = new URL('/', req.url);
      return NextResponse.redirect(feedUrl);
    }

    return NextResponse.next();
  }

  // 3. Auth Page /auth
  // If already authenticated, redirect to appropriate landing page
  if (pathname === '/auth') {
    if (token) {
      if (role === 'gov') {
        return NextResponse.redirect(new URL('/gov', req.url));
      }
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/gov', '/gov/:path*', '/auth'],
};
