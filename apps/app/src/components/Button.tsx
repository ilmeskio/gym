import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'solid' | 'outline';
  disabled?: boolean;
  /** In a row of buttons: shares the space with the others. */
  inRow?: boolean;
};

export function Button({ title, onPress, variant = 'solid', disabled, inRow }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'solid' ? styles.solid : styles.outline,
        inRow && { flex: 1 },
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.text, variant === 'solid' && { color: colors.background }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // At least 48 dp high: the minimum touch target on Android.
  base: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: { backgroundColor: colors.accent },
  outline: { borderWidth: 1, borderColor: colors.border },
  text: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
