/** Bundles the UI harness (welcome screen, header) with Firebase stubbed. */
import { build } from 'esbuild';
import path from 'node:path';

const out = process.argv[2];
if (!out) {
  console.error('Usage: node scripts/buildUiHarness.mjs <output-directory>');
  process.exit(1);
}

await build({
  entryPoints: ['scripts/uiHarness.tsx'],
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
