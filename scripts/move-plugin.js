// scripts/move-plugin.js
import fs from 'fs';
import path from 'path';

const DIST = 'dist';
const PLUGIN_DIR = path.join(DIST, 'plugin');
const pluginFiles = ['select', 'dropdown']; // etc.

for (const name of pluginFiles) {
  const dtsSrc = path.join(PLUGIN_DIR, name + '.d.ts');
  const dtsDst = path.join(DIST, name + '.d.ts');

  if (fs.existsSync(dtsSrc)) {
    // move .d.ts
    fs.renameSync(dtsSrc, dtsDst);

    // patch import path => "./types" -> "./plugin/types"
    let dtsContent = fs.readFileSync(dtsDst, 'utf8');
    dtsContent = dtsContent.replace(
      /import { ([\w,{}\s]+) } from '.\/types';/g,
      `import { $1 } from './plugin/types';`
    );
    fs.writeFileSync(dtsDst, dtsContent, 'utf8');

    console.log(`Moved + patched plugin dts: ${name}.d.ts`);
  }

  // ลบไฟล์ .js เก่าใน dist/plugin ถ้าต้องการ
  // (แต่ esbuild.config.js ได้สร้าง dist/select.js แล้ว)
  const pluginJsOld = path.join(PLUGIN_DIR, name + '.js');
  if (fs.existsSync(pluginJsOld)) {
    fs.unlinkSync(pluginJsOld);
  }
}
