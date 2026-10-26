// The running timer, saved on the device so that a reload finds it. On the web it lives in
// localStorage; the native app (#5) will need an equivalent, such as AsyncStorage.

import { timerToResume, type SavedTimer } from '@gymapp/plan';

const KEY = 'timer:v1';
const storage = typeof localStorage === 'undefined' ? undefined : localStorage;

/** The timer saved for this exercise of this workout, if it is not too old. */
export function savedTimer(workoutId: string, exerciseId: string): SavedTimer | undefined {
  try {
    return timerToResume(storage?.getItem(KEY) ?? null, workoutId, exerciseId, Date.now());
  } catch {
    return undefined;
  }
}

/** Saves the timer that starts, or forgets it when it ends or stops. */
export function saveTimer(timer: SavedTimer | undefined) {
  try {
    if (timer) storage?.setItem(KEY, JSON.stringify(timer));
    else storage?.removeItem(KEY);
  } catch {}
}

/** Forgets the timer of a workout that is finished or deleted. */
export function forgetTimer(workoutId: string) {
  try {
    const saved = storage?.getItem(KEY);
    if (saved && JSON.parse(saved).workoutId === workoutId) storage?.removeItem(KEY);
  } catch {}
}
