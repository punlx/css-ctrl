// scripts/generate-dts.js

import fs from 'fs';
import path from 'path';

const distDir = 'dist';

// ฟังก์ชันสร้างไฟล์ index.d.ts
function createIndexDts() {
  const indexDtsPath = path.join(distDir, 'index.d.ts');
  // re-export css, theme จาก ./client
  const indexDtsContent = `export { css, theme } from './client';\n`;
  
  fs.writeFileSync(indexDtsPath, indexDtsContent, 'utf8');
  console.log('✅ Created dist/index.d.ts');
}

createIndexDts();
