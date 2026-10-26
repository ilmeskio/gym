// The log state for the whole app: saved on the device at every change
// and synced with the server API when there is a session and a connection.

import * as L from '@gymapp/log';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { forgetTimer } from '../timerStore';
import { download, send } from './api';
import { supabase } from './supabase';

// One log per user: leaving the demo and signing in with an email keeps the data apart.
const storageKey = (userId: string) => `log:v1:${userId}`;
const EVERY_MS = 30_000;

export type SyncStatus = 'synced' | 'pending' | 'offline';

type Value = {
  state: L.State;
  loaded: boolean;
  session: Session | null | undefined;
  sync: SyncStatus;
  startWorkout: (planId: string, dayId: string, week: number, past?: { at: string; durationMin: number }) => string;
  moveToExercise: (workoutId: string, index: number) => void;
  logSet: (set: { workoutId: string; exerciseId: string; kg: number; reps: number }) => void;
  editSet: (id: string, change: { kg: number; reps: number }) => void;
  removeSet: (id: string) => void;
  removeWorkout: (id: string) => void;
  saveRepMax: (repMax: { exerciseId: string; reps: number; kg: number; workoutId?: string }) => void;
  finishWorkout: (id: string, feedback: L.Feedback) => void;
  setStartDate: (planId: string, startDate: string) => void;
  setVideo: (exerciseId: string, youtube: string | undefined) => void;
};

const Context = createContext<Value | null>(null);

export function useData() {
  const value = useContext(Context);
  if (!value) throw new Error('useData must be used inside <DataProvider>');
  return value;
}

const now = () => new Date().toISOString();

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(L.emptyState);
  // Whose log is in memory: a user id, null when signed out, undefined before the first read.
  const [loadedFor, setLoadedFor] = useState<string | null>();
  const [session, setSession] = useState<Session | null>();
  const [offline, setOffline] = useState(false);
  const latest = useRef(state);
  latest.current = state;
  const syncing = useRef(false);
  const userId = session?.user.id;
  const sessionKnown = session !== undefined;
  // The state in memory is the current user's: only then it is saved and synced.
  // It turns true again after every sign-in, which starts the first download.
  const loaded = sessionKnown && loadedFor === (userId ?? null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionKnown) return;
    let active = true;
    const read = userId ? AsyncStorage.getItem(storageKey(userId)) : Promise.resolve(null);
    read
      .then((v) => active && setState(v ? L.fromStorage(v) : L.emptyState()))
      .catch(() => active && setState(L.emptyState()))
      .finally(() => {
        if (active) setLoadedFor(userId ?? null);
      });
    return () => {
      active = false;
    };
  }, [userId, sessionKnown]);

  useEffect(() => {
    if (loaded && userId) {
      AsyncStorage.setItem(storageKey(userId), JSON.stringify(state)).catch(() => {});
    }
  }, [state, loaded, userId]);

  const syncNow = useCallback(
    async (alsoPull: boolean) => {
      if (!userId || !loaded || syncing.current) return;
      syncing.current = true;
      try {
        for (const entry of latest.current.outbox) {
          const row = rowOf(latest.current, entry);
          await send(latest.current, entry);
          // A row that changed while being sent stays queued and goes out on the next round.
          setState((s) => (rowOf(s, entry) === row ? L.confirmSent(s, entry) : s));
        }
        if (alsoPull) {
          const server = await download();
          setState((s) => L.mergeFromServer(s, server));
        }
        setOffline(false);
      } catch {
        setOffline(true);
      } finally {
        syncing.current = false;
      }
    },
    [userId, loaded],
  );

  // At start and at sign-in: send and download. Then at every change, periodically and when the app is active again.
  useEffect(() => {
    syncNow(true);
    const timer = setInterval(() => syncNow(false), EVERY_MS);
    const app = AppState.addEventListener('change', (s) => s === 'active' && syncNow(true));
    return () => {
      clearInterval(timer);
      app.remove();
    };
  }, [syncNow]);

  useEffect(() => {
    if (!state.outbox.length) return;
    const timer = setTimeout(() => syncNow(false), 1000);
    return () => clearTimeout(timer);
  }, [state.outbox, syncNow]);

  const sync: SyncStatus = offline ? 'offline' : state.outbox.length ? 'pending' : 'synced';

  const value = useMemo<Value>(
    () => ({
      state,
      loaded,
      session,
      sync,
      startWorkout: (planId, dayId, week, past) => {
        const id = Crypto.randomUUID();
        setState((s) =>
          L.startWorkout(s, {
            id,
            planId,
            dayId,
            week,
            at: past?.at ?? now(),
            ...(past && { loggedLater: { durationMin: past.durationMin } }),
          }),
        );
        return id;
      },
      moveToExercise: (id, index) => setState((s) => L.moveToExercise(s, id, index)),
      logSet: (set) => setState((s) => L.logSet(s, { ...set, id: Crypto.randomUUID(), at: now() })),
      editSet: (id, change) => setState((s) => L.editSet(s, id, change)),
      removeSet: (id) => setState((s) => L.removeSet(s, id)),
      removeWorkout: (id) => {
        forgetTimer(id);
        setState((s) => L.removeWorkout(s, id));
      },
      saveRepMax: (repMax) => setState((s) => L.saveRepMax(s, { ...repMax, at: now() })),
      finishWorkout: (id, feedback) => {
        forgetTimer(id);
        setState((s) => {
          const workout = s.workouts[id];
          if (!workout) return s;
          return L.finishWorkout(s, id, { ...feedback, at: L.workoutEnd(workout, now()) });
        });
      },
      setStartDate: (planId, startDate) => setState((s) => L.setStartDate(s, planId, startDate)),
      setVideo: (exerciseId, youtube) => setState((s) => L.setVideo(s, exerciseId, youtube)),
    }),
    [state, loaded, session, sync],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function rowOf(state: L.State, entry: L.OutboxEntry) {
  const table: Record<string, unknown> =
    entry.table === 'preferences' ? { [L.PREFERENCES_KEY]: state.preferences } : state[entry.table];
  return JSON.stringify(table[entry.key] ?? null);
}
