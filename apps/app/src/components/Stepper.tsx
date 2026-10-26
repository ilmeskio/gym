// A number with − and +, which can also be typed: the load in kg or the reps.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, space } from '../theme';
import { useSizes } from '../useSizes';

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
  const z = useSizes();
  const [text, setText] = useState(show(value));
  const stepSize = { width: z.touch, height: z.touch, borderRadius: z.touch / 2 };
  useEffect(() => setText(show(value)), [value]);

  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: meno`}
        style={[styles.step, stepSize]}
        onPress={() => onChange(Math.max(0, value - step))}
      >
        <Text style={[styles.stepText, { fontSize: z.font(22) }]}>−</Text>
      </Pressable>
      <View style={[styles.middle, { width: z.font(60) }]}>
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
          style={[styles.number, { fontSize: z.font(22), width: z.font(60) }]}
        />
        {value === 0 && zero ? (
          <Text style={[styles.unit, { fontSize: z.font(12) }]}>{zero}</Text>
        ) : unit ? (
          <Text style={[styles.unit, { fontSize: z.font(12) }]}>{unit}</Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: più`}
        style={[styles.step, stepSize]}
        onPress={() => onChange(value + step)}
      >
        <Text style={[styles.stepText, { fontSize: z.font(22) }]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  // Sized by useSizes, never below 48 dp: the minimum touch target on Android, for sweaty hands.
  step: {
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.text },
  middle: { alignItems: 'center' },
  number: {
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 2,
    fontVariant: ['tabular-nums'],
  },
  // Fixed width, so a long text such as "corpo libero" wraps instead of widening the stepper.
  unit: { color: colors.textMuted, textAlign: 'center' },
});
