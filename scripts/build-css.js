// scripts/build-css.js
import esbuild from 'esbuild';
import path from 'path';

async function buildCSS() {
  // กำหนด entry point => src/styles/plugin.css
  // จากนั้น output => dist/plugin.css
  await esbuild.build({
    entryPoints: [path.join('src', 'styles', 'plugin.css')],
    outfile: path.join('dist', 'plugin.css'),
    bundle: true, // ถ้ามีการ import CSS อื่นซ้อนกัน (optional)
    minify: true, // เปิดใช้งาน minify
    loader: { '.css': 'css' },
  });

  console.log('✅ Built dist/plugin.css (minified)');
}

buildCSS().catch((err) => {
  console.error(err);
  process.exit(1);
});
