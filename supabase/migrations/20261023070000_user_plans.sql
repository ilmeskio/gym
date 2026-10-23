-- Each user has their own plans, written through the MCP. The plan is JSON in a text column,
-- as D1 would keep it; the active plan is the one activated last.

create table public.plans (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  active_since timestamptz,
  content text not null,
  -- Path of the original Excel file in the `plans` bucket, if attached.
  excel text
);

create index plans_user_id on public.plans (user_id);

alter table public.plans enable row level security;

create policy "own plans" on public.plans
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Workouts follow a plan; older ones get it when the user's plan is loaded.
alter table public.workouts add column plan_id uuid references public.plans on delete set null;

-- The start date becomes one per plan: a JSON object of plan id -> date, as text.
alter table public.preferences add column plan_starts text not null default '{}';

-- Excel files live under a folder per user: `<user id>/<plan id>.xlsx`.
drop policy "plans readable by email users" on storage.objects;

create policy "own plan files" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'plans'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false)
  )
  with check (
    bucket_id = 'plans'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false)
  );
