// A running timer: preparation, a timed hold or a rest, with beeps at 3-2-1 and a signal at
// the end of the round. Time comes from the clock, so it stays right if the page slows down
// or is reloaded.

import { cuesBetween, timerAt, type Phase } from '@gymapp/plan';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { keepAwake, signal } from '../signal';
import { colors, space } from '../theme';
import { Button } from './Button';

const LABELS: Record<Phase['kind'], string> = { prepare: 'Preparati', work: 'Vai!', rest: 'Recupero' };

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type Props = {
  phases: Phase[];
  /** When the timer started, in ms since the epoch: it may be earlier than now after a reload. */
  startedAt: number;
  /** The timer reached the end; `worked` is the seconds of the work phase, if there is one. */
  onDone: (worked: number) => void;
  /** Stopped early: what the button says, and the seconds of work done so far. */
  stop: { title: string; onStop: (worked: number) => void };
};

export function Countdown({ phases, startedAt, onDone, stop }: Props) {
  const elapsedNow = () => (Date.now() - startedAt) / 1000;
  // Signals that fell while the page was closed are not given: a timer that ended then just closes.
  const lastCheck = useRef(elapsedNow());
  const [elapsed, setElapsed] = useState(elapsedNow);
  const state = timerAt(phases, elapsed);
  const workIndex = phases.findIndex((p) => p.kind === 'work');
  const workStart = phases.slice(0, Math.max(workIndex, 0)).reduce((s, p) => s + p.seconds, 0);
  const worked = workIndex < 0 ? 0 : Math.min(Math.max(Math.floor(elapsed - workStart), 0), phases[workIndex].seconds);

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
    if (done) onDone(workIndex < 0 ? 0 : phases[workIndex].seconds);
  }, [done]);

  return (
    <View style={[styles.box, state.kind === 'work' && styles.work]}>
      <Text style={[styles.label, state.kind === 'work' && styles.workLabel]}>{LABELS[state.kind]}</Text>
      <Text style={[styles.timer, state.kind === 'prepare' && styles.prepare]}>{clock(state.remaining)}</Text>
      <View style={styles.stop}>
        <Button title={stop.title} variant="outline" onPress={() => stop.onStop(worked)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: space(2), backgroundColor: colors.surface, borderRadius: 12, padding: space(4) },
  work: { borderWidth: 2, borderColor: colors.accent },
  label: { color: colors.textMuted, fontSize: 20, textTransform: 'uppercase', letterSpacing: 1 },
  workLabel: { color: colors.accent, fontWeight: '700' },
  // Large enough to read from a bench or the floor.
  timer: { color: colors.text, fontSize: 96, fontWeight: '700', fontVariant: ['tabular-nums'] },
  prepare: { color: colors.warning },
  // The whole width of the box: easy to hit while holding a position.
  stop: { alignSelf: 'stretch' },
});
