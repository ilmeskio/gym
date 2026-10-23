// The store on Supabase: the user's own token goes with every query, so Row Level Security
// still checks each row as a second guard behind the API.

import type { LoggedSet, RepMax, StoredPlan, Workout } from '@gymapp/log';
import { createClient } from '@supabase/supabase-js';
import type { Store, User } from './index.ts';

const BUCKET = 'plans';

type WorkoutRow = {
  id: string;
  plan_id: string | null;
  day_id: string;
  week: number;
  started_at: string;
  finished_at: string | null;
  current_exercise: number;
  effort: number | null;
  note: string | null;
  logged_duration_min: number | null;
};
type SetRow = {
  id: string;
  workout_id: string;
  exercise_id: string;
  number: number;
  kg: number;
  reps: number;
  logged_at: string;
};
type RepMaxRow = {
  exercise_id: string;
  reps: number;
  kg: number;
  workout_id: string | null;
  found_at: string;
};
type PreferencesRow = { plan_starts: string; videos: string };
type PlanRow = { id: string; created_at: string; active_since: string | null; content: string; excel: string | null };

const toWorkout = (r: WorkoutRow): Workout => ({
  id: r.id,
  ...(r.plan_id && { planId: r.plan_id }),
  dayId: r.day_id,
  week: r.week,
  startedAt: r.started_at,
  currentExercise: r.current_exercise,
  ...(r.finished_at && { finishedAt: r.finished_at }),
  ...(r.effort && { feedback: { effort: r.effort, ...(r.note && { note: r.note }) } }),
  ...(r.logged_duration_min && { loggedLater: { durationMin: r.logged_duration_min } }),
});

const toSet = (r: SetRow): LoggedSet => ({
  id: r.id,
  workoutId: r.workout_id,
  exerciseId: r.exercise_id,
  number: r.number,
  kg: Number(r.kg),
  reps: r.reps,
  loggedAt: r.logged_at,
});

const toRepMax = (r: RepMaxRow): RepMax => ({
  exerciseId: r.exercise_id,
  reps: r.reps,
  kg: Number(r.kg),
  foundAt: r.found_at,
  ...(r.workout_id && { workoutId: r.workout_id }),
});

const toPlan = (r: PlanRow): StoredPlan => ({
  id: r.id,
  createdAt: r.created_at,
  ...(r.active_since && { activeSince: r.active_since }),
  excel: !!r.excel,
  plan: JSON.parse(r.content),
});

/** Throws the query's error, so the API answers 500 and the app keeps the row queued. */
function ok<T>(response: { data: T; error: unknown }): T {
  if (response.error) throw response.error;
  return response.data;
}

export function supabaseStore({ url, key }: { url: string; key: string }) {
  return (user: User): Store => {
    const db = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${user.token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const excelPath = async (planId: string) => {
      const row = ok(await db.from('plans').select('excel').eq('id', planId).maybeSingle()) as {
        excel: string | null;
      } | null;
      return row?.excel ?? undefined;
    };

    return {
      async download() {
        const [workouts, sets, repMaxes, preferences, plans] = await Promise.all([
          db.from('workouts').select('*'),
          db.from('sets').select('*'),
          db.from('rep_maxes').select('*'),
          db.from('preferences').select('plan_starts, videos').maybeSingle(),
          db.from('plans').select('id, created_at, active_since, content, excel'),
        ]);
        const prefs = ok(preferences) as PreferencesRow | null;
        return {
          workouts: (ok(workouts) as WorkoutRow[]).map(toWorkout),
          sets: (ok(sets) as SetRow[]).map(toSet),
          repMaxes: (ok(repMaxes) as RepMaxRow[]).map(toRepMax),
          ...(prefs && {
            preferences: {
              planStarts: JSON.parse(prefs.plan_starts || '{}'),
              videos: JSON.parse(prefs.videos || '{}'),
            },
          }),
          plans: (ok(plans) as PlanRow[]).map(toPlan),
        };
      },

      async putWorkout(w) {
        ok(
          await db.from('workouts').upsert({
            id: w.id,
            user_id: user.id,
            plan_id: w.planId ?? null,
            day_id: w.dayId,
            week: w.week,
            started_at: w.startedAt,
            finished_at: w.finishedAt ?? null,
            current_exercise: w.currentExercise,
            effort: w.feedback?.effort ?? null,
            note: w.feedback?.note ?? null,
            logged_duration_min: w.loggedLater?.durationMin ?? null,
          }),
        );
      },
      async deleteWorkout(id) {
        ok(await db.from('workouts').delete().eq('id', id));
      },

      async putSet(s) {
        ok(
          await db.from('sets').upsert({
            id: s.id,
            user_id: user.id,
            workout_id: s.workoutId,
            exercise_id: s.exerciseId,
            number: s.number,
            kg: s.kg,
            reps: s.reps,
            logged_at: s.loggedAt,
          }),
        );
      },
      async deleteSet(id) {
        ok(await db.from('sets').delete().eq('id', id));
      },

      async putRepMax(r) {
        ok(
          await db.from('rep_maxes').upsert({
            user_id: user.id,
            exercise_id: r.exerciseId,
            reps: r.reps,
            kg: r.kg,
            workout_id: r.workoutId ?? null,
            found_at: r.foundAt,
          }),
        );
      },
      async deleteRepMax(exerciseId) {
        ok(await db.from('rep_maxes').delete().eq('exercise_id', exerciseId));
      },

      async putPreferences(p) {
        ok(
          await db.from('preferences').upsert({
            user_id: user.id,
            plan_starts: JSON.stringify(p.planStarts),
            videos: JSON.stringify(p.videos),
          }),
        );
      },

      async createPlan(p) {
        ok(
          await db.from('plans').insert({
            id: p.id,
            user_id: user.id,
            created_at: p.createdAt,
            active_since: p.activeSince ?? null,
            content: JSON.stringify(p.plan),
          }),
        );
      },
      async updatePlan(id, plan) {
        const rows = ok(
          await db
            .from('plans')
            .update({ content: JSON.stringify(plan) })
            .eq('id', id)
            .select('id'),
        );
        return !!rows?.length;
      },
      async activatePlan(id, at) {
        const rows = ok(await db.from('plans').update({ active_since: at }).eq('id', id).select('id'));
        return !!rows?.length;
      },

      async planFile(planId) {
        const path = await excelPath(planId);
        if (!path) return;
        const { data, error } = await db.storage.from(BUCKET).download(path);
        if (error || !data) return;
        return data.arrayBuffer();
      },
      async planFileLink(planId) {
        const path = await excelPath(planId);
        if (!path) return;
        const { data } = await db.storage.from(BUCKET).createSignedUrl(path, 600, { download: true });
        return data?.signedUrl;
      },
      async planUploadLink(planId) {
        // One file per plan, in the user's own folder: storage policies let only them in.
        const path = `${user.id}/${planId}.xlsx`;
        const rows = ok(await db.from('plans').update({ excel: path }).eq('id', planId).select('id'));
        if (!rows?.length) return;
        return ok(await db.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true }))?.signedUrl;
      },
    };
  };
}
