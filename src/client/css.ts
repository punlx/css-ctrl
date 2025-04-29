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

  function getScopedName(cls: string) {
    return scopeName === 'none' ? cls : `${scopeName}_${cls}`;
  }

  // parse .className { ... }
  const blocks = parseClassBlocksWithBraceCounting(text);

  // สร้าง resultObj: { [className]: string }
  const resultObj: Record<string, string> = {};

  // 1) ใส่ค่าเริ่มต้น (local class => scopeName_className)
  for (const b of blocks) {
    const className = b.className;
    resultObj[className] = getScopedName(className);
  }

  // 2) parse @bind ภายในแต่ละ block
  for (const b of blocks) {
    const className = b.className;
    const originalVal = resultObj[className] || '';
    const classSet = new Set<string>(originalVal.split(/\s+/).filter(Boolean));

    // แยกบรรทัดใน body
    const lines = b.body.split('\n').map((l) => l.trim()).filter(Boolean);
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
          continue; // หรือ throw error ตามต้องการ
        }
        const shortCls = r.slice(1);

        // (CHANGED) Split resultObj[shortCls] เป็นแต่ละ token
        if (resultObj[shortCls]) {
          const tokens = resultObj[shortCls].split(/\s+/);
          for (const t of tokens) {
            classSet.add(t);
          }
        } else {
          classSet.add(shortCls);
        }
      }
    }

    resultObj[className] = Array.from(classSet).join(' ');
  }

  attachGetMethod(resultObj as CSSResult<T>);
  return resultObj as CSSResult<T>;
}
