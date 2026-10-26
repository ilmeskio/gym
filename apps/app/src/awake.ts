// Keeping the screen on. Several parts of the app may ask at once (the workout screen and a
// running timer): the screen goes back to normal only when the last one lets go.

/** Turns `acquire` and `release` into `keepAwake(on)` calls that can overlap. */
export function counted(acquire: () => void, release: () => void) {
  let holders = 0;
  return (on: boolean) => {
    if (on) {
      if (holders++ === 0) acquire();
    } else if (holders > 0 && --holders === 0) release();
  };
}

export type Sentinel = {
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
};

/**
 * The browser's Screen Wake Lock, held while wanted. The browser drops it when the page is
 * hidden: it is asked again when the lock is released and when the page is visible again.
 */
export function screenLock(request: () => Promise<Sentinel>, visible: () => boolean) {
  let wanted = false;
  let lock: Sentinel | undefined;
  let asking = false;

  function ask() {
    if (!wanted || lock || asking || !visible()) return;
    asking = true;
    request().then(
      (l) => {
        asking = false;
        if (!wanted) {
          l.release().catch(() => {});
          return;
        }
        lock = l;
        l.addEventListener?.('release', () => {
          if (lock !== l) return;
          lock = undefined;
          ask();
        });
      },
      () => {
        asking = false;
      },
    );
  }

  return {
    acquire() {
      wanted = true;
      ask();
    },
    release() {
      wanted = false;
      const l = lock;
      lock = undefined;
      l?.release().catch(() => {});
    },
    /** Call when the page is visible again. */
    resume: ask,
  };
}
