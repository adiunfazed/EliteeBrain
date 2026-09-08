/**
 * Stamp a build id into the service worker.
 *
 * Vite copies public/sw.js verbatim, so its bytes are identical between
 * deploys. Browsers detect a service worker update by byte comparison — with
 * identical bytes they correctly conclude nothing changed, and the update
 * prompt never appears. Writing a fresh build id guarantees a difference.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const buildId = new Date().toISOString();
const swPath = resolve('dist/sw.js');

try {
  const source = readFileSync(swPath, 'utf8');
  writeFileSync(swPath, source.replace('__BUILD_ID__', buildId));
  console.log(`Service worker stamped: ${buildId}`);
} catch (err) {
  console.error('Could not stamp service worker:', err.message);
  process.exitCode = 1;
}
