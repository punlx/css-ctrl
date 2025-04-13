// esbuild.config.js

import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

async function runBuild() {
  // 1) Bundle/minify ฝั่ง client => dist/index.js
  //    (entryPoints: dist/client/index.js)
  await build({
    entryPoints: ['dist/client/index.js'],
    outfile: 'dist/index.js',
    bundle: true,
    minify: true,
    platform: 'browser',
    format: 'esm',
  });

  // 2) อ่านไฟล์ .js ใน dist/plugin
  const pluginDir = path.join('dist', 'plugin');
  let pluginJsFiles = [];
  if (fs.existsSync(pluginDir)) {
    // สแกนไฟล์ .js ที่ไม่ใช่ types.js
    pluginJsFiles = fs
      .readdirSync(pluginDir)
      .filter((file) => file.endsWith('.js') && file !== 'types.js');
  }

  // 3) bundle/minify plugin แต่ละตัว => dist/<name>.js
  for (const pluginFile of pluginJsFiles) {
    // pluginFile เช่น 'select.js'
    const srcPath = path.join(pluginDir, pluginFile); // dist/plugin/select.js
    const baseName = path.basename(pluginFile, '.js'); // 'select'
    const outPath = path.join('dist', baseName + '.js'); // dist/select.js

    await build({
      entryPoints: [srcPath],
      outfile: outPath,
      bundle: true,
      minify: true,
      platform: 'browser',
      format: 'esm',
    });
  }
}

runBuild().catch(() => process.exit(1));
