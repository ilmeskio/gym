-- Demo workouts follow the example plan built into the app, which is not a row:
-- plan_id names the plan without a foreign key.

alter table public.workouts drop constraint workouts_plan_id_fkey;
