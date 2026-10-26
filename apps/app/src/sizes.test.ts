import { describe, expect, it } from 'vitest';
import { sizesFor } from './sizes';

describe('sizesFor', () => {
  it('keeps the base sizes on a common phone', () => {
    const s = sizesFor(412, 900);
    expect(s.scale).toBe(1);
    expect(s.font(16)).toBe(16);
  });

  it('shrinks on a short or narrow screen, but not below a floor', () => {
    expect(sizesFor(360, 640).scale).toBeLessThan(1);
    expect(sizesFor(320, 480).scale).toBe(0.8);
    expect(sizesFor(320, 480).font(16)).toBe(13);
  });

  it('grows on a large screen, up to a ceiling', () => {
    expect(sizesFor(485, 1019).scale).toBeGreaterThan(1);
    expect(sizesFor(1024, 1366).scale).toBe(1.25);
  });

  it('gives the demonstration a share of the height that shrinks faster on short screens', () => {
    expect(sizesFor(412, 900).media).toBe(210);
    expect(sizesFor(360, 640).media).toBe(132);
    expect(sizesFor(320, 400).media).toBe(110);
    expect(sizesFor(1024, 1366).media).toBe(320);
  });

  it('sizes the timer by the narrower of width and height', () => {
    expect(sizesFor(412, 900).timer).toBeCloseTo(96);
    expect(sizesFor(320, 480).timer).toBeLessThan(72);
    expect(sizesFor(1024, 1366).timer).toBe(140);
  });

  it('never makes a touch target smaller than 48', () => {
    expect(sizesFor(320, 480).touch).toBe(48);
    expect(sizesFor(1024, 1366).touch).toBe(60);
  });
});
