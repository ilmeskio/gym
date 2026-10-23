import type { Step } from '@gymapp/plan';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, space } from '../theme';

type Props = {
  title: string;
  week: number;
  steps: Step[];
  /** A workout is already in progress: starting another leaves it open. */
  inProgressWarning: boolean;
  onStart: () => void;
  onBack: () => void;
};

/** A one-line summary of the prescription: sets, load, or the week's task. */
export function summary(step: Step) {
  const { prescription: p, findRepMax, useRepMax } = step;
  if (findRepMax) return `trova il tuo ${findRepMax}RM`;
  return [p.setsReps, p.load ?? (useRepMax && `il tuo ${useRepMax}RM`)].filter(Boolean).join(' · ');
}

export function Preview({ title, week, steps, inProgressWarning, onStart, onBack }: Props) {
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
        {steps.map((step) => (
          <View key={step.exercise.id} style={styles.item}>
            <Text style={styles.number}>{step.position}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{step.exercise.name.trim()}</Text>
              {summary(step) ? <Text style={styles.muted}>{summary(step)}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      {inProgressWarning ? (
        <Text style={styles.warning}>Hai un allenamento in corso: iniziandone uno nuovo, quello resta aperto.</Text>
      ) : null}
      <Button title="Inizia allenamento" onPress={onStart} />
    </ScrollView>
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
  item: { flexDirection: 'row', gap: space(3) },
  number: { color: colors.accent, fontSize: 16, fontWeight: '700', width: 22, textAlign: 'right' },
  name: { color: colors.text, fontSize: 16, textTransform: 'capitalize' },
});
