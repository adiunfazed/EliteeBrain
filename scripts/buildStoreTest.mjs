/**
 * Bundles the store test with the Firebase module swapped for a stub, so the
 * store's local-first behaviour can be exercised without a network or a
 * project. A relative alias cannot be expressed on the esbuild CLI, hence a
 * tiny resolve plugin.
 */
import { build } from 'esbuild';
import path from 'node:path';

await build({
  entryPoints: ['scripts/trainingStore.test.ts'],
  bundle: true,
  platform: 'node',
  outfile: '/tmp/ts.cjs',
  logLevel: 'error',
  plugins: [
    {
      name: 'stub-firebase',
      setup(b) {
        b.onResolve({ filter: /^\.\/firebase$/ }, () => ({
          path: path.resolve('scripts/stub/firebase.ts'),
        }));
      },
    },
  ],
});
