-- =============================================================================
-- MIGRATION: ADD GEOSPATIAL ADDRESS, WARD, AND RESOLUTION AUDIT COLUMNS
-- =============================================================================

alter table public.reports
  add column if not exists address text,
  add column if not exists ward text,
  add column if not exists assigned_zone text,
  add column if not exists assigned_office text,
  add column if not exists estimated_diameter_cm int,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists dispatched_at timestamptz,
  add column if not exists resolution_at timestamptz,
  add column if not exists resolution_note text,
  add column if not exists resolution_image_url text,
  add column if not exists resolution_officer text;

-- Add index on ward for municipal filtering
create index if not exists idx_reports_ward on public.reports(ward);
create index if not exists idx_reports_assigned_zone on public.reports(assigned_zone);

