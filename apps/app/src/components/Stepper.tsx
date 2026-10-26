// A number with − and +, which can also be typed: the load in kg or the reps.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, space } from '../theme';

type Props = {
  value: number;
  onChange: (value: number) => void;
  /** How much − and + change it. */
  step?: number;
  /** Text after the number, such as "kg". */
  unit?: string;
  /** What to show instead of 0, such as "corpo libero". */
  zero?: string;
  label: string;
};

const show = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

export function Stepper({ value, onChange, step = 1, unit, zero, label }: Props) {
  const [text, setText] = useState(show(value));
  useEffect(() => setText(show(value)), [value]);

  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: meno`}
        style={styles.step}
        onPress={() => onChange(Math.max(0, value - step))}
      >
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <View style={styles.middle}>
        <TextInput
          accessibilityLabel={label}
          value={text}
          onChangeText={(t) => {
            setText(t);
            const n = Number(t.replace(',', '.'));
            if (t.trim() !== '' && Number.isFinite(n) && n >= 0) onChange(n);
          }}
          onBlur={() => setText(show(value))}
          keyboardType="decimal-pad"
          selectTextOnFocus
          style={styles.number}
        />
        {value === 0 && zero ? (
          <Text style={styles.unit}>{zero}</Text>
        ) : unit ? (
          <Text style={styles.unit}>{unit}</Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: più`}
        style={styles.step}
        onPress={() => onChange(value + step)}
      >
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  // 48 dp: the minimum touch target on Android, for hands that may be sweaty.
  step: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.text, fontSize: 22 },
  middle: { alignItems: 'center', minWidth: 64 },
  number: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    width: 72,
    paddingVertical: 2,
    fontVariant: ['tabular-nums'],
  },
  unit: { color: colors.textMuted, fontSize: 12 },
});
