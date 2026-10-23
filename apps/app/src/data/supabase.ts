import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// The project's URL and public key are meant to live in the client;
// the API and Row Level Security protect the data. Supabase here is only for signing in.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (apps/app/.env)');
}

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // On the web the email link comes back to the app with the code in the URL.
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});

/** Where the email link comes back to: the app's own page. */
export const redirectUrl = () =>
  Platform.OS === 'web' ? window.location.origin + window.location.pathname : 'https://consiglio.fyi/gym/';
