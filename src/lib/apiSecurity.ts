import { NextRequest, NextResponse } from 'next/server';

export const FORGE_CLIENT_HEADER = 'x-forge-client';
export const FORGE_CLIENT_SECRET = 'forge-next-frontend-v1';

export interface SecurityCheckResult {
  authorized: boolean;
  reason?: string;
}

/**
 * Validates that an incoming API request originates strictly from the Forge Next.js frontend,
 * blocking unauthorized external curl/script calls, third-party sites, and web scrapers.
 */
export function validateFrontendRequest(req: NextRequest): SecurityCheckResult {
  // 1. Validate internal frontend client signature header
  const clientToken = req.headers.get(FORGE_CLIENT_HEADER);
  if (clientToken !== FORGE_CLIENT_SECRET) {
    return {
      authorized: false,
      reason: 'Unauthorized client: Missing or invalid Forge frontend token.',
    };
  }

  // 2. Browser Sec-Fetch-Site protection (strictly block cross-site invocations)
  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite && secFetchSite === 'cross-site') {
    return {
      authorized: false,
      reason: 'Cross-site request blocked.',
    };
  }

  // 3. Verify Origin / Referer against Host
  const host = req.headers.get('host');
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return {
          authorized: false,
          reason: `Origin mismatch: request from ${originHost} rejected.`,
        };
      }
    } catch {
      return { authorized: false, reason: 'Malformed origin header.' };
    }
  }

  if (referer && host) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost !== host) {
        return {
          authorized: false,
          reason: `Referer mismatch: request from ${refererHost} rejected.`,
        };
      }
    } catch {
      return { authorized: false, reason: 'Malformed referer header.' };
    }
  }

  return { authorized: true };
}

/**
 * Convenience helper to return a standard 403 Forbidden Response
 */
export function forbiddenResponse(reason = 'Forbidden: Unauthorized API consumer') {
  return NextResponse.json(
    {
      error: reason,
      authorized: false,
      timestamp: new Date().toISOString(),
    },
    { status: 403 }
  );
}

