// Rounds of reps: you do the reps and say when they are done, then a full rest runs and a signal
// starts the next round. Time comes from the clock, so it stays right if the page slows down or
// is reloaded.

import { roundCues, roundsAt, type Phase } from '@gymapp/plan';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { keepAwake, signal } from '../signal';
import { colors } from '../theme';
import { useSizes } from '../useSizes';
import { Button } from './Button';

const LABELS: Record<Phase['kind'], string> = { prepare: 'Preparati', work: 'Vai!', rest: 'Recupero' };

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type Props = {
  phases: Phase[];
  /** When the timer started, in ms since the epoch: it may be earlier than now after a reload. */
  startedAt: number;
  /** The rounds whose reps are done, in seconds after the start. */
  marks: number[];
  onMark: (seconds: number) => void;
  /** Finished or stopped: the rounds whose reps are done. */
  onEnd: (rounds: number) => void;
};

export function RoundsTimer({ phases, startedAt, marks, onMark, onEnd }: Props) {
  const z = useSizes();
  const elapsedNow = () => (Date.now() - startedAt) / 1000;
  // Signals that fell while the page was closed are not given.
  const lastCheck = useRef(elapsedNow());
  const [elapsed, setElapsed] = useState(elapsedNow);
  const state = roundsAt(phases, marks, elapsed);
  const latestMarks = useRef(marks);
  latestMarks.current = marks;

  useEffect(() => {
    keepAwake(true);
    const timer = setInterval(() => {
      const now = elapsedNow();
      for (const cue of roundCues(phases, latestMarks.current, lastCheck.current, now)) signal(cue);
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
    if (done) onEnd(marks.length);
  }, [done]);

  function markDone() {
    const now = elapsedNow();
    // The state follows at once, so the button does not stay under the finger until the next tick.
    setElapsed(now);
    onMark(now);
  }

  const working = state.kind === 'work';
  const label = phases[state.index].label;
  return (
    <View style={[styles.box, { padding: z.space(2.5), gap: z.space(1) }, working && styles.work]}>
      <Text style={[styles.label, { fontSize: z.font(18) }, working && styles.workLabel]}>{LABELS[state.kind]}</Text>
      {label ? <Text style={[styles.what, { fontSize: z.font(18) }]}>{label}</Text> : null}
      {state.remaining !== undefined ? (
        <Text
          style={[
            styles.timer,
            { fontSize: z.timer, lineHeight: z.timer * 1.05 },
            state.kind === 'prepare' && styles.prepare,
          ]}
        >
          {clock(state.remaining)}
        </Text>
      ) : null}
      {working ? (
        <View style={styles.action}>
          <Button title="Fatto" onPress={markDone} />
        </View>
      ) : null}
      <View style={styles.action}>
        <Button title="Stop" variant="outline" onPress={() => onEnd(marks.length)} />
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
  timer: { color: colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  prepare: { color: colors.warning },
  // The whole width of the box: easy to hit with tired arms.
  action: { alignSelf: 'stretch' },
});
