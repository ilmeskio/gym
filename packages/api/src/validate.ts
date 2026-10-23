// Request bodies, checked field by field: a row gets exactly the known fields, or nothing.

import type { LoggedSet, Preferences, RepMax, Workout } from '@gymapp/log';

type Body = Record<string, unknown>;

const isObject = (v: unknown): v is Body => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const count = (v: unknown, min = 0): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) < 10_000;
const load = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 10_000;
const instant = (v: unknown): v is string => text(v, 40) && !Number.isNaN(Date.parse(v));
const day = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function workout(b: unknown): Workout | undefined {
  if (!isObject(b)) return;
  const { id, planId, dayId, week, startedAt, finishedAt, currentExercise, feedback, loggedLater } = b;
  if (!text(id) || !text(dayId) || !count(week, 1) || !instant(startedAt) || !count(currentExercise)) return;
  if (planId !== undefined && !text(planId)) return;
  if (finishedAt !== undefined && !instant(finishedAt)) return;
  if (feedback !== undefined) {
    if (!isObject(feedback) || !count(feedback.effort, 1) || feedback.effort > 5) return;
    if (feedback.note !== undefined && !text(feedback.note, 2000)) return;
  }
  if (loggedLater !== undefined && (!isObject(loggedLater) || !count(loggedLater.durationMin, 1))) return;
  return {
    id,
    ...(planId !== undefined && { planId }),
    dayId,
    week,
    startedAt,
    currentExercise,
    ...(finishedAt !== undefined && { finishedAt }),
    ...(isObject(feedback) && {
      feedback: {
        effort: feedback.effort as number,
        ...(feedback.note !== undefined && { note: feedback.note as string }),
      },
    }),
    ...(isObject(loggedLater) && { loggedLater: { durationMin: loggedLater.durationMin as number } }),
  };
}

export function set(b: unknown): LoggedSet | undefined {
  if (!isObject(b)) return;
  const { id, workoutId, exerciseId, number, kg, reps, loggedAt } = b;
  if (!text(id) || !text(workoutId) || !text(exerciseId) || !count(number, 1)) return;
  if (!load(kg) || !count(reps) || !instant(loggedAt)) return;
  return { id, workoutId, exerciseId, number, kg, reps, loggedAt };
}

export function repMax(b: unknown): RepMax | undefined {
  if (!isObject(b)) return;
  const { exerciseId, reps, kg, workoutId, foundAt } = b;
  if (!text(exerciseId) || !count(reps, 1) || !load(kg) || !instant(foundAt)) return;
  if (workoutId !== undefined && !text(workoutId)) return;
  return { exerciseId, reps, kg, foundAt, ...(workoutId !== undefined && { workoutId }) };
}

export function preferences(b: unknown): Preferences | undefined {
  if (!isObject(b) || !isObject(b.videos) || !isObject(b.planStarts)) return;
  const { planStarts, videos } = b;
  if (!Object.entries(planStarts).every(([k, v]) => text(k) && day(v))) return;
  if (!Object.entries(videos).every(([k, v]) => text(k) && text(v, 20))) return;
  return { planStarts: planStarts as Record<string, string>, videos: videos as Record<string, string> };
}
