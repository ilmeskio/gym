// Every animation, one composition each: its id is the file name in apps/app/public/animations
// and the `id` of the exercise's `media.gif` entry (with `source: 'gym'`).

import { Composition } from 'remotion';
import { FPS, SIZE } from './figure.tsx';
import { HollowHold } from './HollowHold.tsx';

export function Root() {
  return (
    <Composition id="hollow-hold" component={HollowHold} durationInFrames={150} fps={FPS} width={SIZE} height={SIZE} />
  );
}
