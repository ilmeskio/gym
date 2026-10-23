import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { EFFORT } from '../format';
import { colors, space } from '../theme';

type Props = {
  heading: string;
  summary: string;
  onClose: (feedback: { effort: number; note?: string }) => void;
  onBack: () => void;
};

export function Finish({ heading, summary, onClose, onBack }: Props) {
  const [effort, setEffort] = useState<number>();
  const [note, setNote] = useState('');

  return (
    <View style={styles.content}>
      <Text style={styles.title}>Fine allenamento</Text>
      <Text style={styles.text}>{heading}</Text>
      <Text style={styles.text}>{summary}</Text>

      <Text style={styles.label}>Com'è andata?</Text>
      <View style={styles.scale}>
        {EFFORT.map((name, i) => (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityState={{ selected: effort === i + 1 }}
            onPress={() => setEffort(i + 1)}
            style={[styles.option, effort === i + 1 && styles.optionChosen]}
          >
            <Text style={[styles.number, effort === i + 1 && { color: colors.background }]}>{i + 1}</Text>
            <Text style={[styles.name, effort === i + 1 && { color: colors.background }]}>{name}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Una nota per la prossima volta (facoltativa)"
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.field}
      />
      <Button
        title="Chiudi allenamento"
        disabled={!effort}
        onPress={() => effort && onClose({ effort, ...(note.trim() && { note: note.trim() }) })}
      />
      <Button title="‹ Torna agli esercizi" variant="outline" onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: space(6),
    gap: space(4),
    justifyContent: 'center',
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  text: { color: colors.textMuted, fontSize: 16 },
  label: { color: colors.textMuted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginTop: space(2) },
  scale: { flexDirection: 'row', gap: space(2) },
  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: space(3),
    alignItems: 'center',
    gap: space(1),
  },
  optionChosen: { backgroundColor: colors.accent, borderColor: colors.accent },
  number: { color: colors.text, fontSize: 20, fontWeight: '700' },
  name: { color: colors.textMuted, fontSize: 11 },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: space(3),
    color: colors.text,
    fontSize: 16,
    minHeight: 72,
  },
});
