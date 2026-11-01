import { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabaseAdmin';
import type { User } from '@supabase/supabase-js';

export interface AuthContext {
  user: User;
  userId: string;
  userName: string;
  role: 'citizen' | 'gov';
}

export type AuthGuardResult =
  | { success: true; context: AuthContext }
  | { success: false; response: Response };

/**
 * Extracts the session token from Authorization: Bearer <token>
 * or standard sb-access-token cookies.
 */
function extractToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }

  // Fallback to cookie
  const cookieToken =
    req.cookies.get('sb-access-token')?.value ||
    req.cookies.get('sb-token')?.value;

  return cookieToken?.trim() || null;
}

/**
 * Validates inbound request authentication for any citizen or official.
 * Returns 401 Unauthorized Response on failure.
 */
export async function authenticateRequest(req: NextRequest): Promise<AuthGuardResult> {
  const token = extractToken(req);

  if (!token) {
    return {
      success: false,
      response: Response.json(
        { error: 'Authentication required. Please sign in to continue.' },
        { status: 401 }
      ),
    };
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return {
        success: false,
        response: Response.json(
          { error: 'Session expired or invalid. Please sign in again.' },
          { status: 401 }
        ),
      };
    }

    const role = (user.user_metadata?.role as 'citizen' | 'gov') || 'citizen';
    const userName =
      user.user_metadata?.user_name ||
      user.email?.split('@')[0] ||
      'Citizen Reporter';

    return {
      success: true,
      context: {
        user,
        userId: user.id,
        userName,
        role,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      response: Response.json(
        { error: 'Authentication service unavailable.' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Validates inbound request strictly for authenticated citizens.
 * Rejects unauthenticated callers with 401, and rejects gov officials with 403.
 * (Municipal officials cannot report road hazards; only citizens can).
 */
export async function authenticateCitizenRequest(req: NextRequest): Promise<AuthGuardResult> {
  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    return authResult;
  }

  if (authResult.context.role !== 'citizen') {
    return {
      success: false,
      response: Response.json(
        { error: 'Forbidden: Road hazard reporting is strictly reserved for verified citizens. Municipal accounts cannot upload reports.' },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

/**
 * Validates inbound request strictly for authorized municipal government officials.
 * Rejects unauthenticated callers with 401, non-gov citizens with 403 Forbidden.
 */
export async function authenticateGovRequest(req: NextRequest): Promise<AuthGuardResult> {
  const authResult = await authenticateRequest(req);
  if (!authResult.success) {
    return authResult;
  }

  if (authResult.context.role !== 'gov') {
    return {
      success: false,
      response: Response.json(
        { error: 'Forbidden. Municipal government authority credentials required.' },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

