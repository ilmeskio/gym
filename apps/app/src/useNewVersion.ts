// On the web, whether a new version has been published: checked when the app opens and every
// time it comes back to the foreground.

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { bundleIn, isOutdated } from './update';

/** The published page, past every cache. */
const published = () =>
  fetch(`${location.pathname}?v=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text());

export function useNewVersion(): boolean {
  const [outdated, setOutdated] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const running = [...document.scripts].map((s) => bundleIn(s.src)).find(Boolean);
    const check = () => isOutdated(running, published).then((o) => o && setOutdated(true));
    const onVisible = () => document.visibilityState === 'visible' && check();
    check();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  return outdated;
}

/** Opens the published version: the address changes, so no cache gives back the old page. */
export const loadNewVersion = () => location.replace(`${location.pathname}?v=${Date.now()}`);
