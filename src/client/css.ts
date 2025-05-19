// src/client/css.ts

import { attachGetMethod } from './parser/attachGetMethod';
import { parseClassBlocksWithBraceCounting } from './parser/parseClassBlocksWithBraceCounting';
import { CSSResult } from './types';
import { attachVarMethod } from './parser/attachVarMethod';

/**
 * The main entry point for defining CSS rules in this system.
 * It processes the given template string to:
 *   1. Parse an optional @scope <name>
 *   2. Parse class blocks of the form .className { ... } (ignoring nested braces)
 *   3. Process @bind directives inside each block
 *   4. Attach .get(...), .reset(...), etc., methods via attachGetMethod()
 *   5. [NEW] Detect @var statements (if any) and attach .var methods via attachVarMethod()
 */
export function css<T extends Record<string, string[]>>(
  template: TemplateStringsArray
): CSSResult<T> {
  const text = template[0];
  let scopeName = 'none';

  // Find and parse any @scope directive
  const scopeMatch = text.match(/@scope\s+([^\r\n]+)/);
  if (scopeMatch) {
    scopeName = scopeMatch[1].trim();
  }

  // Parse .className { ... } blocks
  const blocks = parseClassBlocksWithBraceCounting(text);

  // Build the result object (classKey -> string)
  const resultObj: Record<string, string> = {};

  // 1) Initialize each local className => scopeName_className (or just className if none)
  for (const b of blocks) {
    const className = b.className;
    resultObj[className] = scopeName === 'none' ? className : `${scopeName}_${className}`;
  }

  // 2) Process @bind directives
  for (const b of blocks) {
    const className = b.className;
    const originalVal = resultObj[className] || '';
    const classSet = new Set<string>(originalVal.split(/\s+/).filter(Boolean));

    // Split the body into lines
    const lines = b.body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (!line.startsWith('@bind ')) {
        continue;
      }
      // Example: "@bind .card .card2"
      const bindRefs = line.replace('@bind', '').trim();
      if (!bindRefs) {
        continue;
      }
      const refs = bindRefs.split(/\s+/).filter(Boolean);
      for (const r of refs) {
        if (!r.startsWith('.')) {
          continue;
        }
        const shortCls = r.slice(1);
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

  // 3) Check if there's any @var lines => gather var keys
  // Pattern: @var color[red] => group 1 => color, group 2 => red (ส่วน value เป็น default เฉย ๆ)
  const varKeys: string[] = [];
  const varPattern = /@var\s+([\w-]+)\[([^\]]*)\]/g;
  let varMatch: RegExpExecArray | null;
  while ((varMatch = varPattern.exec(text)) !== null) {
    const varName = varMatch[1];
    // const defaultVal = varMatch[2]; // defaultVal มาจาก "[red]" แต่ runtime ไม่ได้ใช้เซตเอง (extension จะ generate css)
    varKeys.push(varName);
  }

  // 4) Attach .get(), .reset() (existing logic)
  attachGetMethod(resultObj as CSSResult<T>);

  // 5) If varKeys found => attach .var
  if (varKeys.length > 0) {
    attachVarMethod(resultObj as CSSResult<T>, scopeName, varKeys);
  }

  // Return result object with .get / .reset / .var
  return resultObj as CSSResult<T>;
}
