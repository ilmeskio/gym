// Test helpers: one user's rows in memory, as a database adapter would keep them,
// and an app whose users are recognised by fixed tokens.

import type { LoggedSet, Preferences, RepMax, ServerData, StoredPlan, Workout } from '@gymapp/log';
import { createApp, type Store, type User } from './index.ts';
import type { MediaSearch } from './media.ts';

export function memoryStore() {
  const data = {
    workouts: new Map<string, Workout>(),
    sets: new Map<string, LoggedSet>(),
    repMaxes: new Map<string, RepMax>(),
    preferences: undefined as Preferences | undefined,
    plans: new Map<string, StoredPlan>(),
    files: new Map<string, string>(),
  };
  const store: Store = {
    async download(): Promise<ServerData> {
      return {
        workouts: [...data.workouts.values()],
        sets: [...data.sets.values()],
        repMaxes: [...data.repMaxes.values()],
        ...(data.preferences && { preferences: data.preferences }),
        plans: [...data.plans.values()],
      };
    },
    async putWorkout(w) {
      data.workouts.set(w.id, w);
    },
    async deleteWorkout(id) {
      data.workouts.delete(id);
    },
    async putSet(s) {
      data.sets.set(s.id, s);
    },
    async deleteSet(id) {
      data.sets.delete(id);
    },
    async putRepMax(r) {
      data.repMaxes.set(r.exerciseId, r);
    },
    async deleteRepMax(exerciseId) {
      data.repMaxes.delete(exerciseId);
    },
    async putPreferences(p) {
      data.preferences = p;
    },
    async createPlan(stored) {
      data.plans.set(stored.id, stored);
    },
    async updatePlan(id, plan) {
      const current = data.plans.get(id);
      if (!current) return false;
      data.plans.set(id, { ...current, plan });
      return true;
    },
    async activatePlan(id, at) {
      const current = data.plans.get(id);
      if (!current) return false;
      data.plans.set(id, { ...current, activeSince: at });
      return true;
    },
    async planFile(planId) {
      const file = data.files.get(planId);
      return file === undefined ? undefined : (new TextEncoder().encode(file).buffer as ArrayBuffer);
    },
    async planFileLink(planId) {
      return data.files.has(planId) ? `https://files.example/${planId}.xlsx?signed` : undefined;
    },
    async planUploadLink(planId) {
      const current = data.plans.get(planId);
      if (!current) return undefined;
      data.plans.set(planId, { ...current, excel: true });
      return `https://files.example/upload/${planId}.xlsx?token=t`;
    },
  };
  return { data, store };
}

export const users: Record<string, User> = {
  'token-anna': { id: 'anna', anonymous: false, token: 'token-anna' },
  'token-demo': { id: 'demo', anonymous: true, token: 'token-demo' },
};

export const PUBLIC_URL = 'https://api.example/api';
export const AUTH_SERVER = 'https://project.supabase.co/auth/v1';

export function setup(search: MediaSearch = async () => ({ gif: [], photos: [] })) {
  const stores = new Map<string, ReturnType<typeof memoryStore>>();
  const storeOf = (id: string) => {
    if (!stores.has(id)) stores.set(id, memoryStore());
    return stores.get(id)!;
  };
  const app = createApp({
    verify: async (token) => users[token],
    store: (user) => storeOf(user.id).store,
    origins: ['https://consiglio.fyi'],
    mcp: { publicUrl: PUBLIC_URL, authorizationServer: AUTH_SERVER, search },
  });
  const call = (method: string, path: string, body?: unknown, token = 'token-anna') =>
    app.request(path, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  return { app, call, storeOf };
}
