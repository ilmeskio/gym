// The training plan and the rules for reading it.
// Prescriptions stay free text, as the trainer writes them:
// the functions below extract only what the app needs (sets, target, rest).

import type { ExerciseMedia } from './media.ts';
import { PREPARE_SECONDS, type Phase } from './timer.ts';

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

/** A timed hold done straight after each set, as in a superset: `+20" a lato side plank`. */
export type ThenHold = { seconds: number; perSide: boolean; name?: string };

/** Rounds against the clock: `reps` every `every` seconds, for `minutes`. */
export type Intervals = { reps: number; every: number; minutes: number };

export type SetsReading = {
  sets?: Range;
  target?: Target;
  note?: string;
  then?: ThenHold;
  /** The reps of the exercise done straight after each set, in a superset: `3x8/12+8/12`. */
  thenReps?: Range;
  intervals?: Intervals;
  /** Sets after the first, each with half its reps: `1xmax + 3 x metà rep prima serie`. */
  halfRepSets?: number;
};

const range = (min: string, max?: string): Range => ({
  min: Number(min),
  max: Number(max ?? min),
});

const SETS = /^(\d+)(?:\/(\d+))?\s*x\s*(?:(max)|(\d+)(?:\/(\d+))?\s*(")?)/i;
const THEN_HOLD = /^\+\s*(\d+)\s*"\s*(a lato|per lato)?\s*(.*)$/i;
const THEN_REPS = /^\+\s*(\d+)(?:\/(\d+))?(?![\d/]|\s*")/;
const HALF_REP_SETS = /^\+?\s*(\d+)\s*x\s*metà\s*rep/i;
const INTERVALS = /^(\d+)\s*rep\w*\s+ogni\s+(\d+)\s*"\s*x\s*(\d+)\s*min/i;

export function readSets(text: string | undefined): SetsReading {
  const clean = text?.trim();
  if (!clean) return {};
  const m = SETS.exec(clean);
  if (!m) {
    const i = INTERVALS.exec(clean);
    return i
      ? { note: clean, intervals: { reps: Number(i[1]), every: Number(i[2]), minutes: Number(i[3]) } }
      : { note: clean };
  }
  const [whole, setsMin, setsMax, max, repsMin, repsMax, seconds] = m;
  const target: Target = max ? { kind: 'max' } : { kind: seconds ? 'seconds' : 'reps', ...range(repsMin, repsMax) };
  const reading: SetsReading = { sets: range(setsMin, setsMax), target };
  const note = clean.slice(whole.length).trim();
  if (note) reading.note = note;
  const half = HALF_REP_SETS.exec(note);
  if (half) reading.halfRepSets = Number(half[1]);
  const then = !half && THEN_HOLD.exec(note);
  if (then) reading.then = { seconds: Number(then[1]), perSide: !!then[2], ...(then[3] && { name: then[3] }) };
  const thenReps = !half && !then && THEN_REPS.exec(note);
  if (thenReps) reading.thenReps = range(thenReps[1], thenReps[2]);
  return reading;
}

const SUPERSET = /\s+in\s+super\s*set\s+con\s+/i;

/** The two exercises of a superset, from a name like `curl … in super set con push down …`. */
export function supersetParts(name: string): [string, string] | undefined {
  const parts = name.trim().split(SUPERSET);
  return parts.length === 2 && parts[0] && parts[1] ? [parts[0], parts[1]] : undefined;
}

// The sets of the second exercise of a superset are logged on their own, under an id of their own.
const SECOND_PART = '~2';

export const secondPartId = (exerciseId: string) => `${exerciseId}${SECOND_PART}`;

/** The plan's exercise a logged exercise id belongs to: itself, or the superset of a second part. */
export const partOwner = (exerciseId: string) =>
  exerciseId.endsWith(SECOND_PART) ? exerciseId.slice(0, -SECOND_PART.length) : exerciseId;

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The timer of a timed set: preparation, the hold, then the hold that follows it in a superset,
 * for `thenSeconds` per side (the plan's seconds unless chosen otherwise).
 */
export function holdPhases({ then }: SetsReading, seconds: number, thenSeconds = then?.seconds): Phase[] {
  const phases: Phase[] = [
    { kind: 'prepare', seconds: PREPARE_SECONDS },
    { kind: 'work', seconds },
  ];
  if (!then) return phases;
  const name = capitalized(then.name ?? 'secondo esercizio');
  const labels = then.perSide ? [`${name}, lato sinistro`, `${name}, lato destro`] : [name];
  for (const label of labels) {
    phases.push(
      { kind: 'prepare', seconds: PREPARE_SECONDS, label },
      { kind: 'work', seconds: thenSeconds ?? then.seconds, label },
    );
  }
  return phases;
}

/** The timer of rounds against the clock: preparation, then one phase per round. */
export function intervalPhases({ reps, every, minutes }: Intervals): Phase[] {
  const rounds = Math.floor((minutes * 60) / every);
  return [
    { kind: 'prepare', seconds: PREPARE_SECONDS },
    ...Array.from({ length: rounds }, (_, i): Phase => ({
      kind: 'work',
      seconds: every,
      label: `Giro ${i + 1} di ${rounds}: ${reps} ripetizioni`,
    })),
  ];
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
  /** The plan gives no rest: `restSeconds` is the default minute. */
  restMissing?: boolean;
  /** This week the maximum load for N reps (N RM) has to be found. */
  findRepMax?: number;
  /** The load to use is the N RM found in an earlier week. */
  useRepMax?: number;
  /** A superset: the names of its two exercises, each with its own load and reps. */
  superset?: [string, string];
};

/** The rest between sets when the plan gives none. */
export const DEFAULT_REST_SECONDS = 60;
export const DEFAULT_REST_TEXT = "1'";

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
    const restMissing = !p.rest?.trim();
    return {
      exercise,
      position: index + 1,
      total: day.exercises.length,
      prescription: p,
      sets: readSets(p.setsReps),
      restSeconds: restMissing ? DEFAULT_REST_SECONDS : readRest(p.rest),
      ...(restMissing && { restMissing }),
      findRepMax: readRepMaxSearch(p.load),
      useRepMax: p.load ? undefined : lastRepMaxSearch(exercise, week),
      superset: supersetParts(exercise.name),
    };
  });
}

/** What else a step asks besides sets and load, in words to show before starting. */
export function stepDetails({ prescription: p, exercise, restMissing }: Step): string[] {
  return [
    restMissing ? `recupero ${DEFAULT_REST_TEXT} (non indicato)` : p.rest && `recupero ${p.rest.trim()}`,
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
export { cuesBetween, PREPARE_SECONDS, RESUME_MARGIN_SECONDS, timerAt, timerToResume, workedSeconds } from './timer.ts';
export type { Cue, Phase, SavedTimer, TimerState } from './timer.ts';
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
        const reading = readSets(sets);
        if (sets && !reading.sets && !reading.intervals && !THAT_WEEK_ONLY.setsReps?.test(sets)) {
          warnings.push(
            `${where}: "${sets}" non indica serie e ripetizioni (es. 3x10, 3x8/10, 3x30", 2xmax, 5 rep ogni 30" x 4 min): l'app la mostra come nota e non conta le serie.`,
          );
        }
        if (week.rest?.trim() && readRest(week.rest) === undefined) {
          warnings.push(`${where}: il recupero "${week.rest}" non si legge (es. 1'30, 2', 40"): niente timer.`);
        }
      });
      const noRest = exercise.weeks.findIndex((_, i) => {
        const p = prescription(exercise, i + 1);
        const { sets, halfRepSets = 0 } = readSets(p.setsReps);
        return !!sets && sets.max + halfRepSets > 1 && !p.rest?.trim();
      });
      if (noRest >= 0) {
        warnings.push(
          `"${name}", settimana ${noRest + 1}: nessun recupero tra le serie, nemmeno nelle settimane prima: l'app usa ${DEFAULT_REST_TEXT}.`,
        );
      }
      if (!exercise.media?.gif?.length && !exercise.media?.photos?.length) {
        warnings.push(`"${name}" non ha GIF né foto: l'app mostrerà solo la ricerca su YouTube.`);
      }
    }
  }
  return { errors, warnings };
}
