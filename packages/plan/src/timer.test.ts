import { describe, expect, it } from 'vitest';
import {
  cuesBetween,
  RESUME_MARGIN_SECONDS,
  roundCues,
  roundsAt,
  timerAt,
  timerToResume,
  workedSeconds,
  type Phase,
} from './timer.ts';

const hold: Phase[] = [
  { kind: 'prepare', seconds: 5 },
  { kind: 'work', seconds: 30 },
];

describe('timerAt', () => {
  it('gives the phase and the seconds left at a moment', () => {
    expect(timerAt(hold, 0)).toEqual({ index: 0, kind: 'prepare', remaining: 5, done: false });
    expect(timerAt(hold, 4.2)).toEqual({ index: 0, kind: 'prepare', remaining: 1, done: false });
    expect(timerAt(hold, 5)).toEqual({ index: 1, kind: 'work', remaining: 30, done: false });
    expect(timerAt(hold, 20.5)).toEqual({ index: 1, kind: 'work', remaining: 15, done: false });
  });

  it('is done after the last phase', () => {
    expect(timerAt(hold, 35)).toEqual({ index: 1, kind: 'work', remaining: 0, done: true });
    expect(timerAt(hold, 90).done).toBe(true);
  });
});

describe('cuesBetween', () => {
  it('beeps at 3, 2 and 1, then signals the start of the work and the end of the round', () => {
    expect(cuesBetween(hold, 0, 5)).toEqual(['tick', 'tick', 'tick', 'go']);
    expect(cuesBetween(hold, 5, 31)).toEqual([]);
    expect(cuesBetween(hold, 31, 35)).toEqual(['tick', 'tick', 'tick', 'end']);
  });

  it('gives each cue once, however the time is split', () => {
    const steps = [0, 0.9, 2.1, 2.5, 3.2, 4.99, 5.01, 33, 34.4, 36];
    const cues = steps.slice(1).flatMap((t, i) => cuesBetween(hold, steps[i], t));
    expect(cues).toEqual(['tick', 'tick', 'tick', 'go', 'tick', 'tick', 'tick', 'end']);
  });

  it('signals the start of each round that follows straight on', () => {
    const rounds: Phase[] = [
      { kind: 'prepare', seconds: 5 },
      { kind: 'work', seconds: 30 },
      { kind: 'work', seconds: 30 },
    ];
    expect(cuesBetween(rounds, 31, 35)).toEqual(['tick', 'tick', 'tick', 'go']);
    expect(cuesBetween(rounds, 61, 65)).toEqual(['tick', 'tick', 'tick', 'end']);
  });

  it('ends a rest with the round signal', () => {
    expect(cuesBetween([{ kind: 'rest', seconds: 90 }], 80, 91)).toEqual(['tick', 'tick', 'tick', 'end']);
  });
});

describe('timerToResume', () => {
  const saved = { workoutId: 'w1', exerciseId: 'plank', kind: 'hold', phases: hold, startedAt: 1_000_000 };
  const json = JSON.stringify(saved);
  const at = (seconds: number) => saved.startedAt + seconds * 1000;

  it('gives back the timer of the same workout and exercise', () => {
    expect(timerToResume(json, 'w1', 'plank', at(12))).toEqual(saved);
  });

  it('ignores a timer of another exercise or workout', () => {
    expect(timerToResume(json, 'w1', 'squat', at(12))).toBeUndefined();
    expect(timerToResume(json, 'w2', 'plank', at(12))).toBeUndefined();
  });

  it('keeps a timer that ended a little ago, so the screen can close it without signals', () => {
    expect(timerToResume(json, 'w1', 'plank', at(35 + RESUME_MARGIN_SECONDS))).toEqual(saved);
  });

  it('drops a timer that ended too long ago, or that starts in the future', () => {
    expect(timerToResume(json, 'w1', 'plank', at(36 + RESUME_MARGIN_SECONDS))).toBeUndefined();
    expect(timerToResume(json, 'w1', 'plank', at(-5))).toBeUndefined();
  });

  it('ignores nothing saved and what it cannot read', () => {
    expect(timerToResume(null, 'w1', 'plank', at(1))).toBeUndefined();
    expect(timerToResume('{', 'w1', 'plank', at(1))).toBeUndefined();
    expect(timerToResume('{"workoutId":"w1","exerciseId":"plank"}', 'w1', 'plank', at(1))).toBeUndefined();
  });
});

describe('rounds', () => {
  // Preparation, three rounds of reps with no time limit, and 30 seconds of rest between them.
  const rounds: Phase[] = [
    { kind: 'prepare', seconds: 5 },
    { kind: 'work', seconds: 0, label: 'Giro 1 di 3' },
    { kind: 'rest', seconds: 30 },
    { kind: 'work', seconds: 0, label: 'Giro 2 di 3' },
    { kind: 'rest', seconds: 30 },
    { kind: 'work', seconds: 0, label: 'Giro 3 di 3' },
  ];

  describe('roundsAt', () => {
    it('starts with the preparation', () => {
      expect(roundsAt(rounds, [], 2)).toEqual({ index: 0, kind: 'prepare', remaining: 3, round: 0, done: false });
    });

    it('waits for the reps to be done, however long they take', () => {
      expect(roundsAt(rounds, [], 5)).toEqual({ index: 1, kind: 'work', round: 1, done: false });
      expect(roundsAt(rounds, [], 5000)).toEqual({ index: 1, kind: 'work', round: 1, done: false });
    });

    it('gives the full rest from the moment the reps are done', () => {
      expect(roundsAt(rounds, [17], 17)).toEqual({ index: 2, kind: 'rest', remaining: 30, round: 1, done: false });
      expect(roundsAt(rounds, [17], 40.5)).toEqual({ index: 2, kind: 'rest', remaining: 7, round: 1, done: false });
    });

    it('starts the next round when the rest is over, and waits again', () => {
      expect(roundsAt(rounds, [17], 47)).toEqual({ index: 3, kind: 'work', round: 2, done: false });
      expect(roundsAt(rounds, [17], 500)).toEqual({ index: 3, kind: 'work', round: 2, done: false });
    });

    it('has no rest after the last round: it is done', () => {
      expect(roundsAt(rounds, [17, 60, 100], 100).done).toBe(true);
    });
  });

  describe('roundCues', () => {
    it('beeps at the end of the preparation and starts the first round', () => {
      expect(roundCues(rounds, [], 0, 5)).toEqual(['tick', 'tick', 'tick', 'go']);
    });

    it('stays silent while waiting for the reps', () => {
      expect(roundCues(rounds, [], 5, 500)).toEqual([]);
    });

    it('beeps at the end of the rest and starts the next round', () => {
      expect(roundCues(rounds, [17], 17, 43)).toEqual([]);
      expect(roundCues(rounds, [17], 43, 47)).toEqual(['tick', 'tick', 'tick', 'go']);
    });

    it('signals the end when the last round is done', () => {
      expect(roundCues(rounds, [17, 60, 100], 99, 100)).toEqual(['end']);
    });
  });

  describe('timerToResume', () => {
    const saved = { workoutId: 'w1', exerciseId: 'p', kind: 'rounds', phases: rounds, startedAt: 1_000_000, marks: [17] };

    it('keeps the rounds done, however long ago the timer started', () => {
      const later = saved.startedAt + 3 * 60 * 60 * 1000;
      expect(timerToResume(JSON.stringify(saved), 'w1', 'p', later)?.marks).toEqual([17]);
    });
  });
});

describe('workedSeconds', () => {
  // A hold followed by a hold per side, as in a superset with the side plank.
  const superset: Phase[] = [
    { kind: 'prepare', seconds: 5 },
    { kind: 'work', seconds: 30 },
    { kind: 'prepare', seconds: 5, label: 'sinistro' },
    { kind: 'work', seconds: 20, label: 'sinistro' },
    { kind: 'prepare', seconds: 5, label: 'destro' },
    { kind: 'work', seconds: 20, label: 'destro' },
  ];

  it('gives the seconds done in each work phase', () => {
    expect(workedSeconds(superset, 0)).toEqual([0, 0, 0]);
    expect(workedSeconds(superset, 20.6)).toEqual([15, 0, 0]);
    expect(workedSeconds(superset, 52)).toEqual([30, 12, 0]);
    expect(workedSeconds(superset, 1000)).toEqual([30, 20, 20]);
  });
});
