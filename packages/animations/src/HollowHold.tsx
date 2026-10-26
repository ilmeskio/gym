// Barchetta (hollow body hold): from lying flat, shoulders, arms and legs rise together with the
// lower back on the floor, hold, and come back down.

import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { Scene, Supine } from './figure.tsx';

const ease = { easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export function HollowHold() {
  const frame = useCurrentFrame();
  // 0 lying flat, 1 in the hold: up in one second, held for two, down in one.
  const up = interpolate(frame, [15, 45, 105, 135], [0, 1, 1, 0], ease);
  return (
    <Scene>
      <Supine torso={up * 28} arms={6 + up * 26} legs={up * 22} />
    </Scene>
  );
}
