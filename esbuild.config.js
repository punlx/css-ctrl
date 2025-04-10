import { build } from 'esbuild';

async function runBuild() {
  // 1) bundle/minify ฝั่ง client => dist/index.js
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
