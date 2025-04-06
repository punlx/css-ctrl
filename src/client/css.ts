export type CSSResult<T extends Record<string, string[]>> = {
  [K in keyof T]: string; // map className -> final string e.g. "scope_class"
} & {
  get: <K2 extends keyof T>(
    className: K2
  ) => {
    set: (props: Partial<Record<T[K2][number], string>>) => void;
  };
};

/************************************************************
 * 1) โค้ดช่วยสร้าง hash => "box_abc123"
 ************************************************************/
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

/************************************************************
 * 2) ประกอบชื่อ runtime variable => e.g. "--bg-foo_box-hover"
 ************************************************************/
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

/************************************************************
 * 3) parseDisplayName(...)
 * - ถ้าไม่มี '_' => ถือว่า scope=none
 * - ถ้า scope=hash => จะคืน { scope: 'hash', cls: 'box_abc123' }
 *   (วิธีเช็ค hash อาจดูความยาวหรือ regex)
 ************************************************************/
export function parseDisplayName(displayName: string): { scope: string; cls: string } {
  const underscoreIdx = displayName.indexOf('_');
  if (underscoreIdx < 0) {
    // ไม่มี underscore => scope=none
    return { scope: 'none', cls: displayName };
  }

  const leftPart = displayName.slice(0, underscoreIdx);
  const rightPart = displayName.slice(underscoreIdx + 1);

  // เช็คคร่าว ๆ ถ้า rightPart มีความยาว ~4-8 และเป็น [A-Za-z0-9-] => ถือว่าเป็น hash
  if (rightPart.length >= 4 && rightPart.length <= 8 && /^[A-Za-z0-9-]+$/.test(rightPart)) {
    // ถือว่าเป็น hashed => scope='hash', cls='box_abc123'
    return { scope: 'hash', cls: displayName };
  }
  // ไม่ใช่ hash => scope= leftPart, cls= rightPart
  return { scope: leftPart, cls: rightPart };
}

/************************************************************
 * 4) parseVariableAbbr("$bg-hover") => { baseVarName:"bg", suffix:"hover" }
 ************************************************************/
export function parseVariableAbbr(abbr: string): {
  baseVarName: string;
  suffix: string;
} {
  const varNameFull = abbr.startsWith('$') ? abbr.slice(1) : abbr;
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
 * 5) จัดการ schedule flush ตัวแปร
 ************************************************************/
const pendingVars: Record<string, string> = {};
let rafScheduled = false;

function flushVars() {
  for (const [varName, val] of Object.entries(pendingVars)) {
    document.documentElement.style.setProperty(varName, val);
  }
  for (const k in pendingVars) {
    delete pendingVars[k];
  }
  rafScheduled = false;
}

function scheduleFlush() {
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushVars);
  }
}

/************************************************************
 * 6) attachGetMethod => .get(...).set({ '$bg': 'red' })
 ************************************************************/
export function attachGetMethod<T extends Record<string, any>>(resultObj: CSSResult<T>): void {
  resultObj.get = function <K2 extends keyof T>(classKey: K2) {
    return {
      set: (props: Partial<Record<string, string>>) => {
        const displayName = resultObj[classKey as string];
        if (!displayName) return;

        // parseDisplayName -> { scope, cls }
        const { scope, cls } = parseDisplayName(displayName);

        for (const abbr in props) {
          let val = props[abbr];
          if (!val) continue;

          const { baseVarName, suffix } = parseVariableAbbr(abbr);

          // ถ้า scope=none => `--bg-box`
          // ถ้า scope=foo => `--bg-foo_box`
          // ถ้า scope=hash => `--bg-box_abc123`
          if (scope === 'none') {
            // e.g. `--bg-box-hover`
            const finalVar = suffix
              ? `--${baseVarName}-${cls}-${suffix}`
              : `--${baseVarName}-${cls}`;
            if (val.includes('--')) {
              val = val.replace(/(--[\w-]+)/g, 'var($1)');
            }
            pendingVars[finalVar] = val;
          } else if (scope === 'hash') {
            // e.g. scope=hash => displayName="box_abc123", cls="box_abc123"
            // => var name: `--bg-box_abc123-hover`
            const finalVar = suffix
              ? `--${baseVarName}-${cls}-${suffix}`
              : `--${baseVarName}-${cls}`;
            if (val.includes('--')) {
              val = val.replace(/(--[\w-]+)/g, 'var($1)');
            }
            pendingVars[finalVar] = val;
          } else {
            // e.g. scope="app" => displayName="app_box", cls="box"
            // => var name: `--bg-app_box-hover`
            const finalVar = suffix
              ? `--${baseVarName}-${scope}_${cls}-${suffix}`
              : `--${baseVarName}-${scope}_${cls}`;
            if (val.includes('--')) {
              val = val.replace(/(--[\w-]+)/g, 'var($1)');
            }
            pendingVars[finalVar] = val;
          }
        }
        scheduleFlush();
      },
    };
  };
}

/************************************************************
 * (NEW) parseClassBlocksWithBraceCounting
 *    - เพื่อหา .className { ... } ที่มี nested brace ได้
 ************************************************************/
function parseClassBlocksWithBraceCounting(text: string): Array<{
  className: string;
  body: string;
}> {
  const result: Array<{ className: string; body: string }> = [];

  // 1) regex จับจุดเริ่มต้นของ block => `.xxx {`
  //    โดยไม่ครอบคลุม body ด้วย ([\s\S]*?) แบบเดิม
  const pattern = /\.([\w-]+)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const clsName = match[1]; // "box" เช่น
    // ตำแหน่งที่อยู่หลัง '{'
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
        // เจอจุดปิดบล็อกแล้ว
        break;
      }
    }
    // i คือ index ของ '}' สุดท้าย (ปิด class block)
    const body = text.slice(startIndex, i).trim();
    result.push({ className: clsName, body });
  }

  return result;
}

/************************************************************
 * 7) ฟังก์ชัน css(...) minimal + handle @bind
 *    - ใช้ parseClassBlocksWithBraceCounting แทน regex /([\s\S]*?)\}/
 ************************************************************/
export function css<T extends Record<string, string[]>>(
  template: TemplateStringsArray
): CSSResult<T> {
  const text = template[0];

  // (A) หา scope (@scope)
  let scopeName = 'none';
  const scopeMatch = text.match(/@scope\s+([^\r\n]+)/);
  if (scopeMatch) {
    scopeName = scopeMatch[1].trim();
  }

  // (B) ดึง .className { ... } ด้วย brace counting
  const blocks = parseClassBlocksWithBraceCounting(text);
  const resultObj: Record<string, string> = {};

  // loop บล็อก => ตั้งชื่อ class
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
      // scope=normal => scopeName_className
      finalName = `${scopeName}_${className}`;
    }

    resultObj[className] = finalName;
  }

  // (C) parse @bind <key> .classA .classB ...
  const bindRegex = /@bind\s+([\w-]+)\s+([^\r\n]+)/g;
  let bindMatch: RegExpExecArray | null;
  while ((bindMatch = bindRegex.exec(text)) !== null) {
    const bindKey = bindMatch[1];
    const refsLine = bindMatch[2].trim();
    const refs = refsLine.split(/\s+/).filter(Boolean);

    const finalList: string[] = [];
    for (const r of refs) {
      if (!r.startsWith('.')) {
        continue;
      }
      const shortCls = r.slice(1);
      if (resultObj[shortCls]) {
        finalList.push(resultObj[shortCls]);
      } else {
        // fallback
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

  // (D) attach get().set(...)
  attachGetMethod(resultObj as CSSResult<T>);

  return resultObj as CSSResult<T>;
}
