// src/client/css.ts

import { attachGetMethod } from './parser/attachGetMethod';
import { parseClassBlocksWithBraceCounting } from './parser/parseClassBlocksWithBraceCounting';
import { CSSResult } from './types';
// (REMOVED) import { generateClassId } from './utils/hash';

export function css<T extends Record<string, string[]>>(
  template: TemplateStringsArray
): CSSResult<T> {
  const text = template[0];
  let scopeName = 'none';

  // parse @scope <name>
  const scopeMatch = text.match(/@scope\s+([^\r\n]+)/);
  if (scopeMatch) {
    scopeName = scopeMatch[1].trim();
    // ถ้าพบ "hash" => throw
    if (scopeName === 'hash') {
      throw new Error('[CSS-CTRL-ERR] "@scope hash" is no longer supported in runtime.');
    }
  }

  // parse .className { ... } (แบบไม่ต้องสน nested braces)
  const blocks = parseClassBlocksWithBraceCounting(text);
  const resultObj: Record<string, string> = {};

  for (const b of blocks) {
    const className = b.className;
    // bodyInside = b.body (เรายังดึงมาได้ แต่ที่นี่ไม่ใช้งานแล้ว)
    if (scopeName === 'none') {
      resultObj[className] = className;
    } else {
      resultObj[className] = `${scopeName}_${className}`;
    }
  }

  // parse @bind
  const bindRegex = /@bind\s+([\w-]+)\s+([^\r\n]+)/g;
  let bindMatch: RegExpExecArray | null;
  while ((bindMatch = bindRegex.exec(text)) !== null) {
    const bindKey = bindMatch[1];
    const refsLine = bindMatch[2].trim();
    const refs = refsLine.split(/\s+/).filter(Boolean);

    const finalList: string[] = [];
    for (const r of refs) {
      if (!r.startsWith('.')) continue;
      const shortCls = r.slice(1);

      // ถ้ามีอยู่แล้ว => ใช้เลย
      if (resultObj[shortCls]) {
        finalList.push(resultObj[shortCls]);
      } else {
        // ถ้าไม่มี => สร้างชื่อใหม่ตาม scope
        if (scopeName === 'none') {
          finalList.push(shortCls);
        } else {
          finalList.push(`${scopeName}_${shortCls}`);
        }
      }
    }
    resultObj[bindKey] = finalList.join(' ');
  }

  // attach .get(...).set(...)
  attachGetMethod(resultObj as CSSResult<T>);
  return resultObj as CSSResult<T>;
}
