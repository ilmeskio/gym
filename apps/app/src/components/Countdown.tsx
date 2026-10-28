// A running timer: preparation, a timed hold or a rest, with beeps at 3-2-1 and a signal at
// the end of the round. Time comes from the clock, so it stays right if the page slows down
// or is reloaded.

import { cuesBetween, timerAt, workedSeconds, type Phase } from '@gymapp/plan';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { keepAwake, signal } from '../signal';
import { colors } from '../theme';
import { useSizes } from '../useSizes';
import { Button } from './Button';

const LABELS: Record<Phase['kind'], string> = { prepare: 'Preparati', work: 'Vai!', rest: 'Recupero' };

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * How far the timer got: seconds of the first work phase, work phases completed, and the seconds
 * of every work phase (a hold, then the hold that follows it in a superset).
 */
export type Progress = { worked: number; rounds: number; works: number[] };

type Props = {
  phases: Phase[];
  /** When the timer started, in ms since the epoch: it may be earlier than now after a reload. */
  startedAt: number;
  onDone: (progress: Progress) => void;
  /** Stopped early: what the button says, and how far the timer got. */
  stop: { title: string; onStop: (progress: Progress) => void };
};

export function Countdown({ phases, startedAt, onDone, stop }: Props) {
  const z = useSizes();
  const elapsedNow = () => (Date.now() - startedAt) / 1000;
  // Signals that fell while the page was closed are not given: a timer that ended then just closes.
  const lastCheck = useRef(elapsedNow());
  const [elapsed, setElapsed] = useState(elapsedNow);
  const state = timerAt(phases, elapsed);
  const workDone = (upTo: number) => phases.slice(0, upTo).filter((p) => p.kind === 'work').length;
  const progressAt = (seconds: number, rounds: number): Progress => {
    const works = workedSeconds(phases, seconds);
    return { worked: works[0] ?? 0, rounds, works };
  };
  const progress = progressAt(elapsed, workDone(state.index));

  useEffect(() => {
    keepAwake(true);
    const timer = setInterval(() => {
      const now = elapsedNow();
      for (const cue of cuesBetween(phases, lastCheck.current, now)) signal(cue);
      lastCheck.current = now;
      setElapsed(now);
    }, 200);
    return () => {
      clearInterval(timer);
      keepAwake(false);
    };
  }, [phases, startedAt]);

  const done = state.done;
  useEffect(() => {
    if (done) onDone(progressAt(Infinity, workDone(phases.length)));
  }, [done]);

  return (
    <View style={[styles.box, { padding: z.space(2.5), gap: z.space(1) }, state.kind === 'work' && styles.work]}>
      <Text style={[styles.label, { fontSize: z.font(18) }, state.kind === 'work' && styles.workLabel]}>
        {LABELS[state.kind]}
      </Text>
      {phases[state.index].label ? (
        <Text style={[styles.what, { fontSize: z.font(18) }]}>{phases[state.index].label}</Text>
      ) : null}
      <Text
        style={[
          styles.timer,
          { fontSize: z.timer, lineHeight: z.timer * 1.05 },
          state.kind === 'prepare' && styles.prepare,
        ]}
      >
        {clock(state.remaining)}
      </Text>
      <View style={styles.stop}>
        <Button title={stop.title} variant="outline" onPress={() => stop.onStop(progress)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12 },
  work: { borderWidth: 2, borderColor: colors.accent },
  label: { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  workLabel: { color: colors.accent, fontWeight: '700' },
  what: { color: colors.text, fontWeight: '600', textAlign: 'center' },
  // Sized by useSizes: 96 on a common phone, large enough to read from a bench or the floor.
  timer: { color: colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  prepare: { color: colors.warning },
  // The whole width of the box: easy to hit while holding a position.
  stop: { alignSelf: 'stretch' },
});
