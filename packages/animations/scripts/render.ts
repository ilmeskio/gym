// Renders every animation to apps/app/public/animations/<id>.gif, published with the web app.

import { bundle } from '@remotion/bundler';
import { getCompositions, renderMedia } from '@remotion/renderer';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.resolve(root, '../../apps/app/public/animations');
const only = process.argv.slice(2);

const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts') });
for (const composition of await getCompositions(serveUrl)) {
  if (only.length && !only.includes(composition.id)) continue;
  const outputLocation = path.join(out, `${composition.id}.gif`);
  // 15 frames a second are enough for a slow movement and keep the file small.
  await renderMedia({ composition, serveUrl, codec: 'gif', everyNthFrame: 2, numberOfGifLoops: null, outputLocation });
  console.log(outputLocation);
}
