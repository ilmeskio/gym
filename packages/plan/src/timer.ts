// Timers for timed exercises and rests, computed from the time elapsed since the start:
// the screen asks where the timer is, and which signals fall between two moments.

export type Phase = { kind: 'prepare' | 'work' | 'rest'; seconds: number };

export type TimerState = { index: number; kind: Phase['kind']; remaining: number; done: boolean };

/** `tick` in the last three seconds of a phase, `go` when the preparation ends, `end` at the end of a round. */
export type Cue = 'tick' | 'go' | 'end';

export const PREPARE_SECONDS = 5;

/** Where the timer is `elapsed` seconds after the start. */
export function timerAt(phases: Phase[], elapsed: number): TimerState {
  let start = 0;
  for (const [index, phase] of phases.entries()) {
    const end = start + phase.seconds;
    if (elapsed < end) return { index, kind: phase.kind, remaining: Math.ceil(end - elapsed), done: false };
    start = end;
  }
  const last = phases.length - 1;
  return { index: last, kind: phases[last].kind, remaining: 0, done: true };
}

/** The signals that fall after `from` and up to `to`, in order. */
export function cuesBetween(phases: Phase[], from: number, to: number): Cue[] {
  const cues: { at: number; cue: Cue }[] = [];
  let start = 0;
  for (const phase of phases) {
    const end = start + phase.seconds;
    for (const before of [3, 2, 1]) {
      if (end - before > start) cues.push({ at: end - before, cue: 'tick' });
    }
    cues.push({ at: end, cue: phase.kind === 'prepare' ? 'go' : 'end' });
    start = end;
  }
  return cues.filter((c) => c.at > from && c.at <= to).map((c) => c.cue);
}
