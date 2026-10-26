// Sizes relative to the window, so a screen fits on a small phone as on a large one:
// 1 is a common phone (412×900 dp), and the scale stays between a floor and a ceiling.

import { space } from './theme';

/** Content never gets wider than this, as in the screens' styles. */
const MAX_WIDTH = 640;

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export type Sizes = ReturnType<typeof sizesFor>;

export function sizesFor(width: number, height: number) {
  const raw = Math.min(Math.min(width, MAX_WIDTH) / 412, height / 900);
  const scale = clamp(raw, 0.8, 1.25);
  return {
    scale,
    font: (n: number) => Math.round(n * scale),
    space: (n: number) => Math.round(space(n) * scale),
    /** Smallest height of the exercise demonstration, which grows into the free room: a share of
     *  the window that a short screen gives up first. */
    media: clamp(height * 0.3 - 60, 110, 320),
    /** The timer's digits. */
    timer: clamp(raw * 96, 56, 140),
    /** Side of a touch target: never below the 48 dp Android asks for. */
    touch: Math.max(48, Math.round(48 * scale)),
  };
}
