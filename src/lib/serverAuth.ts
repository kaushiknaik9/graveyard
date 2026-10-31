import { supabaseAdmin } from './supabaseAdmin';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

export interface AuthResult {
  user: User | null;
  role: 'citizen' | 'gov' | null;
  error: string | null;
  status: 200 | 401 | 403;
}

/**
 * Extracts and verifies the Bearer token from the incoming request.
 * Returns the verified user and their server-validated role.
 */
export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      role: null,
      error: 'Authentication required. Missing Bearer token.',
      status: 401,
    };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return {
      user: null,
      role: null,
      error: 'Authentication required. Empty token.',
      status: 401,
    };
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return {
        user: null,
        role: null,
        error: error?.message || 'Invalid or expired session token.',
        status: 401,
      };
    }

    // Role is extracted securely from server-verified user metadata
    const userRole = (user.user_metadata?.role as 'citizen' | 'gov') || 'citizen';

    return {
      user,
      role: userRole,
      error: null,
      status: 200,
    };
  } catch (err: any) {
    return {
      user: null,
      role: null,
      error: err.message || 'Token verification failed.',
      status: 401,
    };
  }
}

/**
 * Requires strictly 'gov' role. Rejects citizens with 403 Forbidden.
 */
export async function authenticateGovRequest(req: NextRequest): Promise<AuthResult> {
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return auth;
  }

  if (auth.role !== 'gov') {
    return {
      user: auth.user,
      role: auth.role,
      error: 'Forbidden. Municipal government authority credentials required.',
      status: 403,
    };
  }

  return auth;
}

