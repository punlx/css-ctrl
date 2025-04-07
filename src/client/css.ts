import { attachGetMethod } from './parser/attachGetMethod';
import { parseClassBlocksWithBraceCounting } from './parser/parseClassBlocksWithBraceCounting';
import { CSSResult } from './types';
import { generateClassId } from './utils/hash';

export function css<T extends Record<string, string[]>>(
  template: TemplateStringsArray
): CSSResult<T> {
  const text = template[0];
  let scopeName = 'none';
  const scopeMatch = text.match(/@scope\s+([^\r\n]+)/);
  if (scopeMatch) {
    scopeName = scopeMatch[1].trim();
  }

  const blocks = parseClassBlocksWithBraceCounting(text);
  const resultObj: Record<string, string> = {};

  for (const b of blocks) {
    const className = b.className;
    const bodyInside = b.body;
    let finalName = className;
    if (scopeName === 'none') {
      finalName = className;
    } else if (scopeName === 'hash') {
      const trimmedBody = bodyInside.replace(/\s+/g, '');
      const hashedPart = generateClassId(className + trimmedBody);
      finalName = `${className}_${hashedPart}`;
    } else {
      finalName = `${scopeName}_${className}`;
    }
    resultObj[className] = finalName;
  }

  // parse @bind ...
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
      if (resultObj[shortCls]) {
        finalList.push(resultObj[shortCls]);
      } else {
        if (scopeName === 'none') {
          finalList.push(shortCls);
        } else if (scopeName === 'hash') {
          const hashedPart = generateClassId(shortCls);
          finalList.push(`${shortCls}_${hashedPart}`);
        } else {
          finalList.push(`${scopeName}_${shortCls}`);
        }
      }
    }
    resultObj[bindKey] = finalList.join(' ');
  }

  attachGetMethod(resultObj as CSSResult<T>);
  return resultObj as CSSResult<T>;
}
