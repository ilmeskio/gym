// Before the first plan: how to connect Claude to the app's MCP server and have it write the plan.

import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, space } from '../theme';

export const MCP_URL = `${process.env.EXPO_PUBLIC_API_URL}/mcp`;

export function NoPlan({ onSignOut }: { onSignOut: () => void }) {
  const [copied, setCopied] = useState(false);
  const canCopy = Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.clipboard;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Crea la tua scheda</Text>
      <Text style={styles.text}>
        La scheda la scrive Claude per te: collegalo all'app, poi dagli il file Excel del tuo personal trainer o
        descrivigli gli esercizi. La scheda compare qui appena è pronta.
      </Text>

      <Text style={styles.label}>Indirizzo del server MCP</Text>
      <Text selectable style={styles.url}>
        {MCP_URL}
      </Text>
      {canCopy ? (
        <Button
          title={copied ? 'Copiato' : 'Copia indirizzo'}
          variant="outline"
          onPress={() => navigator.clipboard.writeText(MCP_URL).then(() => setCopied(true))}
        />
      ) : null}

      <View style={styles.steps}>
        <Text style={styles.step}>
          <Text style={styles.strong}>Claude (web o app): </Text>
          Impostazioni › Connettori › Aggiungi connettore personalizzato, incolla l'indirizzo e accedi con la tua email
          quando te lo chiede.
        </Text>
        <Text style={styles.step}>
          <Text style={styles.strong}>Claude Code: </Text>
          <Text selectable style={styles.code}>
            claude mcp add --transport http gym {MCP_URL}
          </Text>
          , poi /mcp per accedere.
        </Text>
        <Text style={styles.step}>
          Poi chiedi, per esempio: «Crea la mia scheda da questo file Excel e allega il file originale».
        </Text>
      </View>

      <Button title="Esci" variant="outline" onPress={onSignOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(6), gap: space(4), maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  text: { color: colors.textMuted, fontSize: 16 },
  label: { color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  url: {
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: space(3),
  },
  steps: { gap: space(3) },
  step: { color: colors.textMuted, fontSize: 15 },
  strong: { color: colors.text, fontWeight: '700' },
  code: { color: colors.text, fontFamily: Platform.select({ web: 'monospace', default: undefined }) },
});
