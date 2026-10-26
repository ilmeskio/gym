import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';
import { useSizes } from '../useSizes';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'solid' | 'outline';
  disabled?: boolean;
  /** In a row of buttons: shares the space with the others. */
  inRow?: boolean;
};

export function Button({ title, onPress, variant = 'solid', disabled, inRow }: Props) {
  const z = useSizes();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { minHeight: z.touch, paddingVertical: z.space(3) },
        variant === 'solid' ? styles.solid : styles.outline,
        inRow && { flex: 1 },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.text, { fontSize: z.font(16) }, variant === 'solid' && { color: colors.background }]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Height from useSizes, never below 48 dp: the minimum touch target on Android.
  base: {
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: { backgroundColor: colors.accent },
  outline: { borderWidth: 1, borderColor: colors.border },
  text: { color: colors.text, fontWeight: '600', textAlign: 'center' },
});
