import type { Plan } from '@gymapp/plan';
import { describe, expect, it } from 'vitest';
import {
  activePlan,
  confirmSent,
  editSet,
  emptyState,
  finishWorkout,
  fromStorage,
  history,
  lastTime,
  logSet,
  mergeFromServer,
  moveToExercise,
  nextDay,
  removeSet,
  removeWorkout,
  saveRepMax,
  setsOf,
  setStartDate,
  startWorkout,
  workoutEnd,
  workoutInProgress,
  type State,
  type StoredPlan,
} from './index.ts';

const start = (state: State, id: string, dayId: string, at: string, planId = 'p1') =>
  startWorkout(state, { id, planId, dayId, week: 1, at });

const stored = (id: string, activeSince?: string): StoredPlan => ({
  id,
  createdAt: '2026-10-01T00:00:00Z',
  ...(activeSince && { activeSince }),
  excel: false,
  plan: { title: id, startDate: '2026-10-01', weekCount: 4, days: [] } satisfies Plan,
});

describe('workout', () => {
  it('starts, logs numbered sets and queues them after the workout', () => {
    let s = start(emptyState(), 'w1', 'A', '2026-10-23T18:00:00Z');
    s = logSet(s, { id: 's1', workoutId: 'w1', exerciseId: 'squat', kg: 10, reps: 10, at: '2026-10-23T18:05:00Z' });
    s = logSet(s, { id: 's2', workoutId: 'w1', exerciseId: 'squat', kg: 10, reps: 9, at: '2026-10-23T18:08:00Z' });

    expect(workoutInProgress(s)?.id).toBe('w1');
    expect(setsOf(s, 'w1', 'squat').map((x) => [x.number, x.reps])).toEqual([
      [1, 10],
      [2, 9],
    ]);
    expect(s.outbox).toEqual([
      { table: 'workouts', key: 'w1' },
      { table: 'sets', key: 's1' },
      { table: 'sets', key: 's2' },
    ]);
  });

  it('does not queue a row twice and keeps its place', () => {
    let s = start(emptyState(), 'w1', 'A', '2026-10-23T18:00:00Z');
    s = logSet(s, { id: 's1', workoutId: 'w1', exerciseId: 'squat', kg: 0, reps: 10, at: '2026-10-23T18:05:00Z' });
    s = moveToExercise(s, 'w1', 3);

    expect(s.workouts.w1.currentExercise).toBe(3);
    expect(s.outbox.map((e) => e.key)).toEqual(['w1', 's1']);
  });

  it('removes the last set and queues its deletion', () => {
    let s = start(emptyState(), 'w1', 'A', '2026-10-23T18:00:00Z');
    s = confirmSent(s, { table: 'workouts', key: 'w1' });
    s = logSet(s, { id: 's1', workoutId: 'w1', exerciseId: 'squat', kg: 0, reps: 10, at: '2026-10-23T18:05:00Z' });
    s = confirmSent(s, { table: 'sets', key: 's1' });
    s = removeSet(s, 's1');

    expect(setsOf(s, 'w1', 'squat')).toEqual([]);
    expect(s.outbox).toEqual([{ table: 'sets', key: 's1' }]);
  });

  it('finishes with feedback and goes into history, most recent first', () => {
    let s = start(emptyState(), 'w1', 'A', '2026-10-23T18:00:00Z');
    s = finishWorkout(s, 'w1', { at: '2026-10-23T19:00:00Z', effort: 3, note: 'ok' });
    s = start(s, 'w2', 'B', '2026-10-25T18:00:00Z');
    s = finishWorkout(s, 'w2', { at: '2026-10-25T19:00:00Z', effort: 4 });

    expect(workoutInProgress(s)).toBeUndefined();
    expect(history(s).map((w) => w.id)).toEqual(['w2', 'w1']);
    expect(s.workouts.w1.feedback).toEqual({ effort: 3, note: 'ok' });
  });
});

describe('nextDay', () => {
  const days = ['A', 'B', 'C'];

  it('suggests the day after the latest finished workout, wrapping to the first', () => {
    let s = emptyState();
    expect(nextDay(s, 'p1', days)).toBe('A');
    s = finishWorkout(start(s, 'w1', 'A', '2026-10-23T18:00:00Z'), 'w1', { at: '2026-10-23T19:00:00Z', effort: 3 });
    expect(nextDay(s, 'p1', days)).toBe('B');
    s = finishWorkout(start(s, 'w2', 'C', '2026-10-25T18:00:00Z'), 'w2', { at: '2026-10-25T19:00:00Z', effort: 3 });
    expect(nextDay(s, 'p1', days)).toBe('A');
  });

  it('starts a new plan from its first day', () => {
    const s = finishWorkout(start(emptyState(), 'w1', 'A', '2026-10-23T18:00:00Z', 'old'), 'w1', {
      at: '2026-10-23T19:00:00Z',
      effort: 3,
    });
    expect(nextDay(s, 'new', days)).toBe('A');
  });
});

describe('lastTime', () => {
  it('gives the sets of the latest other workout that included the exercise', () => {
    let s = start(emptyState(), 'w1', 'A', '2026-10-16T18:00:00Z');
    s = logSet(s, { id: 's1', workoutId: 'w1', exerciseId: 'squat', kg: 8, reps: 10, at: '2026-10-16T18:05:00Z' });
    s = finishWorkout(s, 'w1', { at: '2026-10-16T19:00:00Z', effort: 3 });
    s = start(s, 'w2', 'B', '2026-10-18T18:00:00Z');
    s = finishWorkout(s, 'w2', { at: '2026-10-18T19:00:00Z', effort: 3 });
    s = start(s, 'w3', 'A', '2026-10-23T18:00:00Z');

    expect(lastTime(s, 'w3', 'squat')).toEqual({ workout: s.workouts.w1, sets: [s.sets.s1] });
    expect(lastTime(s, 'w3', 'trx')).toBeUndefined();
  });
});

describe('mergeFromServer', () => {
  it("takes the server's rows but keeps local changes not yet sent", () => {
    let s = start(emptyState(), 'local', 'A', '2026-10-23T18:00:00Z');
    s = saveRepMax(s, { exerciseId: 'raises', reps: 12, kg: 6, workoutId: 'local', at: '2026-10-23T18:30:00Z' });
    s = setStartDate(s, 'p1', '2026-10-23');

    const server = {
      workouts: [
        { id: 'remote', dayId: 'B', week: 1, startedAt: '2026-10-20T18:00:00Z', currentExercise: 0 },
        { id: 'local', dayId: 'C', week: 2, startedAt: '2026-10-01T18:00:00Z', currentExercise: 5 },
      ],
      sets: [],
      repMaxes: [{ exerciseId: 'curl', reps: 15, kg: 8, foundAt: '2026-10-20T18:30:00Z' }],
      preferences: { planStarts: { p1: '2026-10-01' }, videos: { squat: 'abcdefghijk' } },
      plans: [stored('p2', '2026-10-20T00:00:00Z')],
    };
    const merged = mergeFromServer(s, server);

    expect(Object.keys(merged.workouts).sort()).toEqual(['local', 'remote']);
    expect(merged.workouts.local.dayId).toBe('A');
    expect(Object.keys(merged.repMaxes).sort()).toEqual(['curl', 'raises']);
    expect(merged.preferences.planStarts).toEqual({ p1: '2026-10-23' });
    expect(Object.keys(merged.plans)).toEqual(['p2']);
    expect(merged.outbox).toEqual(s.outbox);
  });

  it('drops local rows already sent that the server no longer has', () => {
    let s = start(emptyState(), 'old', 'A', '2026-10-23T18:00:00Z');
    s = confirmSent(s, { table: 'workouts', key: 'old' });
    const merged = mergeFromServer(s, {
      workouts: [],
      sets: [],
      repMaxes: [],
      preferences: { planStarts: {}, videos: {} },
      plans: [],
    });
    expect(merged.workouts).toEqual({});
  });
});

describe('workout logged later', () => {
  it('takes the chosen date, ends after the stated duration and counts for the suggested day', () => {
    let s = startWorkout(emptyState(), {
      id: 'past',
      planId: 'p1',
      dayId: 'A',
      week: 1,
      at: '2026-10-22T16:00:00.000Z',
      loggedLater: { durationMin: 75 },
    });
    expect(workoutInProgress(s)?.id).toBe('past');

    const w = s.workouts.past;
    expect(workoutEnd(w, '2026-10-23T09:00:00.000Z')).toBe('2026-10-22T17:15:00.000Z');
    s = finishWorkout(s, 'past', { at: workoutEnd(w, '2026-10-23T09:00:00.000Z'), effort: 3 });

    expect(history(s)[0].finishedAt).toBe('2026-10-22T17:15:00.000Z');
    expect(nextDay(s, 'p1', ['A', 'B', 'C'])).toBe('B');
  });

  it('for a live workout the end is now', () => {
    const s = startWorkout(emptyState(), {
      id: 'live',
      planId: 'p1',
      dayId: 'A',
      week: 1,
      at: '2026-10-23T08:00:00.000Z',
    });
    expect(workoutEnd(s.workouts.live, '2026-10-23T09:00:00.000Z')).toBe('2026-10-23T09:00:00.000Z');
  });
});

describe('editSet', () => {
  it('changes the load and reps of a logged set and queues it again', () => {
    let s = start(emptyState(), 'w1', 'A', '2026-10-23T18:00:00Z');
    s = logSet(s, { id: 's1', workoutId: 'w1', exerciseId: 'squat', kg: 8, reps: 10, at: '2026-10-23T18:05:00Z' });
    s = confirmSent(confirmSent(s, { table: 'workouts', key: 'w1' }), { table: 'sets', key: 's1' });

    s = editSet(s, 's1', { kg: 10, reps: 8 });

    expect(s.sets.s1).toMatchObject({ kg: 10, reps: 8, number: 1, loggedAt: '2026-10-23T18:05:00Z' });
    expect(s.outbox).toEqual([{ table: 'sets', key: 's1' }]);
    expect(editSet(s, 'missing', { kg: 0, reps: 1 })).toBe(s);
  });
});

describe('plans', () => {
  it('the active plan is the one activated last', () => {
    let s = emptyState();
    expect(activePlan(s)).toBeUndefined();
    s = mergeFromServer(s, {
      workouts: [],
      sets: [],
      repMaxes: [],
      plans: [stored('old', '2026-09-01T00:00:00Z'), stored('new', '2026-10-01T00:00:00Z'), stored('draft')],
    });
    expect(activePlan(s)?.id).toBe('new');
  });

  it('keeps a start date per plan', () => {
    let s = setStartDate(emptyState(), 'p1', '2026-10-22');
    s = setStartDate(s, 'p2', '2026-12-01');
    expect(s.preferences.planStarts).toEqual({ p1: '2026-10-22', p2: '2026-12-01' });
    expect(s.outbox).toEqual([{ table: 'preferences', key: 'preferences' }]);
  });
});

describe('fromStorage', () => {
  it('fills in what a state saved by an older version lacks', () => {
    const old = {
      workouts: {},
      sets: {},
      repMaxes: {},
      preferences: { startDate: '2026-10-22', videos: {} },
      outbox: [],
    };
    const s = fromStorage(JSON.stringify(old));
    expect(s.plans).toEqual({});
    expect(s.preferences).toEqual({ planStarts: {}, videos: {} });
  });
});

describe('removeWorkout', () => {
  it('removes the workout with its sets and queues their deletion', () => {
    let s = start(emptyState(), 'w1', 'A', '2026-10-23T18:00:00Z');
    s = logSet(s, { id: 's1', workoutId: 'w1', exerciseId: 'squat', kg: 8, reps: 10, at: '2026-10-23T18:05:00Z' });
    s = start(s, 'w2', 'B', '2026-10-24T18:00:00Z');
    s = logSet(s, { id: 's2', workoutId: 'w2', exerciseId: 'trx', kg: 0, reps: 12, at: '2026-10-24T18:05:00Z' });
    s = [
      { table: 'workouts', key: 'w1' },
      { table: 'sets', key: 's1' },
      { table: 'workouts', key: 'w2' },
      { table: 'sets', key: 's2' },
    ].reduce((state, entry) => confirmSent(state, entry as { table: 'workouts' | 'sets'; key: string }), s);

    s = removeWorkout(s, 'w1');

    expect(Object.keys(s.workouts)).toEqual(['w2']);
    expect(Object.keys(s.sets)).toEqual(['s2']);
    expect(s.outbox).toEqual([
      { table: 'sets', key: 's1' },
      { table: 'workouts', key: 'w1' },
    ]);
    expect(removeWorkout(s, 'missing')).toBe(s);
  });
});
