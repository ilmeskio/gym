-- Tables, columns, constraints and policies get English names; the data stays as it is.

alter table public.allenamenti rename to workouts;
alter table public.workouts rename column giorno_id to day_id;
alter table public.workouts rename column settimana to week;
alter table public.workouts rename column iniziato_il to started_at;
alter table public.workouts rename column concluso_il to finished_at;
alter table public.workouts rename column esercizio_corrente to current_exercise;
alter table public.workouts rename column fatica to effort;
alter table public.workouts rename column nota to note;
alter table public.workouts rename column durata_inserita to logged_duration_min;
alter table public.workouts rename constraint allenamenti_pkey to workouts_pkey;
alter table public.workouts rename constraint allenamenti_user_id_fkey to workouts_user_id_fkey;
alter table public.workouts rename constraint allenamenti_fatica_check to workouts_effort_check;
alter table public.workouts rename constraint allenamenti_durata_inserita_check to workouts_logged_duration_min_check;
alter policy "i propri allenamenti" on public.workouts rename to "own workouts";

alter table public.serie rename to sets;
alter table public.sets rename column allenamento_id to workout_id;
alter table public.sets rename column esercizio_id to exercise_id;
alter table public.sets rename column numero to number;
alter table public.sets rename column ripetizioni to reps;
alter table public.sets rename column registrata_il to logged_at;
alter table public.sets rename constraint serie_pkey to sets_pkey;
alter table public.sets rename constraint serie_user_id_fkey to sets_user_id_fkey;
alter table public.sets rename constraint serie_allenamento_id_fkey to sets_workout_id_fkey;
alter table public.sets rename constraint serie_kg_check to sets_kg_check;
alter index public.serie_allenamento_id rename to sets_workout_id;
alter policy "le proprie serie" on public.sets rename to "own sets";

alter table public.rm rename to rep_maxes;
alter table public.rep_maxes rename column esercizio_id to exercise_id;
alter table public.rep_maxes rename column ripetizioni to reps;
alter table public.rep_maxes rename column allenamento_id to workout_id;
alter table public.rep_maxes rename column trovato_il to found_at;
alter table public.rep_maxes rename constraint rm_pkey to rep_maxes_pkey;
alter table public.rep_maxes rename constraint rm_user_id_fkey to rep_maxes_user_id_fkey;
alter table public.rep_maxes rename constraint rm_allenamento_id_fkey to rep_maxes_workout_id_fkey;
alter table public.rep_maxes rename constraint rm_kg_check to rep_maxes_kg_check;
alter policy "i propri rm" on public.rep_maxes rename to "own rep maxes";

alter table public.preferenze rename to preferences;
alter table public.preferences rename column inizio to start_date;
alter table public.preferences rename column video to videos;
alter table public.preferences rename constraint preferenze_pkey to preferences_pkey;
alter table public.preferences rename constraint preferenze_user_id_fkey to preferences_user_id_fkey;
alter policy "le proprie preferenze" on public.preferences rename to "own preferences";

-- The plan's Excel file moves to the `plans` bucket, readable by whoever signed in with an email.
insert into storage.buckets (id, name, public) values ('plans', 'plans', false);

create policy "plans readable by email users" on storage.objects
  for select to authenticated
  using (bucket_id = 'plans' and not coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false));
