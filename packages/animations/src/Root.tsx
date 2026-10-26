// Every animation, one composition each: its id is the file name in apps/app/public/animations
// and the `id` of the exercise's `media.gif` entry (with `source: 'gym'`).

import { Composition } from 'remotion';
import { FPS, SIZE } from './figure.tsx';
import { HollowHold } from './HollowHold.tsx';
import { HorizontalLegPress } from './HorizontalLegPress.tsx';
import { StraightArmPlank } from './StraightArmPlank.tsx';

export function Root() {
  const size = { fps: FPS, width: SIZE, height: SIZE };
  return (
    <>
      <Composition id="hollow-hold" component={HollowHold} durationInFrames={150} {...size} />
      <Composition id="straight-arm-plank" component={StraightArmPlank} durationInFrames={150} {...size} />
      <Composition id="horizontal-leg-press" component={HorizontalLegPress} durationInFrames={150} {...size} />
    </>
  );
}
