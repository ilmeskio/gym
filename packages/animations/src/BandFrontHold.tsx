// Fermo alla fronte presa supina con loop band: standing on the band, arms straight with the
// palms up, the hands rise in front of the body to the height of the forehead, stay there
// 2" and come back down.

import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { BODY, Head, Limb, MACHINE, MACHINE_EDGE, Muscle, OUTLINE, reach, Scene, type Point } from './figure.tsx';

const ease = { easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Standing, the figure needs the whole height of the view: the floor sits near its bottom.
const FLOOR = 362;

const BAND = '#e8a33d';
const PALM = '#eef0f2';

/** The loop band, from under the foot to the hands: two strands close together. */
function Band({ from, to }: { from: Point; to: Point }) {
  return (
    <g stroke={BAND} strokeWidth={4} strokeLinecap="round" fill="none">
      <line x1={from.x - 4} y1={from.y} x2={to.x - 3} y2={to.y} />
      <line x1={from.x + 4} y1={from.y} x2={to.x + 3} y2={to.y} />
    </g>
  );
}

/** A hand seen from the side with the palm up: the light palm faces the sky. */
function PalmUp({ at }: { at: Point }) {
  return (
    <g>
      <ellipse cx={at.x} cy={at.y} rx={11} ry={7} fill={BODY} stroke={OUTLINE} strokeWidth={2} />
      <ellipse cx={at.x} cy={at.y - 3} rx={8} ry={3} fill={PALM} />
    </g>
  );
}

export function BandFrontHold() {
  const frame = useCurrentFrame();
  // 0 hands down in front of the thighs, 1 at the height of the forehead: up, held 2", down.
  const up = interpolate(frame, [15, 45, 105, 135], [0, 1, 1, 0], ease);
  const armAngle = interpolate(up, [0, 1], [-78, 17]);

  const foot = { x: 168, y: FLOOR + 2 };
  const knee = { x: 166, y: FLOOR - 58 };
  const hip = { x: 164, y: FLOOR - 120 };
  const shoulder = { x: 166, y: FLOOR - 212 };
  const head = { x: 172, y: FLOOR - 240 };
  const hand = reach(shoulder, 104, armAngle, 'right');

  return (
    <Scene mat={false}>
      <rect x={60} y={FLOOR + 8} width={240} height={8} rx={4} fill={MACHINE} stroke={MACHINE_EDGE} />
      <Band from={{ x: foot.x + 6, y: foot.y + 6 }} to={hand} />
      <Limb from={hip} to={knee} width={22} />
      <Limb from={knee} to={foot} width={17} />
      <ellipse cx={foot.x + 12} cy={foot.y + 2} rx={16} ry={6} fill={OUTLINE} />
      <Limb from={shoulder} to={hip} width={34} />
      <Head at={head} />
      <Limb from={shoulder} to={hand} width={13} />
      {/* The front of the shoulder, which holds the arms up. */}
      <Muscle from={reach(shoulder, 2, armAngle + 90, 'right')} to={reach(shoulder, 22, armAngle, 'right')} width={10} />
      <PalmUp at={hand} />
    </Scene>
  );
}
