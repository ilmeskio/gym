// The consent screen of the app's OAuth server: an MCP client such as Claude asks to read and
// write the user's plans and log, and the user allows it or not.

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { clearAuthorization } from '../data/authorization';
import { supabase } from '../data/supabase';
import { colors, space } from '../theme';

type Request = { client: string; email: string };

export function Consent({ authorizationId, onDone }: { authorizationId: string; onDone: () => void }) {
  const [request, setRequest] = useState<Request>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const leave = (url: string) => {
    clearAuthorization();
    window.location.href = url;
  };

  useEffect(() => {
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (error || !data) {
        clearAuthorization();
        setError('La richiesta non è più valida: ricomincia il collegamento da Claude.');
      } else if ('redirect_url' in data) {
        // Already allowed before: straight back to the client.
        leave(data.redirect_url);
      } else {
        setRequest({ client: data.client.name, email: data.user.email });
      }
    });
  }, [authorizationId]);

  async function decide(allow: boolean) {
    setBusy(true);
    const options = { skipBrowserRedirect: true };
    const { data, error } = allow
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, options)
      : await supabase.auth.oauth.denyAuthorization(authorizationId, options);
    if (error || !data) {
      setBusy(false);
      setError(error?.message ?? 'Qualcosa non ha funzionato.');
      return;
    }
    leave(data.redirect_url);
  }

  return (
    <View style={styles.content}>
      <Text style={styles.title}>Collegare {request?.client ?? 'un assistente'}?</Text>
      {error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Button
            title="Torna all'app"
            variant="outline"
            onPress={() => {
              clearAuthorization();
              onDone();
            }}
          />
        </>
      ) : request ? (
        <>
          <Text style={styles.text}>
            {request.client} potrà leggere e scrivere le tue schede e vedere i tuoi allenamenti, come {request.email}.
            Puoi creare la scheda chiedendolo all'assistente, anche partendo dal file Excel del tuo personal trainer.
          </Text>
          <Button title="Consenti" onPress={() => decide(true)} disabled={busy} />
          <Button title="Rifiuta" variant="outline" onPress={() => decide(false)} disabled={busy} />
        </>
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: space(6),
    gap: space(4),
    justifyContent: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  text: { color: colors.textMuted, fontSize: 16 },
  error: { color: colors.warning, fontSize: 16 },
});
