import { nextOpenDay, type Workout } from '@gymapp/log';
import type { Plan } from '@gymapp/plan';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ConfirmAction } from '../components/ConfirmAction';
import type { SyncStatus } from '../data/Data';
import { longDay, shortDate, time } from '../format';
import { colors, space } from '../theme';

type Props = {
  plan: Plan;
  week: number;
  /** The days already done in the chosen week, with their workout. */
  done: Record<string, Workout>;
  /** The plan's start date, `YYYY-MM-DD`. */
  startDate?: string;
  next: string;
  inProgress?: Workout;
  sync: SyncStatus;
  demo: boolean;
  onWeek: (week: number) => void;
  onRestart: () => void;
  onChoose: (dayId: string) => void;
  onResume: () => void;
  onCancel: () => void;
  onHistory: () => void;
  onFullPlan: () => void;
  onSignOut: () => void;
};

const SYNC: Record<SyncStatus, string> = {
  synced: 'Dati salvati sul server',
  pending: 'Salvataggio sul server in corso',
  offline: 'Senza rete: i dati restano sul telefono e partono appena torna',
};

export function Home(props: Props) {
  const { plan, week, startDate, next, inProgress } = props;
  const titleOf = (id: string) => plan.days.find((d) => d.id === id)?.title ?? id;
  // The day after the last one done, unless the chosen week already has it: then the next one it lacks.
  const suggestedDay = nextOpenDay(
    next,
    plan.days.map((d) => d.id),
    Object.keys(props.done),
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{plan.title}</Text>
      {props.demo ? <Text style={styles.demo}>Demo senza account</Text> : null}
      {startDate ? (
        <View style={styles.row}>
          <Text style={styles.muted}>Iniziata il {shortDate(startDate)}</Text>
          <Pressable accessibilityRole="button" onPress={props.onRestart}>
            <Text style={styles.link}>Ricomincia da oggi</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.muted}>La settimana 1 parte dal primo allenamento.</Text>
      )}

      {inProgress ? (
        <View style={styles.inProgress}>
          <Text style={styles.inProgressTitle}>
            {inProgress.loggedLater ? 'Allenamento da finire di segnare' : 'Allenamento in corso'}
          </Text>
          <Text style={styles.muted}>
            {titleOf(inProgress.dayId)} · settimana {inProgress.week} ·{' '}
            {inProgress.loggedLater ? longDay(inProgress.startedAt) : `iniziato alle ${time(inProgress.startedAt)}`}
          </Text>
          <Button title="Riprendi" onPress={props.onResume} />
          <ConfirmAction
            title="Annulla allenamento"
            question="L'allenamento e le serie registrate finora vengono cancellati, anche dal server."
            confirm="Sì, annullalo"
            onConfirm={props.onCancel}
          />
        </View>
      ) : null}

      <Text style={styles.label}>Settimana</Text>
      <View style={styles.weeks}>
        {Array.from({ length: plan.weekCount }, (_, i) => i + 1).map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityState={{ selected: n === week }}
            onPress={() => props.onWeek(n)}
            style={[styles.week, n === week && styles.weekChosen]}
          >
            <Text style={[styles.weekText, n === week && { color: colors.background }]}>{n}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Allenamento</Text>
      {plan.days.map((day) => {
        const suggested = !inProgress && day.id === suggestedDay;
        const doneOn = props.done[day.id];
        return (
          <Pressable
            key={day.id}
            accessibilityRole="button"
            onPress={() => props.onChoose(day.id)}
            style={({ pressed }) => [styles.day, suggested && styles.daySuggested, pressed && { opacity: 0.7 }]}
          >
            <View style={{ flex: 1 }}>
              {suggested ? <Text style={styles.suggested}>Tocca a questo</Text> : null}
              <Text style={styles.dayTitle}>{day.title}</Text>
              {doneOn ? (
                <Text style={styles.doneOn}>✓ Fatto {longDay(doneOn.startedAt)}</Text>
              ) : null}
              <Text style={styles.dayDetail} numberOfLines={2}>
                {day.exercises.length} esercizi · {day.exercises.map((e) => e.name.trim()).join(', ')}
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        );
      })}

      <View style={styles.more}>
        <Button title="Allenamenti fatti" variant="outline" inRow onPress={props.onHistory} />
        <Button title="Scheda completa" variant="outline" inRow onPress={props.onFullPlan} />
      </View>

      <View style={styles.row}>
        <Text style={[styles.muted, { flex: 1 }]}>{SYNC[props.sync]}</Text>
        <Pressable accessibilityRole="button" onPress={props.onSignOut}>
          <Text style={styles.link}>{props.demo ? 'Esci dalla demo' : 'Esci'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(3), maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  demo: { color: colors.warning, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', gap: space(3), alignItems: 'baseline' },
  muted: { color: colors.textMuted, fontSize: 15 },
  link: { color: colors.textMuted, textDecorationLine: 'underline', fontSize: 15 },
  inProgress: { backgroundColor: colors.accentDark, borderRadius: 12, padding: space(4), gap: space(2) },
  inProgressTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  label: { color: colors.textMuted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginTop: space(2) },
  weeks: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  week: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekChosen: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  day: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: space(4),
    gap: space(3),
    borderWidth: 1,
    borderColor: colors.surface,
  },
  daySuggested: { borderColor: colors.accent },
  suggested: {
    color: colors.accent,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: space(1),
  },
  dayTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  doneOn: { color: colors.accent, fontSize: 14, marginTop: space(1) },
  dayDetail: { color: colors.textMuted, marginTop: space(1) },
  arrow: { color: colors.textMuted, fontSize: 28 },
  more: { flexDirection: 'row', gap: space(3), marginTop: space(2) },
});
