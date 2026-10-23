import type { State, Workout } from '@gymapp/log';
import { history, setsOf } from '@gymapp/log';
import type { Plan } from '@gymapp/plan';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { duration, EFFORT, longDay, time } from '../format';
import { colors, space } from '../theme';

type Props = {
  /** The plan each workout followed. */
  planOf: (workout: Workout) => Plan | undefined;
  state: State;
  onOpen: (workout: Workout) => void;
  onAdd: () => void;
  onBack: () => void;
};

export function History({ planOf, state, onOpen, onAdd, onBack }: Props) {
  const done = history(state);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>‹ Scheda</Text>
      </Pressable>
      <Text style={styles.title}>Allenamenti fatti</Text>
      <Button title="Aggiungi un allenamento già fatto" variant="outline" onPress={onAdd} />
      {done.length === 0 ? <Text style={styles.muted}>Ancora nessuno: il primo è il prossimo.</Text> : null}
      {done.map((w) => (
        <Pressable
          key={w.id}
          accessibilityRole="button"
          onPress={() => onOpen(w)}
          style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
        >
          <View style={{ flex: 1, gap: space(1) }}>
            <Text style={styles.date}>{longDay(w.startedAt)}</Text>
            <Text style={styles.name}>
              {planOf(w)?.days.find((d) => d.id === w.dayId)?.title ?? w.dayId} · settimana {w.week}
            </Text>
            <Text style={styles.muted}>
              {time(w.startedAt)} · {duration(w.startedAt, w.finishedAt!)} · {setsOf(state, w.id).length} serie
              {w.feedback ? ` · ${EFFORT[w.feedback.effort - 1].toLowerCase()}` : ''}
              {w.loggedLater ? ' · segnato dopo' : ''}
            </Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(3), maxWidth: 640, width: '100%', alignSelf: 'center' },
  back: { color: colors.textMuted, fontSize: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', marginBottom: space(2) },
  muted: { color: colors.textMuted, fontSize: 14 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: space(4),
    gap: space(3),
  },
  date: { color: colors.text, fontSize: 16, fontWeight: '600', textTransform: 'capitalize' },
  name: { color: colors.text, fontSize: 15 },
  arrow: { color: colors.textMuted, fontSize: 28 },
});
