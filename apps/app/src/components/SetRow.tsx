// A logged set: tap it to correct the load and reps, or to delete it.
// The same form adds a missing set.

import type { LoggedSet } from '@gymapp/log';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { kg } from '../format';
import { colors, space } from '../theme';
import { Stepper } from './Stepper';

export type Unit = 'reps' | 'seconds';

type Props = {
  set: LoggedSet;
  number: number;
  unit: Unit;
  /** A mark at the right of the row, such as the rep max search advice. */
  mark?: ReactNode;
  onSave: (change: { kg: number; reps: number }) => void;
  onDelete: () => void;
};

export const describeSet = (s: Pick<LoggedSet, 'kg' | 'reps'>, unit: Unit) =>
  `${kg(s.kg)} × ${s.reps}${unit === 'seconds' ? '"' : ''}`;

export function SetRow({ set, number, unit, mark, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <SetForm
        title={`Serie ${number}`}
        initial={{ kg: set.kg, reps: set.reps }}
        unit={unit}
        onSave={(change) => {
          onSave(change);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
        onDelete={onDelete}
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Serie ${number}: ${describeSet(set, unit)}. Tocca per modificare`}
      onPress={() => setEditing(true)}
      style={styles.row}
    >
      <Text style={styles.value}>
        {number}. {describeSet(set, unit)}
      </Text>
      <View style={styles.right}>
        {mark}
        <Text style={styles.pencil}>✎</Text>
      </View>
    </Pressable>
  );
}

type FormProps = {
  title: string;
  initial: { kg: number; reps: number };
  unit: Unit;
  onSave: (set: { kg: number; reps: number }) => void;
  onCancel: () => void;
  /** Only for a set that already exists. */
  onDelete?: () => void;
};

/** Load and reps of a set, to correct or to add. */
export function SetForm({ title, initial, unit, onSave, onCancel, onDelete }: FormProps) {
  const [values, setValues] = useState(initial);

  return (
    <View style={styles.form}>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.fields}>
        <Stepper
          label="Carico"
          unit="kg"
          zero="corpo libero"
          value={values.kg}
          onChange={(kg) => setValues({ ...values, kg })}
        />
        <Stepper
          label={unit === 'seconds' ? 'Secondi' : 'Ripetizioni'}
          unit={unit === 'seconds' ? 'sec' : 'rip'}
          value={values.reps}
          onChange={(reps) => setValues({ ...values, reps })}
        />
      </View>
      <View style={styles.actions}>
        {onDelete ? (
          <Pressable accessibilityRole="button" onPress={onDelete}>
            <Text style={styles.delete}>Elimina</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <View style={styles.right}>
          <Pressable accessibilityRole="button" onPress={onCancel}>
            <Text style={styles.link}>Annulla</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onSave(values)}>
            <Text style={styles.save}>Salva</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space(1) },
  right: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
  value: { color: colors.text, fontSize: 17 },
  pencil: { color: colors.textMuted, fontSize: 16 },
  form: { gap: space(2), borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: space(3) },
  label: { color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  fields: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space(3),
  },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space(1) },
  delete: { color: colors.warning, fontSize: 15 },
  link: { color: colors.textMuted, fontSize: 15 },
  save: { color: colors.accent, fontSize: 15, fontWeight: '700' },
});
