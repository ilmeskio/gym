// The plan's original Excel file, downloaded from the API and drawn as a sheet.

import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { planFile, planFileLink } from '../data/api';
import type { Grid } from '../excel';
import { colors, space } from '../theme';

/** Light text on dark fills, dark text on light ones. */
function textColour(fill: string | undefined): string | undefined {
  if (!fill) return undefined;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? '#111111' : '#f2f4f8';
}

export function ExcelFile({ planId, onBack }: { planId: string; onBack: () => void }) {
  const [grid, setGrid] = useState<Grid>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    planFile(planId)
      .then(async (file) => {
        // The Excel reader is heavy: it loads only when needed.
        const { readExcel } = await import('../excel');
        const g = readExcel(file);
        if (active) setGrid(g);
      })
      .catch(() => active && setError('Il file non si apre: serve la rete.'));
    return () => {
      active = false;
    };
  }, [planId]);

  async function download() {
    const url = await planFileLink(planId).catch(() => undefined);
    if (url) Linking.openURL(url);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
          <Text style={styles.link}>‹ Scheda completa</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={download} hitSlop={12}>
          <Text style={styles.link}>Scarica</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>File Excel originale</Text>
      {grid ? <Text style={styles.muted}>Foglio «{grid.name}»</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!grid && !error ? <ActivityIndicator color={colors.accent} /> : null}

      {grid ? (
        <ScrollView horizontal style={styles.sheet}>
          <View>
            {grid.rows.map((row, r) => (
              <View key={r} style={styles.row}>
                {row.map((cell, c) => (
                  <Text
                    key={c}
                    style={[
                      styles.cell,
                      {
                        width: cell.width,
                        backgroundColor: cell.fill ?? '#ffffff',
                        color: textColour(cell.fill) ?? '#111111',
                      },
                    ]}
                  >
                    {cell.text}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), gap: space(3) },
  bar: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { color: colors.textMuted, fontSize: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.warning },
  sheet: { borderRadius: 8, backgroundColor: '#ffffff' },
  row: { flexDirection: 'row' },
  cell: {
    minHeight: 22,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontSize: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#c8c8c8',
  },
});
