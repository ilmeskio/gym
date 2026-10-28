import { describe, expect, it } from 'vitest';
import { bundleIn, isOutdated } from './update';

const page = (hash: string) =>
  `<html><head><script src="/gym/_expo/static/js/web/index-${hash}.js" defer></script></head></html>`;

describe('bundleIn', () => {
  it('finds the bundle a page loads', () => {
    expect(bundleIn(page('4e29d383'))).toBe('_expo/static/js/web/index-4e29d383.js');
    expect(bundleIn('https://consiglio.fyi/gym/_expo/static/js/web/index-ab12.js')).toBe(
      '_expo/static/js/web/index-ab12.js',
    );
    expect(bundleIn('<html></html>')).toBeUndefined();
  });
});

describe('isOutdated', () => {
  const running = '_expo/static/js/web/index-4e29d383.js';

  it('is when the published page loads another bundle', async () => {
    expect(await isOutdated(running, async () => page('ffff0000'))).toBe(true);
    expect(await isOutdated(running, async () => page('4e29d383'))).toBe(false);
  });

  it('is not when nothing is known: offline, a page without a bundle, or the development server', async () => {
    expect(await isOutdated(running, () => Promise.reject(new Error('offline')))).toBe(false);
    expect(await isOutdated(running, async () => '<html></html>')).toBe(false);
    expect(await isOutdated(undefined, async () => page('ffff0000'))).toBe(false);
  });
});
