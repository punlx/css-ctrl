import fs from 'fs';
import path from 'path';

const distDir = 'dist';

// ✅ ฟังก์ชันสร้างไฟล์ index.d.ts
function createIndexDts() {
  const indexDtsPath = path.join(distDir, 'index.d.ts');
  const indexDtsContent = `export { css, theme } from './client';\n`;
  fs.writeFileSync(indexDtsPath, indexDtsContent, 'utf8');
  console.log('✅ Created dist/index.d.ts');
}

// ✅ สร้างไฟล์ .d.ts ทั้งสองไฟล์
createIndexDts();
