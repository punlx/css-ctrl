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
 * - ถ้า scope=hash => จะต้องผ่าแบบพิเศษ "box_abc123" => scope='hash', cls='box_abc123'
 *   (ใน minimal นี้ สมมติ "hash" จะตรวจเจอด้วย check string ลงไปง่าย ๆ)
 ************************************************************/
export function parseDisplayName(displayName: string): { scope: string; cls: string } {
  // ถ้า detect ว่าด้านท้ายมี "_abc123" ที่มาจาก generateClassId
  // อาจจะถือว่า scope='hash'
  // แต่ในที่นี้ เอาง่าย ๆ: เช็คว่ามี '_' หรือไม่
  const underscoreIdx = displayName.indexOf('_');
  if (underscoreIdx < 0) {
    return { scope: 'none', cls: displayName };
  }

  // ลองเช็คว่าก่อนหน้า '_' คือ 'hash' รึเปล่า? -> อาจไม่ตรง logic เพราะ minimal
  // ใน codebase ใหญ่ จะเก็บ scope ไว้ก่อน transform
  // แต่ minimal: สมมติว่า scope != 'none' => "someScope_box" หรือ "box_abc123"
  // จึงแยก scope= leftPart, cls=rightPart
  // NOTE: ถ้า logic codebase จริง: "box_abc123" => scope=hash, cls="box_abc123"
  // เราจะทำให้ scope='hash' โดย brute force ตรวจ
  const leftPart = displayName.slice(0, underscoreIdx);
  const rightPart = displayName.slice(underscoreIdx + 1);

  // ถ้าเป็นกรณี "box_abc123" => leftPart="box", rightPart="abc123"
  // minimal approach: scope='hash', cls="box_abc123"
  // ถ้าเป็นกรณี "foo_box" => leftPart="foo", rightPart="box" => scope="foo", cls="box"

  // สมมติ: ถ้า rightPart.length===6 หรือน้อยกว่านี้ (มักเป็น hash) => scope='hash'
  if (rightPart.length >= 4 && rightPart.length <= 8) {
    // เช็คคร่าว ๆ ว่าเป็น a-z0-9
    if (/^[A-Za-z0-9-]+$/.test(rightPart)) {
      // ถือว่าเป็น hashed
      return { scope: 'hash', cls: displayName };
    }
  }
  // else => scope=leftPart, cls=rightPart
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
 * 7) ฟังก์ชัน css(...) minimal + handle @bind
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

  // (B) parse .className { ... }
  //     ถ้า scope=hash => ต้อง generate hash
  const classRegex = /\.([\w-]+)\s*\{([\s\S]*?)\}/g;
  const resultObj: Record<string, string> = {};

  let match: RegExpExecArray | null;
  while ((match = classRegex.exec(text)) !== null) {
    const className = match[1];
    const bodyInside = match[2];

    let finalName = className;
    if (scopeName === 'none') {
      // ใช้ className เดิม e.g. "box"
      finalName = className;
    } else if (scopeName === 'hash') {
      // generateClassId(...): ควรผูกกับ body หรือ text อะไรก็ได้
      const hashedPart = generateClassId(className + bodyInside);
      // ได้ e.g. "box_abc123"
      finalName = `${className}_${hashedPart}`;
    } else {
      // scope=ปกติ => "scopeName_className" e.g. "app_box"
      finalName = `${scopeName}_${className}`;
    }
    resultObj[className] = finalName;
  }

  // (C) parse @bind <key> .classA .classB ...
  // => resultObj[bindKey] = e.g. "app_box app_box2 ..."
  const bindRegex = /@bind\s+([\w-]+)\s+([^\r\n]+)/g;
  let bindMatch: RegExpExecArray | null;
  while ((bindMatch = bindRegex.exec(text)) !== null) {
    const bindKey = bindMatch[1];
    const refsLine = bindMatch[2].trim();
    const refs = refsLine.split(/\s+/).filter(Boolean);

    const finalList: string[] = [];
    for (const r of refs) {
      if (!r.startsWith('.')) {
        continue; // minimal: ข้าม
      }
      const shortCls = r.slice(1);
      if (resultObj[shortCls]) {
        // ถ้ามีใน resultObj อยู่แล้ว
        finalList.push(resultObj[shortCls]);
      } else {
        // fallback
        if (scopeName === 'none') {
          finalList.push(shortCls);
        } else if (scopeName === 'hash') {
          // สมมติ generateClassId() อีกที (หรือจะข้าม)
          const hashedPart = generateClassId(shortCls);
          finalList.push(`${shortCls}_${hashedPart}`);
        } else {
          finalList.push(`${scopeName}_${shortCls}`);
        }
      }
    }

    resultObj[bindKey] = finalList.join(' ');
  }

  // (D) attach .get().set(...)
  attachGetMethod(resultObj as CSSResult<T>);

  return resultObj as CSSResult<T>;
}
