// esbuild.config.js

import { build } from 'esbuild';

async function runBuild() {
  await build({
    entryPoints: ['dist/client/index.js'],
    outfile: 'dist/index.js',
    bundle: true,
    minify: true,
    platform: 'browser',
    format: 'esm',
  });
}

runBuild().catch(() => process.exit(1));
