/************************************************************
 * 1) ชนิดข้อมูล Utility สำหรับเมธอด .set(...)
 ************************************************************/

/** แยกเฉพาะ $xxx */
type ExtractGlobalKeys<A extends string> = A extends `$${string}` ? A : never;

/** แยก $xxx หรือ &xxx */
type ExtractLocalAndGlobalKeys<A extends string> = A extends `$${string}` | `&${string}`
  ? A
  : never;

/** แปลง T[K] (string[]) => { '$bg'?: string } (เฉพาะ $xxx) */
type PropsForGlobalClass<ClassArr extends string[]> = Partial<
  Record<ExtractGlobalKeys<ClassArr[number]>, string>
>;

/** แปลง T[K] (string[]) => { '$bg'?: string, '&color'?: string } */
type PropsForLocalAndGlobalClass<ClassArr extends string[]> = Partial<
  Record<ExtractLocalAndGlobalKeys<ClassArr[number]>, string>
>;

/** กรณี .get(HTMLElement) => union ของคีย์ทั้งหมดใน T */
type AllKeysOf<T extends Record<string, string[]>> = T[keyof T][number];

type PropsForAllLocalAndGlobal<T extends Record<string, string[]>> = Partial<
  Record<ExtractLocalAndGlobalKeys<AllKeysOf<T>>, string>
>;

/************************************************************
 * 2) ประกาศชนิด CSSResult<T> + Overload Method
 ************************************************************/
export type CSSResult<T extends Record<string, string[]>> = {
  [K in keyof T]: string;
} & {
  // Overload 1: .get("classKey") => set เฉพาะ $xxx จาก T[classKey]
  get<K2 extends keyof T>(
    classKey: K2
  ): {
    set: (props: PropsForGlobalClass<T[K2]>) => void;
  };
  // Overload 2: .get(HTMLElement) => set() ได้ $xxx และ &xxx ทั้งหมด (Union)
  get(el: HTMLElement): {
    set: (props: PropsForAllLocalAndGlobal<T>) => void;
  };
};

/************************************************************
 * 3) ฟังก์ชัน Utility ตามโค้ดต้นฉบับ (hash, parse, etc.)
 ************************************************************/

/** โค้ด hash, buildVariableName, parseDisplayName, parseVariableAbbr ฯลฯ */
function getAlphabeticChar(code: number): string {
  return String.fromCharCode(code < 26 ? code + 97 : code + 39);
}
function hashString(str: string): number {
  let h = 2929;
  for (let i = str.length - 1; i >= 0; i--) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}
function generateClassId(str: string): string {
  const code = hashString(str);
  const AD_REPLACER_R = /(a)(d)/gi;
  const CHARS_LENGTH = 52;

  let name = '';
  let x = code;
  while (x > CHARS_LENGTH) {
    const remainder = x % CHARS_LENGTH;
    name = getAlphabeticChar(remainder) + name;
    x = (x / CHARS_LENGTH) | 0;
  }
  name = getAlphabeticChar(x % CHARS_LENGTH) + name;
  return name.replace(AD_REPLACER_R, '$1-$2');
}

export function buildVariableName(
  baseVarName: string,
  scope: string,
  cls: string,
  suffix: string
): string {
  if (suffix) {
    return `--${baseVarName}-${scope}_${cls}-${suffix}`;
  }
  return `--${baseVarName}-${scope}_${cls}`;
}

export function parseDisplayName(displayName: string): { scope: string; cls: string } {
  const underscoreIdx = displayName.indexOf('_');
  if (underscoreIdx < 0) {
    return { scope: 'none', cls: displayName };
  }
  const leftPart = displayName.slice(0, underscoreIdx);
  const rightPart = displayName.slice(underscoreIdx + 1);
  if (rightPart.length >= 4 && rightPart.length <= 8 && /^[A-Za-z0-9-]+$/.test(rightPart)) {
    return { scope: 'hash', cls: displayName };
  }
  return { scope: leftPart, cls: rightPart };
}

export function parseVariableAbbr(abbr: string): {
  baseVarName: string;
  suffix: string;
} {
  const varNameFull = abbr.startsWith('$') || abbr.startsWith('&') ? abbr.slice(1) : abbr;
  let baseVarName = varNameFull;
  let suffix = '';
  const dashIdx = varNameFull.lastIndexOf('-');
  if (dashIdx > 0) {
    baseVarName = varNameFull.slice(0, dashIdx);
    suffix = varNameFull.slice(dashIdx + 1);
  }
  return { baseVarName, suffix };
}

/************************************************************
 * 4) parseClassBlocksWithBraceCounting
 ************************************************************/
function parseClassBlocksWithBraceCounting(text: string): Array<{
  className: string;
  body: string;
}> {
  const result: Array<{ className: string; body: string }> = [];
  const pattern = /\.([\w-]+)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const clsName = match[1];
    const startIndex = pattern.lastIndex;
    let braceCount = 1;
    let i = startIndex;
    for (; i < text.length; i++) {
      if (text[i] === '{') {
        braceCount++;
      } else if (text[i] === '}') {
        braceCount--;
      }
      if (braceCount === 0) {
        break;
      }
    }
    const body = text.slice(startIndex, i).trim();
    result.push({ className: clsName, body });
  }
  return result;
}

/************************************************************
 * 5) Queue + flushAll (ใช้ Map แทน object)
 ************************************************************/
let rafScheduled = false;
const pendingGlobalVars = new Map<string, string>();
const pendingLocalMap = new Map<HTMLElement, Record<string, string>>();

function flushAll() {
  // 1) Global
  for (const [varName, val] of pendingGlobalVars.entries()) {
    document.documentElement.style.setProperty(varName, val);
  }
  pendingGlobalVars.clear();

  // 2) Local
  for (const [el, props] of pendingLocalMap.entries()) {
    for (const [propName, propVal] of Object.entries(props)) {
      el.style.setProperty(propName, propVal);
    }
  }
  pendingLocalMap.clear();

  rafScheduled = false;
}

function scheduleFlush() {
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushAll);
  }
}

/************************************************************
 * 6) Helper: findFirstDisplayNameFromElement
 ************************************************************/
function findFirstDisplayNameFromElement<T extends Record<string, string[]>>(
  el: HTMLElement,
  resultObj: CSSResult<T>
): string | null {
  const classList = (el.className || '').split(/\s+/).filter(Boolean);
  for (const c of classList) {
    for (const key in resultObj) {
      if (typeof resultObj[key] === 'string' && resultObj[key] === c) {
        return c; // finalName
      }
    }
  }
  return null;
}

/************************************************************
 * 7) attachGetMethod => Overload
 ************************************************************/
export function attachGetMethod<T extends Record<string, string[]>>(resultObj: CSSResult<T>): void {
  // Overloads
  function get<K2 extends keyof T>(
    classKey: K2
  ): {
    set: (props: PropsForGlobalClass<T[K2]>) => void;
  };
  function get(el: HTMLElement): {
    set: (props: PropsForAllLocalAndGlobal<T>) => void;
  };

  // Implementation
  function get(arg: string | HTMLElement) {
    if (typeof arg === 'string') {
      /** CASE 1: .get("box") => set(...) */
      const displayName = resultObj[arg];
      if (!displayName) {
        return { set: () => {} };
      }
      const { scope, cls } = parseDisplayName(displayName);

      return {
        set(props: Record<string, string | undefined>) {
          // (Cast) เพราะเรารู้อยู่แล้วว่า props เป็น PropsForGlobalClass<T[K2]>
          for (const abbr in props) {
            let val = props[abbr];
            if (!val) continue;
            const { baseVarName, suffix } = parseVariableAbbr(abbr);

            let finalVarName = '';
            if (scope === 'none') {
              finalVarName = suffix
                ? `--${baseVarName}-${cls}-${suffix}`
                : `--${baseVarName}-${cls}`;
            } else if (scope === 'hash') {
              finalVarName = suffix
                ? `--${baseVarName}-${cls}-${suffix}`
                : `--${baseVarName}-${cls}`;
            } else {
              finalVarName = buildVariableName(baseVarName, scope, cls, suffix);
            }
            if (val.includes('--')) {
              val = val.replace(/(--[\w-]+)/g, 'var($1)');
            }
            pendingGlobalVars.set(finalVarName, val);
          }
          scheduleFlush();
        },
      };
    } else {
      /** CASE 2: .get(HTMLElement) => set(...) */
      const el = arg;
      return {
        set(props: Record<string, string | undefined>) {
          const matchedDisplayName = findFirstDisplayNameFromElement(el, resultObj);
          const parsed = matchedDisplayName
            ? parseDisplayName(matchedDisplayName)
            : { scope: 'none', cls: '' };

          for (const abbr in props) {
            let val = props[abbr];
            if (!val) continue;

            if (abbr.startsWith('&')) {
              // local style
              const { baseVarName, suffix } = parseVariableAbbr(abbr);
              let localVar = '';
              if (parsed.scope === 'none') {
                localVar = suffix
                  ? `--${baseVarName}-${parsed.cls}-${suffix}`
                  : `--${baseVarName}-${parsed.cls}`;
              } else if (parsed.scope === 'hash') {
                localVar = suffix
                  ? `--${baseVarName}-${parsed.cls}-${suffix}`
                  : `--${baseVarName}-${parsed.cls}`;
              } else {
                localVar = buildVariableName(baseVarName, parsed.scope, parsed.cls, suffix);
              }
              if (val.includes('--')) {
                val = val.replace(/(--[\w-]+)/g, 'var($1)');
              }
              let existing = pendingLocalMap.get(el);
              if (!existing) {
                existing = {};
              }
              existing[localVar] = val;
              pendingLocalMap.set(el, existing);
            } else if (abbr.startsWith('$')) {
              // global
              const { baseVarName, suffix } = parseVariableAbbr(abbr);
              let finalVarName: string;
              if (parsed.scope === 'none') {
                finalVarName = suffix
                  ? `--${baseVarName}-${parsed.cls}-${suffix}`
                  : `--${baseVarName}-${parsed.cls}`;
              } else if (parsed.scope === 'hash') {
                finalVarName = suffix
                  ? `--${baseVarName}-${parsed.cls}-${suffix}`
                  : `--${baseVarName}-${parsed.cls}`;
              } else {
                finalVarName = buildVariableName(baseVarName, parsed.scope, parsed.cls, suffix);
              }
              if (val.includes('--')) {
                val = val.replace(/(--[\w-]+)/g, 'var($1)');
              }
              pendingGlobalVars.set(finalVarName, val);
            }
          }
          scheduleFlush();
        },
      };
    }
  }

  resultObj.get = get as CSSResult<T>['get'];
}

/************************************************************
 * 8) ฟังก์ชัน css(...) => รวมทุกอย่าง
 ************************************************************/
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
