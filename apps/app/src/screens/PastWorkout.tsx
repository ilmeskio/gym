// A workout already done, to log: plan day, date, start time and duration.
// Then the sets are logged with the same flow as a live workout.

import { currentWeek, todayDate, type Plan } from '@gymapp/plan';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, space } from '../theme';

export type PastWorkoutInput = { dayId: string; week: number; date: string; time: string; durationMin: number };

type Props = {
  plan: Plan;
  /** The plan's start date, if there is one already. */
  startDate?: string;
  suggestedDay: string;
  onConfirm: (past: PastWorkoutInput) => void;
  onBack: () => void;
};

const DURATIONS = [45, 60, 75, 90];

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayDate(d);
};

/** `DD/MM/YYYY` (or `DD/MM`, this year) into `YYYY-MM-DD`. */
function readDate(text: string): string | undefined {
  const m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(text.trim());
  if (!m) return undefined;
  const year = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : String(new Date().getFullYear());
  const iso = `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}

const readTime = (text: string) =>
  /^([01]?\d|2[0-3])[:.]([0-5]\d)$/.test(text.trim()) ? text.trim().replace('.', ':').padStart(5, '0') : undefined;

export function PastWorkout({ plan, startDate, suggestedDay, onConfirm, onBack }: Props) {
  const [dayId, setDayId] = useState(suggestedDay);
  const [when, setWhen] = useState<'today' | 'yesterday' | 'other'>('today');
  const [otherDate, setOtherDate] = useState('');
  const [startTime, setStartTime] = useState('18:00');
  const [durationMin, setDurationMin] = useState(60);
  const [chosenWeek, setChosenWeek] = useState<number>();

  const date = when === 'today' ? todayDate() : when === 'yesterday' ? daysAgo(1) : readDate(otherDate);
  const validTime = readTime(startTime);
  const moment = date && validTime ? new Date(`${date}T${validTime}`) : undefined;
  const inFuture = moment ? moment.getTime() > Date.now() : false;
  // That day's week, counting from the plan's start (or from that day, if it is the first).
  const weekOfDay = date
    ? currentWeek(startDate && startDate < date ? startDate : date, new Date(`${date}T12:00`), plan.weekCount)
    : 1;
  const week = chosenWeek ?? weekOfDay;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>‹ Indietro</Text>
      </Pressable>
      <Text style={styles.title}>Allenamento già fatto</Text>
      <Text style={styles.muted}>Segna un allenamento fatto senza l'app: poi inserisci carichi e ripetizioni.</Text>

      <Text style={styles.label}>Giorno della scheda</Text>
      <Choices
        options={plan.days.map((d) => ({ value: d.id, text: `Giorno ${d.id}` }))}
        chosen={dayId}
        onChoose={setDayId}
      />

      <Text style={styles.label}>Quando</Text>
      <Choices
        options={[
          { value: 'today', text: 'Oggi' },
          { value: 'yesterday', text: 'Ieri' },
          { value: 'other', text: 'Altro giorno' },
        ]}
        chosen={when}
        onChoose={(v) => setWhen(v as typeof when)}
      />
      {when === 'other' ? (
        <TextInput
          value={otherDate}
          onChangeText={setOtherDate}
          placeholder="GG/MM/AAAA"
          placeholderTextColor={colors.textMuted}
          style={styles.field}
          autoFocus
        />
      ) : null}

      <Text style={styles.label}>Ora di inizio</Text>
      <TextInput
        value={startTime}
        onChangeText={setStartTime}
        placeholder="18:00"
        placeholderTextColor={colors.textMuted}
        style={styles.field}
      />

      <Text style={styles.label}>Durata</Text>
      <Choices
        options={DURATIONS.map((d) => ({ value: String(d), text: `${d} min` }))}
        chosen={String(durationMin)}
        onChoose={(v) => setDurationMin(Number(v))}
      />

      <Text style={styles.label}>Settimana</Text>
      <Choices
        options={Array.from({ length: plan.weekCount }, (_, i) => ({ value: String(i + 1), text: String(i + 1) }))}
        chosen={String(week)}
        onChoose={(v) => setChosenWeek(Number(v))}
      />

      {inFuture ? <Text style={styles.warning}>Quel momento non è ancora arrivato.</Text> : null}
      <Button
        title="Segna le serie"
        disabled={!date || !validTime || inFuture}
        onPress={() => date && validTime && onConfirm({ dayId, week, date, time: validTime, durationMin })}
      />
    </ScrollView>
  );
}

function Choices({
  options,
  chosen,
  onChoose,
}: {
  options: { value: string; text: string }[];
  chosen: string;
  onChoose: (v: string) => void;
}) {
  return (
    <View style={styles.choices}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: o.value === chosen }}
          onPress={() => onChoose(o.value)}
          style={[styles.choice, o.value === chosen && styles.choiceActive]}
        >
          <Text style={[styles.choiceText, o.value === chosen && { color: colors.background }]}>{o.text}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(3), maxWidth: 640, width: '100%', alignSelf: 'center' },
  back: { color: colors.textMuted, fontSize: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 15 },
  warning: { color: colors.warning, fontSize: 15 },
  label: { color: colors.textMuted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginTop: space(2) },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  choice: {
    paddingVertical: space(2),
    paddingHorizontal: space(4),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  choiceText: { color: colors.text, fontWeight: '600' },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: space(3),
    color: colors.text,
    fontSize: 16,
    marginTop: space(1),
  },
});
