// A new version of the web app: the page published now loads another bundle than the one running.
// The installed app has no reload button, so the home screen offers the update.

const BUNDLE = /_expo\/static\/js\/web\/index-\w+\.js/;

/** The app's bundle in a page or a script address: the `index-<hash>.js` that Expo exports. */
export const bundleIn = (text: string) => BUNDLE.exec(text)?.[0];

/** Whether the published page loads another bundle than `running`; when nothing is known, it is not. */
export async function isOutdated(running: string | undefined, published: () => Promise<string>) {
  if (!running) return false;
  try {
    const bundle = bundleIn(await published());
    return !!bundle && bundle !== running;
  } catch {
    return false;
  }
}
