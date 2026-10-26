// Timer signals on the phone: vibration. The web version (signal.web.ts) also beeps.

import type { Cue } from '@gymapp/plan';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Vibration } from 'react-native';
import { counted } from './awake';

const PATTERN: Record<Cue, number | number[]> = { tick: 60, go: 300, end: [0, 400, 150, 400] };

/** Call from a press: on the web, sound may start only after a user gesture. */
export function unlockSignals() {}

export function signal(cue: Cue) {
  Vibration.vibrate(PATTERN[cue]);
}

const TAG = 'workout';

/** Keeps the screen on while someone asks for it: the workout screen, a running timer. */
export const keepAwake = counted(
  () => activateKeepAwakeAsync(TAG).catch(() => {}),
  () => deactivateKeepAwake(TAG).catch(() => {}),
);
