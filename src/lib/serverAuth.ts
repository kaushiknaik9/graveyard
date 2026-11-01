import { NextRequest } from 'next/server';
import { authenticateRequest as guardAuth, authenticateGovRequest as guardGovAuth } from './authGuard';
import type { User } from '@supabase/supabase-js';

export interface AuthResult {
  user: User | null;
  role: 'citizen' | 'gov' | null;
  error: string | null;
  status: 200 | 401 | 403;
}

/**
 * Backward-compatible wrapper for existing routes.
 */
export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  const result = await guardAuth(req);
  if (!result.success) {
    const errorBody = await result.response.json().catch(() => ({ error: 'Unauthorized' }));
    return {
      user: null,
      role: null,
      error: errorBody.error || 'Unauthorized',
      status: (result.response.status as 401 | 403) || 401,
    };
  }

  return {
    user: result.context.user,
    role: result.context.role,
    error: null,
    status: 200,
  };
}

/**
 * Requires strictly 'gov' role.
 */
export async function authenticateGovRequest(req: NextRequest): Promise<AuthResult> {
  const result = await guardGovAuth(req);
  if (!result.success) {
    const errorBody = await result.response.json().catch(() => ({ error: 'Forbidden' }));
    return {
      user: null,
      role: null,
      error: errorBody.error || 'Forbidden',
      status: (result.response.status as 401 | 403) || 403,
    };
  }

  return {
    user: result.context.user,
    role: result.context.role,
    error: null,
    status: 200,
  };
}
