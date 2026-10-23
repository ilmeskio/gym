// Timer signals in the browser: a beep with Web Audio, vibration where supported,
// and the screen kept on while a timer runs (Screen Wake Lock).

import type { Cue } from '@gymapp/plan';

let audio: AudioContext | undefined;

/** Call from a press: browsers let sound start only after a user gesture. */
export function unlockSignals() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
  } catch {}
}

const TONES: Record<Cue, { frequency: number; seconds: number; repeat: number }> = {
  tick: { frequency: 880, seconds: 0.12, repeat: 1 },
  go: { frequency: 1320, seconds: 0.4, repeat: 1 },
  end: { frequency: 1320, seconds: 0.3, repeat: 3 },
};

const VIBRATION: Record<Cue, number[]> = { tick: [60], go: [300], end: [400, 150, 400] };

export function signal(cue: Cue) {
  navigator.vibrate?.(VIBRATION[cue]);
  if (!audio) return;
  const { frequency, seconds, repeat } = TONES[cue];
  for (let i = 0; i < repeat; i++) {
    const start = audio.currentTime + i * seconds * 1.6;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.25, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds);
  }
}

let lock: { release: () => Promise<void> } | undefined;

/** Keeps the screen on while a timer runs. */
export function keepAwake(on: boolean) {
  const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<typeof lock> } })
    .wakeLock;
  if (on && !lock && wakeLock) {
    wakeLock
      .request('screen')
      .then((l) => (lock = l))
      .catch(() => {});
  } else if (!on && lock) {
    lock.release().catch(() => {});
    lock = undefined;
  }
}
