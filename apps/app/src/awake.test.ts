import { describe, expect, it, vi } from 'vitest';
import { counted, screenLock, type Sentinel } from './awake';

describe('counted', () => {
  it('acquires for the first holder and releases after the last one', () => {
    const acquire = vi.fn();
    const release = vi.fn();
    const keepAwake = counted(acquire, release);
    keepAwake(true); // the workout screen
    keepAwake(true); // a timer
    keepAwake(false); // the timer ends
    expect(acquire).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
    keepAwake(false); // the workout ends
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('ignores a release without a holder', () => {
    const release = vi.fn();
    const keepAwake = counted(() => {}, release);
    keepAwake(false);
    keepAwake(true);
    keepAwake(false);
    expect(release).toHaveBeenCalledTimes(1);
  });
});

/** A fake Screen Wake Lock: each request gives a sentinel the "browser" can release. */
function fakeBrowser() {
  const sentinels: (Sentinel & { browserRelease: () => void; released: boolean })[] = [];
  const request = vi.fn(async () => {
    const listeners: (() => void)[] = [];
    const sentinel = {
      released: false,
      release: async () => {
        sentinel.released = true;
      },
      addEventListener: (_type: 'release', listener: () => void) => listeners.push(listener),
      browserRelease: () => {
        sentinel.released = true;
        listeners.forEach((l) => l());
      },
    };
    sentinels.push(sentinel);
    return sentinel;
  });
  return { request, sentinels, visible: true };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('screenLock', () => {
  it('asks again when the page is visible after the browser dropped the lock', async () => {
    const browser = fakeBrowser();
    const lock = screenLock(browser.request, () => browser.visible);
    lock.acquire();
    await settle();
    expect(browser.request).toHaveBeenCalledTimes(1);

    // The page goes to the background: the browser releases the lock, and asking now would fail.
    browser.visible = false;
    browser.sentinels[0].browserRelease();
    await settle();
    expect(browser.request).toHaveBeenCalledTimes(1);

    browser.visible = true;
    lock.resume();
    await settle();
    expect(browser.request).toHaveBeenCalledTimes(2);
  });

  it('asks again right away when the lock is released while the page is visible', async () => {
    const browser = fakeBrowser();
    const lock = screenLock(browser.request, () => browser.visible);
    lock.acquire();
    await settle();
    browser.sentinels[0].browserRelease();
    await settle();
    expect(browser.request).toHaveBeenCalledTimes(2);
  });

  it('does not ask twice, and does not ask again after its own release', async () => {
    const browser = fakeBrowser();
    const lock = screenLock(browser.request, () => browser.visible);
    lock.acquire();
    lock.acquire();
    lock.resume();
    await settle();
    expect(browser.request).toHaveBeenCalledTimes(1);

    lock.release();
    await settle();
    lock.resume();
    await settle();
    expect(browser.sentinels[0].released).toBe(true);
    expect(browser.request).toHaveBeenCalledTimes(1);
  });

  it('lets go of a lock that arrives after the release', async () => {
    const browser = fakeBrowser();
    const lock = screenLock(browser.request, () => browser.visible);
    lock.acquire();
    lock.release();
    await settle();
    expect(browser.sentinels[0].released).toBe(true);
  });

  it('survives a refused request', async () => {
    const lock = screenLock(() => Promise.reject(new Error('NotAllowedError')), () => true);
    lock.acquire();
    await settle();
    lock.release();
  });
});
