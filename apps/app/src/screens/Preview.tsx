// The day's workout before starting: each exercise with its demonstration, what the week asks
// and what was done last time.

import type { LoggedSet } from '@gymapp/log';
import { demos, stepDetails, type Step } from '@gymapp/plan';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { describeSet } from '../components/SetRow';
import { colors, space } from '../theme';

type Props = {
  title: string;
  week: number;
  steps: Step[];
  /** A workout is already in progress: starting another leaves it open. */
  inProgressWarning: boolean;
  /** The exercise's sets in the latest workout that included it. */
  lastSets: (exerciseId: string) => LoggedSet[] | undefined;
  onStart: () => void;
  onBack: () => void;
};

/** A one-line summary of the prescription: sets, load, or the week's task. */
export function summary(step: Step) {
  const { prescription: p, findRepMax, useRepMax } = step;
  if (findRepMax) return `trova il tuo ${findRepMax}RM`;
  return [p.setsReps, p.load ?? (useRepMax && `il tuo ${useRepMax}RM`)].filter(Boolean).join(' · ');
}

export function Preview({ title, week, steps, inProgressWarning, lastSets, onStart, onBack }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>‹ Scheda</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.muted}>
        Settimana {week} · {steps.length} esercizi
      </Text>

      <View style={styles.list}>
        {steps.map((step) => {
          const details = stepDetails(step);
          const last = lastSets(step.exercise.id);
          const unit = step.sets.target?.kind === 'seconds' ? 'seconds' : 'reps';
          return (
            <View key={step.exercise.id} style={styles.item}>
              <Thumbnail step={step} />
              <View style={{ flex: 1, gap: space(1) }}>
                <Text style={styles.name}>
                  <Text style={styles.number}>{step.position}. </Text>
                  {step.exercise.name.trim()}
                </Text>
                {summary(step) ? <Text style={styles.summary}>{summary(step)}</Text> : null}
                {details.length ? <Text style={styles.muted}>{details.join(' · ')}</Text> : null}
                {last?.length ? (
                  <Text style={styles.last}>Ultima volta: {last.map((x) => describeSet(x, unit)).join(', ')}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {inProgressWarning ? (
        <Text style={styles.warning}>Hai un allenamento in corso: iniziandone uno nuovo, quello resta aperto.</Text>
      ) : null}
      <Button title="Inizia allenamento" onPress={onStart} />
    </ScrollView>
  );
}

/** The first frame of the exercise's demonstration, falling back to the photos if the GIF fails. */
function Thumbnail({ step }: { step: Step }) {
  const [gifFailed, setGifFailed] = useState(false);
  const uri = demos(step.exercise.media, !gifFailed)[0]?.frames[0];
  if (!uri) return <View style={styles.thumb} />;
  return (
    <Image
      source={uri}
      contentFit="contain"
      accessibilityLabel={step.exercise.name}
      onError={() => setGifFailed(true)}
      style={styles.thumb}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(3), maxWidth: 640, width: '100%', alignSelf: 'center' },
  back: { color: colors.textMuted, fontSize: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 15 },
  warning: { color: colors.warning, fontSize: 15 },
  list: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: space(4),
    gap: space(3),
    marginVertical: space(2),
  },
  item: { flexDirection: 'row', gap: space(3), alignItems: 'flex-start' },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#ffffff' },
  number: { color: colors.accent, fontWeight: '700' },
  name: { color: colors.text, fontSize: 16, textTransform: 'capitalize' },
  summary: { color: colors.text, fontSize: 15 },
  last: { color: colors.accent, fontSize: 14 },
});
