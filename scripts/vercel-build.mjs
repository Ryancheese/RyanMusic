import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [join(root, 'server/src/app.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(root, 'api/bundle.mjs'),
  packages: 'bundle',
});

console.log('Built api/bundle.mjs');
