create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
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
create storage bucket potholes public;
