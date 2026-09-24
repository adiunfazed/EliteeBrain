/**
 * Bundles the Body Training harness for browser testing, with Firebase
 * swapped for a stub so the section can be driven with no project and no
 * network. Usage: node scripts/buildBodyHarness.mjs <output-directory>
 */
import { build } from 'esbuild';
import path from 'node:path';

const out = process.argv[2];
if (!out) {
  console.error('Usage: node scripts/buildBodyHarness.mjs <output-directory>');
  process.exit(1);
}

await build({
  entryPoints: ['scripts/bodyHarness.tsx'],
  bundle: true,
  outfile: `${out}/app.js`,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
  loader: { '.mp3': 'empty', '.png': 'empty', '.svg': 'empty' },
  logLevel: 'error',
  plugins: [
    {
      name: 'stub-firebase',
      setup(b) {
        b.onResolve({ filter: /(^|\/)firebase$/ }, (args) =>
          args.importer.includes('/src/')
            ? { path: path.resolve('scripts/stub/firebase.ts') }
            : undefined
        );
      },
    },
  ],
});
