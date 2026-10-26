// Plank braccia tese (straight-arm plank): from the knees, hands under the shoulders, the knees
// leave the floor until the body is one straight line from head to heels; hold, and back down.

import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { along, FLOOR, Head, Limb, Muscle, OUTLINE, Scene } from './figure.tsx';

const ease = { easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const ARM = 78;
const TORSO = 102;
const THIGH = 62;
const SHIN = 60;
// In the plank the line from the shoulders to the toes rises by ARM over its whole length.
const PLANK_KNEE = (ARM * SHIN) / (TORSO + THIGH + SHIN);

const below = (p: { x: number; y: number }) => ({ x: p.x, y: p.y + 9 });

export function StraightArmPlank() {
  const frame = useCurrentFrame();
  const up = interpolate(frame, [15, 45, 105, 135], [0, 1, 1, 0], ease);
  const kneeHeight = up * PLANK_KNEE;

  const hand = { x: 104, y: FLOOR + 4 };
  const shoulder = { x: hand.x, y: hand.y - ARM };
  // Shoulders, hips and knees stay in one line; the shins go from the knees to the floor.
  const drop = ARM - kneeHeight;
  const knee = { x: shoulder.x + Math.sqrt((TORSO + THIGH) ** 2 - drop ** 2), y: hand.y - kneeHeight };
  const hip = along(shoulder, knee, TORSO / (TORSO + THIGH));
  const foot = { x: knee.x + Math.sqrt(SHIN ** 2 - kneeHeight ** 2), y: hand.y };
  const head = along(knee, shoulder, (TORSO + THIGH + 24) / (TORSO + THIGH));

  return (
    <Scene>
      <Limb from={hip} to={knee} width={20} />
      <Limb from={knee} to={foot} width={15} />
      <ellipse cx={foot.x + 2} cy={foot.y - 4} rx={9} ry={5} fill={OUTLINE} />
      <Limb from={shoulder} to={hip} width={30} />
      {/* The abdominals, on the side of the torso that faces the floor. */}
      <Muscle from={below(along(shoulder, hip, 0.35))} to={below(along(shoulder, hip, 0.9))} />
      <Head at={{ x: head.x, y: head.y - 4 }} />
      <Limb from={shoulder} to={hand} width={12} />
      <Muscle from={{ x: shoulder.x, y: shoulder.y + 2 }} to={{ x: shoulder.x, y: shoulder.y + 16 }} width={8} />
    </Scene>
  );
}
