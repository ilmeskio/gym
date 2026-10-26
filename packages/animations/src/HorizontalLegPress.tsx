// Leg press orizzontale: seated with the back on the pad and the feet on the plate in front, the
// legs push the plate away until they are almost straight, then bend back slowly. Two reps.

import { interpolate, useCurrentFrame } from 'remotion';
import { BODY, FLOOR, Head, Limb, MACHINE, MACHINE_EDGE, Muscle, OUTLINE, reach, Scene, type Point } from './figure.tsx';

const THIGH = 66;
const SHIN = 62;

/** Where the knee goes for the foot at `foot`: above the line from the hip, as the legs bend upwards. */
function kneeFor(hip: Point, foot: Point): Point {
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  const d = Math.hypot(dx, dy);
  const a = Math.acos((THIGH ** 2 + d ** 2 - SHIN ** 2) / (2 * THIGH * d));
  const toFoot = Math.atan2(dy, dx);
  return { x: hip.x + THIGH * Math.cos(toFoot - a), y: hip.y + THIGH * Math.sin(toFoot - a) };
}

function Pad({ from, to, width }: { from: Point; to: Point; width: number }) {
  return (
    <>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={MACHINE_EDGE} strokeWidth={width + 3} strokeLinecap="round" />
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={MACHINE} strokeWidth={width} strokeLinecap="round" />
    </>
  );
}

export function HorizontalLegPress() {
  const frame = useCurrentFrame();
  // 0 legs bent, 1 almost straight: a push and a slower return, twice.
  const t = frame % 75;
  const push = interpolate(t, [5, 30, 70], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const reachOfLegs = 82 + push * 40;

  const hip = { x: 128, y: 214 };
  const shoulder = reach(hip, 92, 112, 'right');
  const back = { x: hip.x - 20, y: hip.y - 4 };
  const head = reach(shoulder, 26, 106, 'right');
  const foot = { x: hip.x + reachOfLegs, y: hip.y - 22 };
  const knee = kneeFor(hip, foot);
  // The hands hold the handles beside the seat.
  const handle = { x: hip.x + 14, y: hip.y + 12 };
  const elbow = { x: shoulder.x + 30, y: shoulder.y + 52 };

  return (
    <Scene mat={false}>
      {/* The machine: rail on the floor, seat and back pad, and the plate the feet push. */}
      <rect x={34} y={FLOOR + 6} width={300} height={12} rx={4} fill={MACHINE} stroke={MACHINE_EDGE} />
      <rect x={hip.x - 12} y={hip.y + 18} width={14} height={FLOOR - hip.y - 12} fill={MACHINE} stroke={MACHINE_EDGE} />
      <rect x={300} y={120} width={22} height={FLOOR - 114} fill={MACHINE} stroke={MACHINE_EDGE} />
      <line x1={foot.x + 16} y1={foot.y} x2={300} y2={foot.y} stroke={MACHINE_EDGE} strokeWidth={6} />
      <Pad from={{ x: hip.x - 26, y: hip.y + 16 }} to={{ x: hip.x + 26, y: hip.y + 16 }} width={12} />
      {/* The back pad, just behind the back. */}
      <Pad from={reach(back, 10, 112, 'right')} to={reach(back, 118, 112, 'right')} width={14} />
      <rect x={foot.x + 6} y={foot.y - 42} width={12} height={74} rx={3} fill={MACHINE} stroke={MACHINE_EDGE} />

      <Limb from={shoulder} to={hip} width={30} />
      <Limb from={hip} to={knee} width={21} />
      <Muscle from={reach(hip, 10, Math.atan2(hip.y - knee.y, knee.x - hip.x) * (180 / Math.PI) + 8, 'right')} to={knee} width={11} />
      <Limb from={knee} to={foot} width={15} />
      <ellipse cx={foot.x + 2} cy={foot.y} rx={5} ry={10} fill={OUTLINE} />
      <Head at={head} />
      <Limb from={shoulder} to={elbow} width={12} />
      <Limb from={elbow} to={handle} width={11} />
      <circle cx={handle.x} cy={handle.y} r={6} fill={BODY} stroke={OUTLINE} strokeWidth={2} />
    </Scene>
  );
}
