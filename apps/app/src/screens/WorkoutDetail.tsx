import type { State, Workout } from '@gymapp/log';
import { lastTime, setsOf } from '@gymapp/log';
import { kgFromPlan, partOwner, prescription, readSets, secondPartId, supersetParts, type Exercise as PlanExercise, type Plan } from '@gymapp/plan';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SetForm, SetRow, type Unit } from '../components/SetRow';
import { useData } from '../data/Data';
import { duration, EFFORT, longDay, time } from '../format';
import { ConfirmAction } from '../components/ConfirmAction';
import { colors, space } from '../theme';

type Props = { plan: Plan; state: State; workout: Workout; onBack: () => void; onDelete: () => void };

export function WorkoutDetail({ plan, state, workout: w, onBack, onDelete }: Props) {
  const day = plan.days.find((d) => d.id === w.dayId);
  const sets = setsOf(state, w.id);
  // Every exercise of the day in plan order, both of a superset with reps, then those with sets that the plan
  // no longer has. A hold that follows each set, as in a superset with the side plank, is not logged.
  const withSecond = (e: PlanExercise) =>
    !!supersetParts(e.name) && !readSets(prescription(e, w.week).setsReps).then;
  const planned = day?.exercises.flatMap((e) => (withSecond(e) ? [e.id, secondPartId(e.id)] : [e.id])) ?? [];
  const exercises = [...new Set([...planned, ...sets.map((s) => s.exerciseId)])];
  const [addingTo, setAddingTo] = useState<string>();
  const data = useData();
  // The second exercise of a superset reads its name and prescription from the plan's exercise.
  const exerciseOf = (id: string) => day?.exercises.find((e) => e.id === partOwner(id));
  const isSecond = (id: string) => id !== partOwner(id);
  function nameOf(id: string) {
    const exercise = exerciseOf(id);
    if (!exercise) return id;
    const parts = supersetParts(exercise.name);
    return parts ? parts[isSecond(id) ? 1 : 0] : exercise.name.trim();
  }
  const prescriptionOf = (id: string) => {
    const exercise = exerciseOf(id);
    return exercise && prescription(exercise, w.week);
  };
  const unitOf = (id: string): Unit =>
    !isSecond(id) && readSets(prescriptionOf(id)?.setsReps).target?.kind === 'seconds' ? 'seconds' : 'reps';

  // A new set starts from the exercise's last one, here or last time, otherwise from the plan.
  function proposal(id: string) {
    const last = sets.filter((s) => s.exerciseId === id).at(-1) ?? lastTime(state, w.id, id)?.sets.at(-1);
    if (last) return { kg: last.kg, reps: last.reps };
    const reading = readSets(prescriptionOf(id)?.setsReps);
    const target = isSecond(id) ? reading.thenReps : reading.target?.kind !== 'max' ? reading.target : undefined;
    return { kg: kgFromPlan(prescriptionOf(id)?.load) ?? 0, reps: target?.max ?? 10 };
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>‹ Allenamenti fatti</Text>
      </Pressable>
      <Text style={styles.title}>{longDay(w.startedAt)}</Text>
      <Text style={styles.muted}>
        {day?.title ?? w.dayId} · settimana {w.week} · {time(w.startedAt)}
        {w.finishedAt ? `–${time(w.finishedAt)} (${duration(w.startedAt, w.finishedAt)})` : ''}
      </Text>
      {w.feedback ? (
        <View style={styles.feedback}>
          <Text style={styles.effort}>
            {w.feedback.effort} · {EFFORT[w.feedback.effort - 1]}
          </Text>
          {w.feedback.note ? <Text style={styles.text}>{w.feedback.note}</Text> : null}
        </View>
      ) : null}

      <Text style={styles.muted}>Tocca una serie per correggerla, o aggiungi quelle che mancano.</Text>
      {exercises.map((id) => {
        const own = sets.filter((s) => s.exerciseId === id);
        return (
          <View key={id} style={styles.exercise}>
            <Text style={styles.name}>{nameOf(id)}</Text>
            {own.length === 0 && addingTo !== id ? <Text style={styles.muted}>Nessuna serie</Text> : null}
            {own.map((s, i) => (
              <SetRow
                key={s.id}
                set={s}
                number={i + 1}
                unit={unitOf(id)}
                onSave={(change) => data.editSet(s.id, change)}
                onDelete={() => data.removeSet(s.id)}
              />
            ))}
            {addingTo === id ? (
              <SetForm
                title={`Serie ${own.length + 1}`}
                initial={proposal(id)}
                unit={unitOf(id)}
                onCancel={() => setAddingTo(undefined)}
                onSave={(set) => {
                  data.logSet({ workoutId: w.id, exerciseId: id, ...set });
                  setAddingTo(undefined);
                }}
              />
            ) : (
              <Pressable accessibilityRole="button" onPress={() => setAddingTo(id)} hitSlop={8}>
                <Text style={styles.add}>+ Aggiungi serie</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      <ConfirmAction
        title="Elimina allenamento"
        question="L'allenamento e tutte le sue serie vengono cancellati, anche dal server."
        confirm="Sì, eliminalo"
        onConfirm={onDelete}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(3), maxWidth: 640, width: '100%', alignSelf: 'center' },
  back: { color: colors.textMuted, fontSize: 16 },
  title: { color: colors.text, fontSize: 26, fontWeight: '700', textTransform: 'capitalize' },
  muted: { color: colors.textMuted, fontSize: 15 },
  text: { color: colors.text, fontSize: 16 },
  feedback: { backgroundColor: colors.surface, borderRadius: 12, padding: space(4), gap: space(1) },
  effort: { color: colors.accent, fontSize: 18, fontWeight: '600' },
  exercise: { backgroundColor: colors.surface, borderRadius: 12, padding: space(4), gap: space(1) },
  name: { color: colors.text, fontSize: 17, fontWeight: '600', textTransform: 'capitalize', marginBottom: space(1) },
  add: { color: colors.accent, fontSize: 15, marginTop: space(1) },
});
