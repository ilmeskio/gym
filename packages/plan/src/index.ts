// The training plan and the rules for reading it.
// Prescriptions stay free text, as the trainer writes them:
// the functions below extract only what the app needs (sets, target, rest).

import type { ExerciseMedia } from './media.ts';

export type Prescription = {
  load?: string;
  setsReps?: string;
  rest?: string;
  tut?: string;
  rir?: string;
};

export type Exercise = {
  /** Unique in the plan: logged sets refer to it. */
  id: string;
  name: string;
  media?: ExerciseMedia;
  /** When to send the trainer a video of your own execution ("ultima serie"). */
  videoToSend?: string;
  notes?: string;
  compensation?: string;
  /** One entry per week; an empty field keeps the previous week's value. */
  weeks: Prescription[];
};

export type Day = { id: string; title: string; exercises: Exercise[] };

export type Plan = {
  title: string;
  startDate: string;
  weekCount: number;
  days: Day[];
};

export type Range = { min: number; max: number };

export type Target = ({ kind: 'reps' } & Range) | ({ kind: 'seconds' } & Range) | { kind: 'max' };

export type SetsReading = { sets?: Range; target?: Target; note?: string };

const range = (min: string, max?: string): Range => ({
  min: Number(min),
  max: Number(max ?? min),
});

const SETS = /^(\d+)(?:\/(\d+))?\s*x\s*(?:(max)|(\d+)(?:\/(\d+))?\s*(")?)/i;

export function readSets(text: string | undefined): SetsReading {
  const clean = text?.trim();
  if (!clean) return {};
  const m = SETS.exec(clean);
  if (!m) return { note: clean };
  const [whole, setsMin, setsMax, max, repsMin, repsMax, seconds] = m;
  const target: Target = max ? { kind: 'max' } : { kind: seconds ? 'seconds' : 'reps', ...range(repsMin, repsMax) };
  const reading: SetsReading = { sets: range(setsMin, setsMax), target };
  const note = clean.slice(whole.length).trim();
  if (note) reading.note = note;
  return reading;
}

const REST = /^(?:(\d+)')?\s*(?:(\d+)"?)?$/;

/** Converts a rest like `1'30`, `2'` or `40"` into seconds. */
export function readRest(text: string | undefined): number | undefined {
  const clean = text?.trim();
  if (!clean) return undefined;
  const m = REST.exec(clean);
  if (!m || (!m[1] && !m[2])) return undefined;
  const minutes = Number(m[1] ?? 0);
  const seconds = Number(m[2] ?? 0);
  // In `1'30` the seconds follow the minutes; `40"` or a bare `40` are seconds.
  return minutes * 60 + seconds;
}

const FIELDS = ['load', 'setsReps', 'rest', 'tut', 'rir'] as const;

// These hold only in the week they appear: "trova 12 rm" and the "limitati a questo"
// that goes with it are that week's task; afterwards the load found applies.
const THAT_WEEK_ONLY: Partial<Record<(typeof FIELDS)[number], RegExp>> = {
  load: /^trova/i,
  setsReps: /^limitati/i,
};

/** The prescription for a week (1-based), filled in with what carries over from earlier weeks. */
export function prescription(exercise: Exercise, week: number): Prescription {
  const result: Prescription = {};
  for (const entry of exercise.weeks.slice(0, week)) {
    for (const field of FIELDS) {
      const value = entry[field];
      if (value) result[field] = value;
      else if (THAT_WEEK_ONLY[field]?.test(result[field] ?? '')) delete result[field];
    }
  }
  return result;
}

export type Step = {
  exercise: Exercise;
  /** 1-based position in the session. */
  position: number;
  total: number;
  prescription: Prescription;
  sets: SetsReading;
  restSeconds?: number;
  /** This week the maximum load for N reps (N RM) has to be found. */
  findRepMax?: number;
  /** The load to use is the N RM found in an earlier week. */
  useRepMax?: number;
};

const REP_MAX_SEARCH = /^trova\s*(\d+)\s*rm/i;

/** The number of reps of a load like "trova 12 rm", if it is one. */
export function readRepMaxSearch(load: string | undefined): number | undefined {
  const m = REP_MAX_SEARCH.exec(load?.trim() ?? '');
  return m ? Number(m[1]) : undefined;
}

/** The kg of a load written as `8/10 kg` or `45kg` (the first number); nothing if it is not in kg. */
export function kgFromPlan(load: string | undefined): number | undefined {
  const m = /^(\d+(?:[.,]\d+)?)(?:\/\d+(?:[.,]\d+)?)?\s*kg\b/i.exec(load?.trim() ?? '');
  return m ? Number(m[1].replace(',', '.')) : undefined;
}

export type RepMaxAdvice = 'increase' | 'found' | 'decrease';

/** After a search set: the load is right when the reps done are exactly N. */
export function repMaxAdvice(target: number, reps: number): RepMaxAdvice {
  if (reps > target) return 'increase';
  if (reps < target) return 'decrease';
  return 'found';
}

function lastRepMaxSearch(exercise: Exercise, week: number): number | undefined {
  for (let i = week - 2; i >= 0; i--) {
    const n = readRepMaxSearch(exercise.weeks[i]?.load);
    if (n !== undefined) return n;
  }
  return undefined;
}

/** A day's exercises, in order, with the prescription of the chosen week. */
export function session(plan: Plan, dayId: string, week: number): Step[] {
  const day = plan.days.find((d) => d.id === dayId);
  if (!day) throw new Error(`Day ${dayId} is not in the plan`);
  if (week < 1 || week > plan.weekCount) {
    throw new Error(`Week ${week} is outside the plan (1-${plan.weekCount})`);
  }
  return day.exercises.map((exercise, index) => {
    const p = prescription(exercise, week);
    return {
      exercise,
      position: index + 1,
      total: day.exercises.length,
      prescription: p,
      sets: readSets(p.setsReps),
      restSeconds: readRest(p.rest),
      findRepMax: readRepMaxSearch(p.load),
      useRepMax: p.load ? undefined : lastRepMaxSearch(exercise, week),
    };
  });
}

/** What else a step asks besides sets and load, in words to show before starting. */
export function stepDetails({ prescription: p, exercise }: Step): string[] {
  return [
    p.rest && `recupero ${p.rest.trim()}`,
    p.tut && `TUT ${p.tut.trim()}`,
    p.rir && `RIR ${p.rir.trim()}`,
    exercise.notes?.trim(),
  ].filter((d): d is string => !!d);
}

/** The current week (1-based), counting from the start date (`YYYY-MM-DD`). */
export function currentWeek(startDate: string | undefined, today: Date, weekCount: number): number {
  if (!startDate) return 1;
  const [y, m, d] = startDate.split('-').map(Number);
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Rounding absorbs the hour gained or lost at daylight saving changes.
  const days = Math.round((midnight.getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000);
  return Math.min(Math.max(Math.floor(days / 7) + 1, 1), weekCount);
}

/** Today's date as `YYYY-MM-DD`, in the device's time zone. */
export function todayDate(today = new Date()): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${today.getFullYear()}-${two(today.getMonth() + 1)}-${two(today.getDate())}`;
}

export { demos, findAnimations, gifUrl, youtubeId, youtubeSearch } from './media.ts';
export { cuesBetween, PREPARE_SECONDS, timerAt } from './timer.ts';
export type { Cue, Phase, TimerState } from './timer.ts';
export type { Demo, ExerciseMedia, Gif } from './media.ts';

export type PlanProblems = {
  /** The plan cannot be used as it is. */
  errors: string[];
  /** The app can follow the plan, but some parts only as notes. */
  warnings: string[];
};

/** What keeps the app from following a plan, in words for whoever wrote it. */
export function planProblems(plan: Plan): PlanProblems {
  const errors: string[] = [];
  const warnings: string[] = [];
  const dayIds = new Set<string>();
  const exerciseIds = new Set<string>();

  for (const day of plan.days) {
    if (dayIds.has(day.id)) errors.push(`Il giorno "${day.id}" compare più volte.`);
    dayIds.add(day.id);
    for (const exercise of day.exercises) {
      const name = exercise.id;
      if (exerciseIds.has(name)) {
        errors.push(`L'esercizio "${name}" compare più volte: gli id degli esercizi devono essere unici.`);
      }
      exerciseIds.add(name);
      if (exercise.weeks.length > plan.weekCount) {
        errors.push(`"${name}" ha ${exercise.weeks.length} settimane, la scheda ${plan.weekCount}.`);
      }
      exercise.weeks.forEach((week, i) => {
        const where = `"${name}", settimana ${i + 1}`;
        const sets = week.setsReps?.trim();
        if (sets && !readSets(sets).sets && !THAT_WEEK_ONLY.setsReps?.test(sets)) {
          warnings.push(
            `${where}: "${sets}" non indica serie e ripetizioni (es. 3x10, 3x8/10, 3x30", 2xmax): l'app la mostra come nota e non conta le serie.`,
          );
        }
        if (week.rest?.trim() && readRest(week.rest) === undefined) {
          warnings.push(`${where}: il recupero "${week.rest}" non si legge (es. 1'30, 2', 40"): niente timer.`);
        }
      });
      if (!exercise.media?.gif?.length && !exercise.media?.photos?.length) {
        warnings.push(`"${name}" non ha GIF né foto: l'app mostrerà solo la ricerca su YouTube.`);
      }
    }
  }
  return { errors, warnings };
}
