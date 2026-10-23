// The whole plan, as in the Excel file: one day at a time, exercises by row and weeks by column.
// The original file opens in the viewer (ExcelFile).

import { prescription, type Plan } from '@gymapp/plan';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, space } from '../theme';

type Props = { plan: Plan; onExcelFile?: () => void; onBack: () => void };

export function FullPlan({ plan, onExcelFile, onBack }: Props) {
  const [dayId, setDayId] = useState(plan.days[0].id);
  const day = plan.days.find((d) => d.id === dayId)!;
  const weeks = Array.from({ length: plan.weekCount }, (_, i) => i + 1);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
        <Text style={styles.back}>‹ Scheda</Text>
      </Pressable>
      <Text style={styles.title}>{plan.title}</Text>

      <View style={styles.tabs}>
        {plan.days.map((d) => (
          <Pressable
            key={d.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: d.id === dayId }}
            onPress={() => setDayId(d.id)}
            style={[styles.tab, d.id === dayId && styles.tabChosen]}
          >
            <Text style={[styles.tabText, d.id === dayId && { color: colors.background }]}>Giorno {d.id}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal>
        <View>
          <View style={styles.row}>
            <Text style={[styles.cell, styles.exercise, styles.header]}>Esercizio</Text>
            {weeks.map((n) => (
              <Text key={n} style={[styles.cell, styles.header]}>
                Sett. {n}
              </Text>
            ))}
          </View>
          {day.exercises.map((e) => (
            <View key={e.id} style={styles.row}>
              <Text style={[styles.cell, styles.exercise]}>{e.name.trim()}</Text>
              {weeks.map((n) => {
                // Only what the week changes from the previous one is shown, as in the sheet.
                const entry = e.weeks[n - 1] ?? {};
                const value = n === 1 ? prescription(e, 1) : entry;
                return (
                  <Text key={n} style={styles.cell}>
                    {[value.setsReps, value.load, value.rest && `rec. ${value.rest}`, value.tut]
                      .filter(Boolean)
                      .join('\n')}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      <Text style={styles.muted}>Una cella vuota vale quanto la settimana prima.</Text>

      {onExcelFile ? <Button title="Vedi il file Excel originale" variant="outline" onPress={onExcelFile} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(3), maxWidth: 960, width: '100%', alignSelf: 'center' },
  back: { color: colors.textMuted, fontSize: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 14 },
  tabs: { flexDirection: 'row', gap: space(2) },
  tab: {
    paddingVertical: space(2),
    paddingHorizontal: space(4),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChosen: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.text, fontWeight: '600' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  cell: { width: 110, padding: space(2), color: colors.text, fontSize: 13 },
  exercise: { width: 170, textTransform: 'capitalize' },
  header: { color: colors.textMuted, fontSize: 12, textTransform: 'uppercase' },
});
