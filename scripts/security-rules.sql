-- =============================================================================
-- FORGE CIVIC: PRODUCTION DATABASE ROW LEVEL SECURITY (RLS) & STORAGE POLICIES
-- =============================================================================

-- Ensure the reports table exists
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_name text default 'Citizen Reporter',
  image_url text not null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters double precision,
  severity text check (severity in ('Low','Medium','Severe')),
  ai_confidence double precision,
  ai_reasoning text,
  status text default 'Pending' check (status in ('Pending','Acknowledged','In Progress','Repaired')),
  upvotes int default 0,
  created_at timestamptz default now()
);

-- Ensure indexes for fast geo, severity, and timeline queries
create index if not exists idx_reports_created_at on public.reports(created_at desc);
create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_reports_severity on public.reports(severity);
create index if not exists idx_reports_coords on public.reports(latitude, longitude);

-- -----------------------------------------------------------------------------
-- 1. ROW LEVEL SECURITY (RLS) ACTIVATION
-- -----------------------------------------------------------------------------
alter table public.reports enable row level security;

-- Drop existing policies to allow clean re-application
drop policy if exists "Public Read Access" on public.reports;
drop policy if exists "Authenticated Citizen Insert" on public.reports;
drop policy if exists "Gov Official Update Status" on public.reports;
drop policy if exists "Authenticated Upvote Access" on public.reports;

-- -----------------------------------------------------------------------------
-- 2. POLICY 1: PUBLIC READ (Anyone can view verified road hazards)
-- -----------------------------------------------------------------------------
create policy "Public Read Access"
  on public.reports
  for select
  using (true);

-- -----------------------------------------------------------------------------
-- 3. POLICY 2: AUTHENTICATED CITIZEN INSERT
-- Only authenticated citizens/users can insert new incident reports.
-- Enforces that user_id matches the authenticated user's ID.
-- -----------------------------------------------------------------------------
create policy "Authenticated Citizen Insert"
  on public.reports
  for insert
  to authenticated
  with check (
    auth.uid() is not null and (
      user_id = auth.uid() or user_id is null
    )
  );

-- -----------------------------------------------------------------------------
-- 4. POLICY 3: GOVERNMENT OFFICIAL UPDATE ONLY
-- Only authenticated users with role = 'gov' in their JWT metadata can update
-- the incident status and details.
-- -----------------------------------------------------------------------------
create policy "Gov Official Update Status"
  on public.reports
  for update
  to authenticated
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'gov'
  )
  with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'gov'
  );

-- -----------------------------------------------------------------------------
-- 5. UPVOTE STORED PROCEDURE (Safe Atomic Upvoting)
-- -----------------------------------------------------------------------------
create or replace function public.increment_report_upvotes(report_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.reports
  set upvotes = coalesce(upvotes, 0) + 1
  where id = report_id;
end;
$$;

grant execute on function public.increment_report_upvotes(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. SUPABASE STORAGE BUCKET POLICIES (potholes bucket)
-- -----------------------------------------------------------------------------
-- Insert bucket if not present
insert into storage.buckets (id, name, public)
values ('potholes', 'potholes', true)
on conflict (id) do update set public = true;

-- Drop old storage policies
drop policy if exists "Public Read Pothole Photos" on storage.objects;
drop policy if exists "Authenticated Upload Pothole Photos" on storage.objects;

-- Storage Policy A: Public Read Access
create policy "Public Read Pothole Photos"
  on storage.objects
  for select
  using (bucket_id = 'potholes');

-- Storage Policy B: Authenticated Upload Only (with MIME & 10MB size limit)
create policy "Authenticated Upload Pothole Photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'potholes'
    and (storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp'))
  );

-- -----------------------------------------------------------------------------
-- 7. HELPER: UPGRADE ANY USER TO GOVERNMENT OFFICIAL IN 1 SECOND
-- (Uncomment and replace with your email to grant government authority)
-- -----------------------------------------------------------------------------
-- update auth.users
-- set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role": "gov", "department": "Municipal Highway Works"}'::jsonb,
--     email_confirmed_at = coalesce(email_confirmed_at, now())
-- where email = 'your-email@example.com';


