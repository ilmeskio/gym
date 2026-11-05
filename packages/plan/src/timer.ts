// Timers for timed exercises and rests, computed from the time elapsed since the start:
// the screen asks where the timer is, and which signals fall between two moments.

/** `label` says what the phase is for, when the kind alone does not (a side, a round). */
export type Phase = { kind: 'prepare' | 'work' | 'rest'; seconds: number; label?: string };

export type TimerState = { index: number; kind: Phase['kind']; remaining: number; done: boolean };

/** `tick` in the last three seconds of a phase, `go` when work starts, `end` at the end of a round. */
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
  for (const [index, phase] of phases.entries()) {
    const end = start + phase.seconds;
    for (const before of [3, 2, 1]) {
      if (end - before > start) cues.push({ at: end - before, cue: 'tick' });
    }
    cues.push({ at: end, cue: phases[index + 1]?.kind === 'work' ? 'go' : 'end' });
    start = end;
  }
  return cues.filter((c) => c.at > from && c.at <= to).map((c) => c.cue);
}

/** The seconds done in each work phase, `elapsed` seconds after the start. */
export function workedSeconds(phases: Phase[], elapsed: number): number[] {
  const worked: number[] = [];
  let start = 0;
  for (const phase of phases) {
    if (phase.kind === 'work') worked.push(Math.min(Math.max(Math.floor(elapsed - start), 0), phase.seconds));
    start += phase.seconds;
  }
  return worked;
}

/** Where rounds are: `remaining` while a preparation or rest runs; `round` is 1-based, 0 before the first. */
export type RoundsState = {
  index: number;
  kind: Phase['kind'];
  remaining?: number;
  round: number;
  done: boolean;
};

/**
 * Rounds of reps have no time limit: each `work` phase lasts until its reps are marked done, and
 * what follows counts from that moment. `marks` are the seconds after the start of each mark.
 */
function roundsTimeline(phases: Phase[], marks: number[]) {
  const timeline: { index: number; phase: Phase; end?: number }[] = [];
  let start = 0;
  let done = 0;
  for (const [index, phase] of phases.entries()) {
    const end: number | undefined = phase.kind === 'work' ? marks[done++] : start + phase.seconds;
    timeline.push({ index, phase, end });
    if (end === undefined) break;
    start = end;
  }
  return timeline;
}

/** Where rounds are `elapsed` seconds after the start. */
export function roundsAt(phases: Phase[], marks: number[], elapsed: number): RoundsState {
  let round = 0;
  for (const { index, phase, end } of roundsTimeline(phases, marks)) {
    if (phase.kind === 'work') round++;
    if (end === undefined) return { index, kind: phase.kind, round, done: false };
    if (elapsed < end) {
      const remaining = Math.ceil(end - elapsed);
      return phase.kind === 'work'
        ? { index, kind: phase.kind, round, done: false }
        : { index, kind: phase.kind, remaining, round, done: false };
    }
  }
  const last = phases.length - 1;
  return { index: last, kind: phases[last].kind, round, done: true };
}

/** The signals of rounds that fall after `from` and up to `to`, in order. */
export function roundCues(phases: Phase[], marks: number[], from: number, to: number): Cue[] {
  const cues: { at: number; cue: Cue }[] = [];
  for (const { index, phase, end } of roundsTimeline(phases, marks)) {
    if (end === undefined) break;
    if (phase.kind !== 'work') {
      for (const before of [3, 2, 1]) cues.push({ at: end - before, cue: 'tick' });
      cues.push({ at: end, cue: 'go' });
    } else if (index === phases.length - 1) {
      cues.push({ at: end, cue: 'end' });
    }
  }
  return cues.filter((c) => c.at > from && c.at <= to).map((c) => c.cue);
}

/**
 * A running timer saved on the device, so a reload finds it: the moment it started (ms since
 * the epoch) and its phases, not the seconds left. `marks` are the rounds whose reps are done,
 * in seconds after the start.
 */
export type SavedTimer = {
  workoutId: string;
  exerciseId: string;
  kind: 'hold' | 'rounds' | 'rest';
  phases: Phase[];
  startedAt: number;
  marks?: number[];
};

/** How long after its end a saved timer still counts: the screen then closes it without signals. */
export const RESUME_MARGIN_SECONDS = 5 * 60;

/** The saved timer, if it belongs to this exercise of this workout and is not too old (`now` in ms). */
export function timerToResume(
  saved: string | null,
  workoutId: string,
  exerciseId: string,
  now: number,
): SavedTimer | undefined {
  let timer: SavedTimer;
  try {
    timer = JSON.parse(saved ?? 'null');
  } catch {
    return undefined;
  }
  if (!timer || timer.workoutId !== workoutId || timer.exerciseId !== exerciseId) return undefined;
  if (!Array.isArray(timer.phases) || !timer.phases.length || typeof timer.startedAt !== 'number') return undefined;
  const elapsed = (now - timer.startedAt) / 1000;
  // Rounds wait for their reps, so they have no end in time: they stay until they are closed.
  if (timer.kind === 'rounds') return elapsed >= 0 ? timer : undefined;
  const total = timer.phases.reduce((sum, p) => sum + p.seconds, 0);
  return elapsed >= 0 && elapsed <= total + RESUME_MARGIN_SECONDS ? timer : undefined;
}
