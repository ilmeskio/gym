// Fermo alla fronte presa supina con loop band: hanging from the pull-up bar with the palms
// towards the face, a loop band from the bar under the knees to help, the body pulls up until the
// bar is at the height of the forehead, stays there and comes back down.

import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { BODY, Head, Limb, MACHINE, MACHINE_EDGE, Muscle, OUTLINE, reach, Scene, type Point } from './figure.tsx';

const ease = { easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const BAR = { x: 182, y: 82 };
const UPPER_ARM = 52;
const FOREARM = 52;

const BAND = '#e8a33d';

/** Where the elbow goes between shoulder and hand: in front of the body, as the arms bend. */
function elbowFor(shoulder: Point, hand: Point): Point {
  const dx = hand.x - shoulder.x;
  const dy = hand.y - shoulder.y;
  const d = Math.min(Math.hypot(dx, dy), UPPER_ARM + FOREARM - 0.01);
  const a = Math.acos((UPPER_ARM ** 2 + d ** 2 - FOREARM ** 2) / (2 * UPPER_ARM * d));
  const toHand = Math.atan2(dy, dx);
  return { x: shoulder.x + UPPER_ARM * Math.cos(toHand + a), y: shoulder.y + UPPER_ARM * Math.sin(toHand + a) };
}

/** The loop band, from the bar to under the knees: two strands close together. */
function Band({ from, to }: { from: Point; to: Point }) {
  return (
    <g stroke={BAND} strokeWidth={4} strokeLinecap="round" fill="none">
      <line x1={from.x - 3} y1={from.y} x2={to.x - 4} y2={to.y} />
      <line x1={from.x + 3} y1={from.y} x2={to.x + 4} y2={to.y} />
    </g>
  );
}

export function ChinUpHold() {
  const frame = useCurrentFrame();
  // 0 hanging with straight arms, 1 the bar at the height of the forehead: up, held 2", down.
  const up = interpolate(frame, [15, 45, 105, 135], [0, 1, 1, 0], ease);

  const shoulder = { x: interpolate(up, [0, 1], [178, 158]), y: interpolate(up, [0, 1], [189, 116]) };
  const head = { x: shoulder.x + 2, y: shoulder.y - 27 };
  const hip = { x: shoulder.x - 4, y: shoulder.y + 92 };
  // The knees bent, the shins behind: the band holds them from below.
  const knee = reach(hip, 62, -78, 'right');
  const foot = reach(knee, 56, -140, 'right');
  const hand = { x: BAR.x - 2, y: BAR.y + 4 };
  const elbow = elbowFor(shoulder, hand);

  return (
    <Scene mat={false}>
      {/* The pull-up bar, seen end on, with its upright. */}
      <rect x={BAR.x + 70} y={60} width={12} height={320} fill={MACHINE} stroke={MACHINE_EDGE} />
      <line x1={BAR.x} y1={BAR.y} x2={BAR.x + 76} y2={BAR.y} stroke={MACHINE_EDGE} strokeWidth={6} />
      <circle cx={BAR.x} cy={BAR.y} r={7} fill={MACHINE} stroke={MACHINE_EDGE} strokeWidth={2} />
      <Band from={BAR} to={{ x: knee.x + 4, y: knee.y + 10 }} />

      <Limb from={hip} to={knee} width={21} />
      <Limb from={knee} to={foot} width={16} />
      <ellipse cx={foot.x - 6} cy={foot.y + 2} rx={12} ry={5} fill={OUTLINE} />
      <Limb from={shoulder} to={hip} width={32} />
      {/* The lats, on the back of the torso. */}
      <Muscle from={{ x: shoulder.x - 9, y: shoulder.y + 10 }} to={{ x: hip.x - 9, y: hip.y - 30 }} width={9} />
      <Head at={head} />
      <Limb from={shoulder} to={elbow} width={13} />
      {/* The biceps, which with the palms towards the face pull hardest. */}
      <Muscle from={shoulder} to={elbow} width={8} />
      <Limb from={elbow} to={hand} width={11} />
      <circle cx={hand.x} cy={hand.y} r={7} fill={BODY} stroke={OUTLINE} strokeWidth={2} />
    </Scene>
  );
}
