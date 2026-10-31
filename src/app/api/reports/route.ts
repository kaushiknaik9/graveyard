import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports
 * Fetches all verified hazard reports from Supabase database.
 */
export async function GET(_req: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Reports Fetch Error]', error);
      return Response.json({ reports: [] }, { status: 200 });
    }

    return Response.json({ reports: data || [] }, { status: 200 });
  } catch (err: any) {
    console.error('[Reports API Server Error]', err);
    return Response.json({ reports: [] }, { status: 500 });
  }
}
