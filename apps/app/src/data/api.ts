// The app's server: the API in packages/api, called with the signed-in user's token.

import type { OutboxEntry, ServerData, State } from '@gymapp/log';
import { supabase } from './supabase';

const base = process.env.EXPO_PUBLIC_API_URL;
if (!base) throw new Error('Missing EXPO_PUBLIC_API_URL (apps/app/.env)');

const PATHS = { workouts: 'workouts', sets: 'sets', repMaxes: 'rep-maxes' } as const;

async function call(path: string, init: { method?: string; body?: string } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('signed out');
  const response = await fetch(base + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body && { 'Content-Type': 'application/json' }) },
  });
  if (!response.ok) throw new Error(`API ${init.method ?? 'GET'} ${path}: ${response.status}`);
  return response;
}

export const download = async (): Promise<ServerData> => (await call('/data')).json();

/** Sends one outbox row: its current version, or its deletion if the state no longer has it. */
export async function send(state: State, entry: OutboxEntry) {
  if (entry.table === 'preferences') {
    await call('/preferences', { method: 'PUT', body: JSON.stringify(state.preferences) });
    return;
  }
  const row = state[entry.table][entry.key];
  const path = `/${PATHS[entry.table]}/${encodeURIComponent(entry.key)}`;
  await call(path, row ? { method: 'PUT', body: JSON.stringify(row) } : { method: 'DELETE' });
}

/** A plan's original Excel file. */
export const planFile = async (planId: string) => (await call(`/plans/${planId}/file`)).arrayBuffer();

/** A short-lived link to download a plan's Excel file. */
export const planFileLink = async (planId: string) =>
  ((await (await call(`/plans/${planId}/file/link`)).json()) as { url: string }).url;
