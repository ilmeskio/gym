// Timer signals on the phone: vibration. The web version (signal.web.ts) also beeps.

import type { Cue } from '@gymapp/plan';
import { Vibration } from 'react-native';

const PATTERN: Record<Cue, number | number[]> = { tick: 60, go: 300, end: [0, 400, 150, 400] };

/** Call from a press: on the web, sound may start only after a user gesture. */
export function unlockSignals() {}

export function signal(cue: Cue) {
  Vibration.vibrate(PATTERN[cue]);
}

/** Keeps the screen on while a timer runs. */
export function keepAwake(_on: boolean) {}
