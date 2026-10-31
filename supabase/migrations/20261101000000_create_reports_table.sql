-- =============================================================================
-- FORGE CIVIC: PRODUCTION DATABASE MIGRATION
-- =============================================================================

-- 1. Create reports table
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

-- 2. Create upvotes table to enforce: ONE USER CAN ONLY VOTE ONCE PER REPORT
create table if not exists public.report_upvotes (
  report_id uuid references public.reports(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (report_id, user_id)
);

create index if not exists idx_report_upvotes_user on public.report_upvotes(user_id);
create index if not exists idx_report_upvotes_report on public.report_upvotes(report_id);

-- 3. Indexes for fast feed & geo queries
create index if not exists idx_reports_created_at on public.reports(created_at desc);
create index if not exists idx_reports_status on public.reports(status);
create index if not exists idx_reports_severity on public.reports(severity);
create index if not exists idx_reports_coords on public.reports(latitude, longitude);

-- 4. Enable Row Level Security (RLS)
alter table public.reports enable row level security;
alter table public.report_upvotes enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Public Read Access" on public.reports;
drop policy if exists "Authenticated Citizen Insert" on public.reports;
drop policy if exists "Gov Official Update Status" on public.reports;

drop policy if exists "Public Read Upvotes" on public.report_upvotes;
drop policy if exists "Authenticated Insert Upvote" on public.report_upvotes;

-- Policy A: Anyone can view road reports
create policy "Public Read Access"
  on public.reports
  for select
  using (true);

-- Policy B: Only logged-in users can report hazards
create policy "Authenticated Citizen Insert"
  on public.reports
  for insert
  to authenticated
  with check (
    auth.uid() is not null and (user_id = auth.uid() or user_id is null)
  );

-- Policy C: Only users with role = 'gov' can update status
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

-- Upvote policies
create policy "Public Read Upvotes"
  on public.report_upvotes
  for select
  using (true);

create policy "Authenticated Insert Upvote"
  on public.report_upvotes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 5. Safe atomic upvoting procedure (prevents duplicates)
create or replace function public.record_report_upvote(target_report_id uuid, target_user_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  already_voted boolean;
  new_count int;
begin
  select exists (
    select 1 from public.report_upvotes
    where report_id = target_report_id and user_id = target_user_id
  ) into already_voted;

  if already_voted then
    return json_build_object('success', false, 'already_voted', true, 'message', 'You have already confirmed this road hazard.');
  end if;

  insert into public.report_upvotes (report_id, user_id)
  values (target_report_id, target_user_id);

  update public.reports
  set upvotes = coalesce(upvotes, 0) + 1
  where id = target_report_id
  returning upvotes into new_count;

  return json_build_object('success', true, 'already_voted', false, 'upvotes', new_count);
end;
$$;

grant execute on function public.record_report_upvote(uuid, uuid) to authenticated;

-- 6. Ensure Storage Bucket "potholes" exists
insert into storage.buckets (id, name, public)
values ('potholes', 'potholes', true)
on conflict (id) do update set public = true;

drop policy if exists "Public Read Pothole Photos" on storage.objects;
drop policy if exists "Authenticated Upload Pothole Photos" on storage.objects;

create policy "Public Read Pothole Photos"
  on storage.objects
  for select
  using (bucket_id = 'potholes');

create policy "Authenticated Upload Pothole Photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'potholes'
    and (storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp'))
  );
