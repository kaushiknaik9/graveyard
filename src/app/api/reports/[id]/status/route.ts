import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { authenticateGovRequest } from '@/lib/serverAuth';
import { NextRequest } from 'next/server';

const VALID_STATUSES = ['Pending', 'Acknowledged', 'In Progress', 'Repaired'] as const;

/**
 * PATCH /api/reports/[id]/status
 * Updates the status of a report. Strictly restricted to verified municipal government officials.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Server-Side Role Gate: Strictly 'gov' ──
    const auth = await authenticateGovRequest(req);
    if (auth.status !== 200) {
      return Response.json(
        { error: auth.error || 'Access denied.' },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { status } = body;

    if (!VALID_STATUSES.includes(status)) {
      return Response.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const { data: updatedReport, error } = await supabaseAdmin
      .from('reports')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error || !updatedReport) {
      console.error('[Status Update Error]', error);
      return Response.json({ error: 'Incident report not found or failed to update.' }, { status: 404 });
    }

    // If status is 'In Progress', send a dispatch notification via Resend
    if (status === 'In Progress' && process.env.RESEND_API_KEY && process.env.DEFAULT_GOV_ALERT_EMAIL) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
            to: process.env.DEFAULT_GOV_ALERT_EMAIL,
            subject: `🔧 Repair Team Dispatched — Incident INC-${id.slice(0, 8)}`,
            html: `
              <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; background: #09090b; color: #fff; padding: 24px; border-radius: 16px;">
                <h1 style="font-size: 20px; margin: 0 0 4px;">🔧 Repair Team Dispatched</h1>
                <p style="color: #a1a1aa; font-size: 13px;">Authorized by official ${auth.user?.email}</p>
                <div style="margin-top: 16px; padding: 12px; background: #18181b; border-radius: 10px;">
                  <p style="color: #d4d4d8; font-size: 13px; margin: 0;">Incident: INC-${id.slice(0, 8)}</p>
                  <p style="color: #d4d4d8; font-size: 13px; margin: 4px 0 0;">Location: ${updatedReport.latitude?.toFixed(4)}, ${updatedReport.longitude?.toFixed(4)}</p>
                  <p style="color: #d4d4d8; font-size: 13px; margin: 4px 0 0;">Severity: ${updatedReport.severity}</p>
                </div>
                <a href="https://www.google.com/maps?q=${updatedReport.latitude},${updatedReport.longitude}" style="display: block; text-align: center; padding: 12px; background: linear-gradient(135deg, #60a5fa, #3b82f6); color: #fff; font-weight: 700; font-size: 13px; border-radius: 10px; text-decoration: none; margin-top: 16px;">
                  📍 Open Live Location
                </a>
              </div>
            `,
          }),
        });
      } catch (emailErr) {
        console.error('[Dispatch Email Error]', emailErr);
      }
    }

    return Response.json({ report: updatedReport }, { status: 200 });
  } catch (error: any) {
    console.error('[Status API Error]', error);
    return Response.json({ error: error?.message || 'Server error.' }, { status: 500 });
  }
}
