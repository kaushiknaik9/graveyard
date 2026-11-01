import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { validateFrontendRequest, forbiddenResponse } from '@/lib/apiSecurity';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const BACKUP_FILE = path.join(process.cwd(), 'data', 'reports.json');

function getLocalBackupReports(): any[] {
  try {
    if (fs.existsSync(BACKUP_FILE)) {
      return JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

/**
 * GET /api/reports
 * Unified resilient data layer: fetches reports from Supabase PostgreSQL,
 * falling back to local persistent disk backup if database is unreachable.
 */
export async function GET(req: NextRequest) {
  try {
    // 0. Enforce strict frontend client security
    const secCheck = validateFrontendRequest(req);
    if (!secCheck.authorized) {
      return forbiddenResponse(secCheck.reason);
    }
    const { data, error } = await supabaseAdmin
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return Response.json({ reports: data, source: 'supabase' }, { status: 200 });
    }

    if (error) {
      console.warn('[Supabase Reports Fetch Notice]:', error.message);
    }

    // Merge or fallback to local disk backup
    const backup = getLocalBackupReports();
    return Response.json({ reports: data && data.length > 0 ? data : backup, source: data ? 'supabase' : 'backup' }, { status: 200 });
  } catch (err: any) {
    console.error('[Reports API Server Error]', err.message);
    return Response.json({ reports: getLocalBackupReports(), source: 'backup' }, { status: 200 });
  }
}
