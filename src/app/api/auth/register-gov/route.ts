import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { validateFrontendRequest, forbiddenResponse } from '@/lib/apiSecurity';
import { NextRequest } from 'next/server';

const OFFICIAL_PASSCODE = 'FORGE-GOV-2026';

/**
 * POST /api/auth/register-gov
 * Registers a new Government Official with role='gov' and auto-confirms email.
 * Requires the municipal authorization passcode: FORGE-GOV-2026
 */
export async function POST(req: NextRequest) {
  try {
    // 0. Enforce strict frontend client security
    const secCheck = validateFrontendRequest(req);
    if (!secCheck.authorized) {
      return forbiddenResponse(secCheck.reason);
    }
    const body = await req.json().catch(() => ({}));
    const { email, password, name, department, passcode } = body;

    if (!email || !password) {
      return Response.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return Response.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    if ((passcode || '').trim().toUpperCase() !== OFFICIAL_PASSCODE) {
      return Response.json(
        { error: `Invalid Official Passcode. Please enter the authorized municipal access code (${OFFICIAL_PASSCODE}).` },
        { status: 403 }
      );
    }

    // Try creating official account with email_confirm: true via supabaseAdmin
    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: 'gov',
          user_name: name || 'Municipal Authority',
          department: department || 'Municipal Road Safety Dept',
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes('already')) {
          return Response.json(
            { error: 'An account with this email already exists. Please sign in instead.' },
            { status: 400 }
          );
        }
        throw error;
      }

      return Response.json({
        success: true,
        message: 'Government Official account registered and verified. You may now sign in.',
      });
    } catch (adminError: any) {
      // Fallback: if service role admin API is unavailable, return guidance
      console.warn('[Admin Create User Fallback Notice]:', adminError?.message);
      return Response.json(
        { error: adminError?.message || 'Failed to register official account. Please check Supabase credentials.' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return Response.json(
      { error: error?.message || 'Server error.' },
      { status: 500 }
    );
  }
}

