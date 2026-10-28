// The workout log: local state, changes and the outbox towards the server.
// Everything lives on the device before the server: each change updates the state and queues
// the row it touched; sync reads the outbox, sends the row's current version
// (or its deletion, if it is gone) and confirms.

import type { Plan } from '@gymapp/plan';

export type Feedback = { effort: number; note?: string };

export type Workout = {
  id: string;
  /** The plan the workout follows; missing only in workouts logged before plans had ids. */
  planId?: string;
  dayId: string;
  week: number;
  startedAt: string;
  finishedAt?: string;
  /** Index of the exercise reached, to resume. */
  currentExercise: number;
  feedback?: Feedback;
  /** A workout already done and logged afterwards: it lasts as long as stated, not until it is closed. */
  loggedLater?: { durationMin: number };
};

export type LoggedSet = {
  id: string;
  workoutId: string;
  exerciseId: string;
  /** 1-based, in the order the exercise's sets were logged. */
  number: number;
  /** Load in kg; 0 is bodyweight. */
  kg: number;
  reps: number;
  loggedAt: string;
};

/** The maximum load found for N reps, per exercise. */
export type RepMax = {
  exerciseId: string;
  reps: number;
  kg: number;
  workoutId?: string;
  foundAt: string;
};

export type Preferences = {
  /** The day each plan was started, `YYYY-MM-DD`, by plan id: weeks count from there. */
  planStarts: Record<string, string>;
  /** Chosen YouTube videos, per exercise. */
  videos: Record<string, string>;
};

/** A user's plan as the server keeps it. Plans are written through the MCP, the app only reads them. */
export type StoredPlan = {
  id: string;
  createdAt: string;
  /** When it became the active plan; the active one is the latest. */
  activeSince?: string;
  /** The original Excel file is attached. */
  excel: boolean;
  plan: Plan;
};

export type Table = 'workouts' | 'sets' | 'repMaxes' | 'preferences';

export type OutboxEntry = { table: Table; key: string };

export type State = {
  workouts: Record<string, Workout>;
  sets: Record<string, LoggedSet>;
  repMaxes: Record<string, RepMax>;
  preferences: Preferences;
  plans: Record<string, StoredPlan>;
  outbox: OutboxEntry[];
};

export type ServerData = {
  workouts: Workout[];
  sets: LoggedSet[];
  repMaxes: RepMax[];
  preferences?: Preferences;
  plans: StoredPlan[];
};

export const PREFERENCES_KEY = 'preferences';

export const emptyState = (): State => ({
  workouts: {},
  sets: {},
  repMaxes: {},
  preferences: { planStarts: {}, videos: {} },
  plans: {},
  outbox: [],
});

/** A state saved on the device, completed with what older versions did not have. */
export function fromStorage(json: string): State {
  const saved = JSON.parse(json) as Partial<State>;
  const empty = emptyState();
  return {
    ...empty,
    ...saved,
    preferences: {
      planStarts: saved.preferences?.planStarts ?? {},
      videos: saved.preferences?.videos ?? {},
    },
    plans: saved.plans ?? {},
  };
}

// A row already queued keeps its place: order matters, because a set must be sent after its workout.
function enqueue(state: State, table: Table, key: string): OutboxEntry[] {
  return state.outbox.some((e) => e.table === table && e.key === key)
    ? state.outbox
    : [...state.outbox, { table, key }];
}

export function confirmSent(state: State, entry: OutboxEntry): State {
  return { ...state, outbox: state.outbox.filter((e) => !(e.table === entry.table && e.key === entry.key)) };
}

export function startWorkout(
  state: State,
  {
    id,
    planId,
    dayId,
    week,
    at,
    loggedLater,
  }: { id: string; planId: string; dayId: string; week: number; at: string; loggedLater?: { durationMin: number } },
): State {
  const workout: Workout = {
    id,
    planId,
    dayId,
    week,
    startedAt: at,
    currentExercise: 0,
    ...(loggedLater && { loggedLater }),
  };
  return { ...state, workouts: { ...state.workouts, [id]: workout }, outbox: enqueue(state, 'workouts', id) };
}

function updateWorkout(state: State, id: string, change: Partial<Workout>): State {
  const current = state.workouts[id];
  if (!current) return state;
  return {
    ...state,
    workouts: { ...state.workouts, [id]: { ...current, ...change } },
    outbox: enqueue(state, 'workouts', id),
  };
}

export const moveToExercise = (state: State, id: string, currentExercise: number) =>
  updateWorkout(state, id, { currentExercise });

/** When a workout closed now ends: right away, or after the stated duration if it is logged later. */
export function workoutEnd(workout: Workout, now: string): string {
  if (!workout.loggedLater) return now;
  return new Date(Date.parse(workout.startedAt) + workout.loggedLater.durationMin * 60_000).toISOString();
}

export function finishWorkout(state: State, id: string, { at, ...feedback }: Feedback & { at: string }) {
  return updateWorkout(state, id, { finishedAt: at, feedback });
}

export function logSet(
  state: State,
  next: { id: string; workoutId: string; exerciseId: string; kg: number; reps: number; at: string },
): State {
  const number = setsOf(state, next.workoutId, next.exerciseId).length + 1;
  const { at, ...fields } = next;
  const set: LoggedSet = { ...fields, number, loggedAt: at };
  return { ...state, sets: { ...state.sets, [set.id]: set }, outbox: enqueue(state, 'sets', set.id) };
}

export function editSet(state: State, id: string, change: { kg: number; reps: number }): State {
  const current = state.sets[id];
  if (!current) return state;
  return { ...state, sets: { ...state.sets, [id]: { ...current, ...change } }, outbox: enqueue(state, 'sets', id) };
}

export function removeSet(state: State, id: string): State {
  if (!state.sets[id]) return state;
  const { [id]: _removed, ...sets } = state.sets;
  return { ...state, sets, outbox: enqueue(state, 'sets', id) };
}

/** Removes a workout with its sets; rep maxes found in it stay, they are still the user's. */
export function removeWorkout(state: State, id: string): State {
  if (!state.workouts[id]) return state;
  const removed = Object.values(state.sets).filter((x) => x.workoutId === id);
  let next = state;
  for (const set of removed) next = removeSet(next, set.id);
  const { [id]: _removed, ...workouts } = next.workouts;
  return { ...next, workouts, outbox: enqueue(next, 'workouts', id) };
}

export function saveRepMax(
  state: State,
  { at, ...repMax }: { exerciseId: string; reps: number; kg: number; workoutId?: string; at: string },
): State {
  return {
    ...state,
    repMaxes: { ...state.repMaxes, [repMax.exerciseId]: { ...repMax, foundAt: at } },
    outbox: enqueue(state, 'repMaxes', repMax.exerciseId),
  };
}

/** The N RM a workout's sets show: the heaviest load among the sets of exactly N reps. */
export function repMaxIn(sets: Pick<LoggedSet, 'kg' | 'reps'>[], reps: number): number | undefined {
  const loads = sets.filter((s) => s.reps === reps).map((s) => s.kg);
  return loads.length ? Math.max(...loads) : undefined;
}

function updatePreferences(state: State, preferences: Preferences): State {
  return { ...state, preferences, outbox: enqueue(state, 'preferences', PREFERENCES_KEY) };
}

export const setStartDate = (state: State, planId: string, startDate: string) =>
  updatePreferences(state, {
    ...state.preferences,
    planStarts: { ...state.preferences.planStarts, [planId]: startDate },
  });

export function setVideo(state: State, exerciseId: string, youtube: string | undefined): State {
  const { [exerciseId]: _old, ...videos } = state.preferences.videos;
  return updatePreferences(state, {
    ...state.preferences,
    videos: youtube ? { ...videos, [exerciseId]: youtube } : videos,
  });
}

// Reads

/** The plan in use: the one activated last. */
export const activePlan = (state: State) =>
  Object.values(state.plans)
    .filter((p) => p.activeSince)
    .sort((a, b) => b.activeSince!.localeCompare(a.activeSince!))[0];

export const workoutInProgress = (state: State) =>
  Object.values(state.workouts)
    .filter((w) => !w.finishedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];

/** Finished workouts, most recent first. */
export const history = (state: State) =>
  Object.values(state.workouts)
    .filter((w) => w.finishedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

export const setsOf = (state: State, workoutId: string, exerciseId?: string) =>
  Object.values(state.sets)
    .filter((s) => s.workoutId === workoutId && (exerciseId === undefined || s.exerciseId === exerciseId))
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));

/** The exercise's sets in the latest other workout where it was done. */
export function lastTime(state: State, workoutId: string, exerciseId: string) {
  const earlier = Object.values(state.workouts)
    .filter((w) => w.id !== workoutId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const workout of earlier) {
    const sets = setsOf(state, workout.id, exerciseId);
    if (sets.length) return { workout, sets };
  }
  return undefined;
}

/** The day after the one of the plan's latest finished workout, wrapping around to the first. */
export function nextDay(state: State, planId: string, days: string[]): string {
  const last = history(state).find((w) => w.planId === planId);
  const index = last ? days.indexOf(last.dayId) : -1;
  return days[(index + 1) % days.length];
}

/** From `next` on, in the plan's order, the first day not yet done in the week. */
export function nextOpenDay(next: string, days: string[], done: string[]): string | undefined {
  const from = Math.max(days.indexOf(next), 0);
  return [...days.slice(from), ...days.slice(0, from)].find((d) => !done.includes(d));
}

/** The plan's days done in a week, with the workout that did each: the latest, if done twice. */
export function doneInWeek(state: State, planId: string, week: number): Record<string, Workout> {
  const done: Record<string, Workout> = {};
  for (const w of [...history(state)].reverse()) {
    if (w.planId === planId && w.week === week) done[w.dayId] = w;
  }
  return done;
}

/** The first week whose days are not all done: after a complete week, the next one starts. */
export function firstOpenWeek(state: State, planId: string, days: string[], weekCount: number): number {
  let week = 1;
  while (week < weekCount && days.every((d) => doneInWeek(state, planId, week)[d])) week++;
  return week;
}

// Sync

const pending = (state: State, table: Table) =>
  new Set(state.outbox.filter((e) => e.table === table).map((e) => e.key));

function merge<T>(local: Record<string, T>, remote: T[], key: (row: T) => string, waiting: Set<string>) {
  const merged: Record<string, T> = {};
  for (const row of remote) merged[key(row)] = row;
  for (const k of waiting) {
    if (local[k]) merged[k] = local[k];
    else delete merged[k];
  }
  return merged;
}

/** The server's state, with the local changes not yet sent on top. */
export function mergeFromServer(state: State, server: ServerData): State {
  return {
    workouts: merge(state.workouts, server.workouts, (w) => w.id, pending(state, 'workouts')),
    sets: merge(state.sets, server.sets, (s) => s.id, pending(state, 'sets')),
    repMaxes: merge(state.repMaxes, server.repMaxes, (r) => r.exerciseId, pending(state, 'repMaxes')),
    preferences: pending(state, 'preferences').size
      ? state.preferences
      : (server.preferences ?? { planStarts: {}, videos: {} }),
    plans: Object.fromEntries(server.plans.map((p) => [p.id, p])),
    outbox: state.outbox,
  };
}
