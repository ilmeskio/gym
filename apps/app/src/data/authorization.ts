// A sign-in request from an MCP client (such as Claude), sent here by Supabase Auth with an
// `authorization_id`. It is kept on the device so it survives signing in with the email link.

import { Platform } from 'react-native';

const KEY = 'oauth:authorization';
const web = Platform.OS === 'web' && typeof window !== 'undefined';

/** Takes the request from the address, if it arrived just now, and keeps it. */
export function pendingAuthorization(): string | undefined {
  if (!web) return undefined;
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get('authorization_id');
    if (fromUrl) {
      window.localStorage.setItem(KEY, fromUrl);
      url.searchParams.delete('authorization_id');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    return window.localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function clearAuthorization() {
  if (!web) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
