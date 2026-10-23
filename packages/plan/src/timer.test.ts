import { describe, expect, it } from 'vitest';
import { cuesBetween, timerAt, type Phase } from './timer.ts';

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

  it('ends a rest with the round signal', () => {
    expect(cuesBetween([{ kind: 'rest', seconds: 90 }], 80, 91)).toEqual(['tick', 'tick', 'tick', 'end']);
  });
});
