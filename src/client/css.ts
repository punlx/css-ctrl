// src/client/css.ts

import { attachGetMethod } from './parser/attachGetMethod';
import { parseClassBlocksWithBraceCounting } from './parser/parseClassBlocksWithBraceCounting';
import { CSSResult } from './types';

/**
 * The main entry point for defining CSS rules in this system.
 * It processes the given template string to:
 *   1. Parse an optional `@scope <name>`
 *   2. Parse class blocks of the form `.className { ... }` (ignoring nested braces)
 *   3. Process `@bind` directives inside each block
 *   4. Attach `.get(...)`, `.reset(...)`, etc., methods via attachGetMethod()
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

  function getScopedName(cls: string) {
    return scopeName === 'none' ? cls : `${scopeName}_${cls}`;
  }

  // Parse blocks of the form .className { ... }
  const blocks = parseClassBlocksWithBraceCounting(text);

  // Build the result object: { [className]: string }
  const resultObj: Record<string, string> = {};

  // 1) Initialize each local className to scopeName_className (or just className if none)
  for (const b of blocks) {
    const className = b.className;
    resultObj[className] = getScopedName(className);
  }

  // 2) Parse @bind statements within each block
  for (const b of blocks) {
    const className = b.className;
    const originalVal = resultObj[className] || '';
    const classSet = new Set<string>(originalVal.split(/\s+/).filter(Boolean));

    // Split the body into lines
    const lines = b.body.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (!line.startsWith('@bind ')) {
        continue;
      }
      // Example of a line: "@bind .card .card2"
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

        // If the referenced class is already in resultObj, we incorporate its tokens.
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

  // Attach get methods
  attachGetMethod(resultObj as CSSResult<T>);
  return resultObj as CSSResult<T>;
}
