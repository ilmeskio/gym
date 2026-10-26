// Every animation, one composition each: its id is the file name in apps/app/public/animations
// and the `id` of the exercise's `media.gif` entry (with `source: 'gym'`).

import { Composition } from 'remotion';
import { BandFrontHold } from './BandFrontHold.tsx';
import { CLOSE_UP_FRAMES, Drawing, POSITION_FRAMES, type DrawingProps } from './Drawing.tsx';
import { FPS, SIZE } from './figure.tsx';
import { HollowHold } from './HollowHold.tsx';
import { HorizontalLegPress } from './HorizontalLegPress.tsx';
import { StraightArmPlank } from './StraightArmPlank.tsx';

const WGER = { src: 'wger/close-grip-supinated-lat-pulldown.png', size: { width: 474, height: 316 } };
const EVERKINETIC_UNDERHAND = { src: 'everkinetic/Underhand_pull_down_1.svg', size: { width: 478.75, height: 1200 } };
const WIDE = { width: 792.5, height: 1200 };

/** Supinated grip: wger's drawing, its two halves the two positions. */
const UNDERHAND: DrawingProps = {
  closeUp: { ...WGER, rect: { x: 94, y: 36, width: 48, height: 48 } },
  positions: [
    { ...WGER, rect: { x: 0, y: 0, width: 237, height: 316 } },
    { ...WGER, rect: { x: 247, y: 0, width: 227, height: 316 } },
  ],
  label: ['presa supina', 'palmi verso di te'],
};

/** Pronated wide grip: Everkinetic's drawings, the close-up from their sharper hand. */
const WIDE_GRIP: DrawingProps = {
  closeUp: { ...EVERKINETIC_UNDERHAND, rect: { x: 52, y: 90, width: 220, height: 220 } },
  positions: [
    { src: 'everkinetic/Wide_grip_lat_pull_down_2.svg', size: WIDE, rect: { x: 0, y: 40, width: 792.5, height: 1120 } },
    { src: 'everkinetic/Wide_grip_lat_pull_down_1.svg', size: WIDE, rect: { x: 0, y: 40, width: 792.5, height: 1120 } },
  ],
  label: ['presa prona', 'palmi in avanti'],
};

export function Root() {
  const size = { fps: FPS, width: SIZE, height: SIZE };
  return (
    <>
      <Composition id="hollow-hold" component={HollowHold} durationInFrames={150} {...size} />
      <Composition id="straight-arm-plank" component={StraightArmPlank} durationInFrames={150} {...size} />
      <Composition id="band-front-hold" component={BandFrontHold} durationInFrames={150} {...size} />
      <Composition id="horizontal-leg-press" component={HorizontalLegPress} durationInFrames={150} {...size} />
      <Composition id="underhand-pulldown" component={Drawing} defaultProps={UNDERHAND} durationInFrames={CLOSE_UP_FRAMES + 2 * POSITION_FRAMES} {...size} />
      <Composition id="wide-grip-pulldown" component={Drawing} defaultProps={WIDE_GRIP} durationInFrames={CLOSE_UP_FRAMES + 2 * POSITION_FRAMES} {...size} />
    </>
  );
}
