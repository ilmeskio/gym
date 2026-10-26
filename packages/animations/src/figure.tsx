// A figure seen from the side, drawn like the ExerciseDB GIFs: grey body on a white background,
// the working muscles in red. Angles are in degrees above the floor.

import type { ReactNode } from 'react';

export const SIZE = 360;
export const FPS = 30;

export const FLOOR = 262;

export const BODY = '#a7afb8';
export const OUTLINE = '#6b737c';
export const MUSCLE = '#e0473e';
export const MACHINE = '#d9dde1';
export const MACHINE_EDGE = '#9aa1a8';

export type Point = { x: number; y: number };

/** The point `t` of the way from `a` to `b`. */
export const along = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** The point `length` away from `from`, at `angle` degrees above the horizontal, towards `side`. */
export function reach(from: Point, length: number, angle: number, side: 'left' | 'right'): Point {
  const r = (angle * Math.PI) / 180;
  return { x: from.x + (side === 'left' ? -1 : 1) * length * Math.cos(r), y: from.y - length * Math.sin(r) };
}

export function Limb({ from, to, width }: { from: Point; to: Point; width: number }) {
  return (
    <>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={OUTLINE} strokeWidth={width + 3} strokeLinecap="round" />
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={BODY} strokeWidth={width} strokeLinecap="round" />
    </>
  );
}

/** A muscle at work: a red stroke over the body, between two points. */
export function Muscle({ from, to, width = 9 }: { from: Point; to: Point; width?: number }) {
  return (
    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={MUSCLE} strokeWidth={width} strokeLinecap="round" opacity={0.9} />
  );
}

export function Head({ at }: { at: Point }) {
  return <circle cx={at.x} cy={at.y} r={16} fill={BODY} stroke={OUTLINE} strokeWidth={2} />;
}

/** The exercise on a mat on the floor, or (`mat={false}`) on a machine that stands on the floor. */
export function Scene({ children, mat = true }: { children: ReactNode; mat?: boolean }) {
  return (
    // The drawing is 360 wide; the view frames the floor and what rises from it, a little larger.
    <svg width={SIZE} height={SIZE} viewBox="15 60 330 330" style={{ background: '#ffffff' }}>
      {mat ? <rect x={30} y={FLOOR + 12} width={300} height={10} rx={5} fill={MACHINE} /> : null}
      {children}
    </svg>
  );
}

/**
 * Lying on the back, head to the left: the lower back stays on the floor while the shoulders
 * (`torso`), the arms overhead (`arms`) and the straight legs (`legs`) rise.
 */
export function Supine({ torso, arms, legs }: { torso: number; arms: number; legs: number }) {
  const hip = { x: 208, y: FLOOR };
  const lowerBack = { x: hip.x - 40, y: FLOOR };
  const shoulder = reach(lowerBack, 62, torso, 'left');
  const head = reach(shoulder, 24, torso + 6, 'left');
  const hand = reach(shoulder, 78, arms, 'left');
  const knee = reach(hip, 62, legs, 'right');
  const foot = reach(knee, 60, legs, 'right');
  const torsoPath = `M ${hip.x} ${hip.y} Q ${lowerBack.x} ${lowerBack.y} ${shoulder.x} ${shoulder.y}`;
  // The abdominals, on the front of the torso.
  const absPath = `M ${hip.x - 4} ${hip.y - 11} Q ${lowerBack.x} ${lowerBack.y - 13} ${(lowerBack.x + shoulder.x) / 2} ${(lowerBack.y + shoulder.y) / 2 - 12}`;

  return (
    <g>
      <Limb from={hip} to={knee} width={20} />
      <Limb from={knee} to={foot} width={15} />
      <ellipse cx={foot.x + 4} cy={foot.y - 6} rx={6} ry={10} fill={OUTLINE} />
      <path d={torsoPath} fill="none" stroke={OUTLINE} strokeWidth={33} strokeLinecap="round" />
      <path d={torsoPath} fill="none" stroke={BODY} strokeWidth={30} strokeLinecap="round" />
      <path d={absPath} fill="none" stroke={MUSCLE} strokeWidth={9} strokeLinecap="round" opacity={0.9} />
      <Limb from={shoulder} to={hand} width={12} />
      <circle cx={hand.x} cy={hand.y} r={6} fill={BODY} stroke={OUTLINE} strokeWidth={2} />
      <circle cx={head.x} cy={head.y} r={16} fill={BODY} stroke={OUTLINE} strokeWidth={2} />
    </g>
  );
}
