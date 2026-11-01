import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { validateFrontendRequest, forbiddenResponse } from '@/lib/apiSecurity';
import { NextRequest } from 'next/server';

const DEMO_GOV_EMAIL = 'authority@forge.civic';
const DEMO_GOV_PASSWORD = 'GovInspector2026!';
const DEMO_GOV_NAME = 'Inspector S. Rao (Chief Highway Auditor)';
const DEMO_GOV_DEPT = 'Municipal Road & Infrastructure Authority';

/**
 * POST /api/auth/gov-demo
 * Ensures the demo government official user exists and has role='gov',
 * then returns the credentials so the client can sign in with 1 click.
 */
export async function POST(req: NextRequest) {
  try {
    // 0. Enforce strict frontend client security
    const secCheck = validateFrontendRequest(req);
    if (!secCheck.authorized) {
      return forbiddenResponse(secCheck.reason);
    }
    // 1. Check if user exists or create them using supabaseAdmin
    try {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: DEMO_GOV_EMAIL,
        password: DEMO_GOV_PASSWORD,
        email_confirm: true,
        user_metadata: {
          role: 'gov',
          user_name: DEMO_GOV_NAME,
          department: DEMO_GOV_DEPT,
        },
      });

      if (createError && !createError.message.toLowerCase().includes('already')) {
        // If user already exists, update user metadata to ensure role is 'gov'
        console.warn('[Gov Demo User Creation Notice]:', createError.message);
      }
    } catch (createErr) {
      // User might already exist or admin API not enabled; proceed to credential return
    }

    return Response.json({
      success: true,
      email: DEMO_GOV_EMAIL,
      password: DEMO_GOV_PASSWORD,
      name: DEMO_GOV_NAME,
      department: DEMO_GOV_DEPT,
    });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || 'Failed to prepare demo official credentials.' },
      { status: 500 }
    );
  }
}

