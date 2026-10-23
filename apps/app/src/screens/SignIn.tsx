import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { redirectUrl, supabase } from '../data/supabase';
import { colors, space } from '../theme';

/** `forClaude`: signing in to connect an assistant, so no demo. */
export function SignIn({ forClaude = false }: { forClaude?: boolean }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'typing' | 'sending' | 'sent'>('typing');
  const [error, setError] = useState<string>();

  async function enterDemo() {
    setError(undefined);
    const { error } = await supabase.auth.signInAnonymously();
    if (error) setError(error.message);
  }

  async function sendLink() {
    setStatus('sending');
    setError(undefined);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectUrl() },
    });
    if (error) {
      setError(error.message);
      setStatus('typing');
    } else setStatus('sent');
  }

  return (
    <View style={styles.content}>
      <Text style={styles.title}>Scheda Palestra</Text>
      {status === 'sent' ? (
        <Text style={styles.text}>
          Ti ho mandato un link a {email.trim()}. Aprilo da questo dispositivo per entrare.
        </Text>
      ) : (
        <>
          <Text style={styles.text}>
            {forClaude
              ? 'Per collegare Claude alla tua scheda entra con la tua email: ti arriva un link, niente password.'
              : 'Entra con la tua email: ti arriva un link, niente password.'}
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={styles.field}
            onSubmitEditing={sendLink}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Mandami il link" onPress={sendLink} disabled={!email.includes('@') || status === 'sending'} />
          {forClaude ? null : (
            <>
              <Button title="Prova senza account" variant="outline" onPress={enterDemo} />
              <Text style={styles.note}>
                La demo usa una scheda d'esempio e ha dati suoi, salvati su questo dispositivo e sul server, separati da
                quelli di chiunque altro.
              </Text>
            </>
          )}
        </>
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
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  text: { color: colors.textMuted, fontSize: 16 },
  error: { color: colors.warning },
  note: { color: colors.textMuted, fontSize: 13 },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: space(3),
    color: colors.text,
    fontSize: 16,
  },
});
