// src/client/css.ts

import { attachGetMethod } from './parser/attachGetMethod';
import { parseClassBlocksWithBraceCounting } from './parser/parseClassBlocksWithBraceCounting';
import { CSSResult } from './types';

/**
 * css<T>():
 *  - parse @scope <name>
 *  - parse .className { ... } (โดยไม่สน nested braces)
 *  - parse @bind ภายในแต่ละ block
 *  - สุดท้าย attachGetMethod => มี .get(...).set(...).reset() ฯลฯ
 */
export function css<T extends Record<string, string[]>>(
  template: TemplateStringsArray
): CSSResult<T> {
  const text = template[0];
  let scopeName = 'none';

  // parse @scope <name>
  const scopeMatch = text.match(/@scope\s+([^\r\n]+)/);
  if (scopeMatch) {
    scopeName = scopeMatch[1].trim();
  }

  // (CHANGED) สร้างฟังก์ชัน getScopedName สำหรับเติม scope
  function getScopedName(cls: string) {
    return scopeName === 'none' ? cls : `${scopeName}_${cls}`;
  }

  // parse .className { ... }
  const blocks = parseClassBlocksWithBraceCounting(text);

  // สร้าง resultObj: { [className]: string }
  const resultObj: Record<string, string> = {};

  // 1) ใส่ค่าเริ่มต้น (local class => scopeName_className) ใช้ getScopedName
  for (const b of blocks) {
    const className = b.className;
    resultObj[className] = getScopedName(className); // (CHANGED)
  }

  // 2) parse @bind ภายในแต่ละ block
  for (const b of blocks) {
    const className = b.className;
    // เตรียมเก็บเป็น Set ไว้ป้องกัน duplication
    const originalVal = resultObj[className] || '';
    const classSet = new Set<string>(originalVal.split(/\s+/).filter(Boolean));

    // แยกบรรทัดใน body
    const lines = b.body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      if (!line.startsWith('@bind ')) {
        continue;
      }
      // line เช่น "@bind .card .card2"
      const bindRefs = line.replace('@bind', '').trim();
      if (!bindRefs) {
        continue;
      }
      const refs = bindRefs.split(/\s+/).filter(Boolean);
      for (const r of refs) {
        if (!r.startsWith('.')) {
          // สมมติข้ามหรืออาจ throw error
          continue;
        }
        const shortCls = r.slice(1);

        // ถ้าพบใน resultObj => ใช้ scoped, ไม่งั้นชื่อดิบ
        if (resultObj[shortCls]) {
          classSet.add(resultObj[shortCls]);
        } else {
          classSet.add(shortCls);
        }
      }
    }

    // join กลับเก็บใน resultObj[className]
    resultObj[className] = Array.from(classSet).join(' ');
  }

  // attach .get(...).set(...) ให้
  attachGetMethod(resultObj as CSSResult<T>);
  return resultObj as CSSResult<T>;
}
