import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { authenticateRequest } from '@/lib/serverAuth';
import { validateFrontendRequest, forbiddenResponse } from '@/lib/apiSecurity';
import { NextRequest } from 'next/server';

/**
 * POST /api/reports/[id]/upvote
 * Increments the confirmation/upvote count on a report.
 * Strictly enforces ONE VOTE PER CITIZEN.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 0. Enforce strict frontend client security
    const secCheck = validateFrontendRequest(req);
    if (!secCheck.authorized) {
      return forbiddenResponse(secCheck.reason);
    }
    const auth = await authenticateRequest(req);
    if (auth.status !== 200 || !auth.user) {
      return Response.json(
        { error: 'Please sign in to confirm and upvote this road hazard report.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const userId = auth.user.id;

    // ── 1. Check if user has already upvoted this hazard report ──
    const { data: existingVote } = await supabaseAdmin
      .from('report_upvotes')
      .select('created_at')
      .eq('report_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingVote) {
      return Response.json(
        { error: 'You have already confirmed and upvoted this hazard report. One vote per citizen is permitted.' },
        { status: 409 }
      );
    }

    // ── 2. Record vote in report_upvotes (Primary key prevents duplicate votes) ──
    const { error: insertVoteError } = await supabaseAdmin
      .from('report_upvotes')
      .insert({ report_id: id, user_id: userId });

    if (insertVoteError) {
      return Response.json(
        { error: 'You have already confirmed this hazard report.' },
        { status: 409 }
      );
    }

    // ── 3. Fetch current count and increment ──
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('reports')
      .select('upvotes')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return Response.json({ error: 'Report not found.' }, { status: 404 });
    }

    const newUpvotes = (current.upvotes || 0) + 1;

    const { data: updatedReport, error: updateError } = await supabaseAdmin
      .from('reports')
      .update({ upvotes: newUpvotes })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updatedReport) {
      return Response.json({ error: 'Failed to update confirmation count.' }, { status: 500 });
    }

    return Response.json(
      {
        success: true,
        report: updatedReport,
        message: 'Your confirmation has been recorded.',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Upvote API Error]', error);
    return Response.json({ error: error?.message || 'Server error while processing vote.' }, { status: 500 });
  }
}
