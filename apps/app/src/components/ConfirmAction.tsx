// A destructive action behind a confirmation shown in the page (browser dialogs block the app).

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../theme';

type Props = {
  title: string;
  /** What is lost, said before confirming. */
  question: string;
  confirm: string;
  onConfirm: () => void;
};

export function ConfirmAction({ title, question, confirm, onConfirm }: Props) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setAsking(true)} hitSlop={8}>
        <Text style={styles.link}>{title}</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.box}>
      <Text style={styles.question}>{question}</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => setAsking(false)} hitSlop={8}>
          <Text style={styles.cancel}>No, tienilo</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onConfirm} hitSlop={8}>
          <Text style={styles.confirm}>{confirm}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.warning, fontSize: 15, textAlign: 'center', paddingVertical: space(1) },
  box: { gap: space(3), borderWidth: 1, borderColor: colors.warning, borderRadius: 10, padding: space(3) },
  question: { color: colors.text, fontSize: 15 },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  cancel: { color: colors.textMuted, fontSize: 15 },
  confirm: { color: colors.warning, fontSize: 15, fontWeight: '700' },
});
