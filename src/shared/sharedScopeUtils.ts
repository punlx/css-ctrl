// src/sharedScopeUtils.ts
// หรือจะวางไว้ในที่ๆ สะดวก ทั้ง extension และ runtime import ได้

/************************************************************
 * 1) ฟังก์ชัน generateClassId (hash)
 *    (ถ้าอยู่ในไฟล์เดิมของคุณแล้ว ก็ย้ายมาได้)
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
 * 2) makeFinalName(scope, className, body?)
 *    - ถ้า scope='none' => return className
 *    - ถ้า scope='hash' => return className + '_' + hash(...)
 *    - else => scope + '_' + className
 ************************************************************/
export function makeFinalName(scopeName: string, className: string, body?: string): string {
  if (scopeName === 'none') {
    return className;
  } else if (scopeName === 'hash') {
    const hashedPart = generateClassId(className + (body || ''));
    return `${className}_${hashedPart}`;
  } else {
    return `${scopeName}_${className}`;
  }
}

/************************************************************
 * 3) parseFinalName(finalName)
 *    - ถ้าหา '_' ไม่เจอ => scope='none', cls=finalName
 *    - ถ้าเจอ => แบ่งซีกซ้าย/ขวา
 *    - เช็ค rightPart ว่าเป็น hashed หรือไม่
 *      (เช่น length 4..8 + regex => 'hash')
 *      ถ้าใช้ => scope='hash', cls=finalName
 *      ไม่งั้น => scope=leftPart, cls=rightPart
 ************************************************************/
export function parseFinalName(finalName: string): {
  scope: string;
  cls: string;
} {
  const underscoreIdx = finalName.indexOf('_');
  if (underscoreIdx < 0) {
    // ไม่มี '_' => scope=none
    return { scope: 'none', cls: finalName };
  }
  // แยก
  const leftPart = finalName.slice(0, underscoreIdx); // ซีกซ้าย
  const rightPart = finalName.slice(underscoreIdx + 1); // ซีกขวา

  // สมมติ: ถ้า rightPart มีความยาว 4..8 + ตัวอักษร a-zA-Z0-9- => ถือว่าเป็น hashed
  // => scope='hash', cls=finalName (ทั้งก้อน)
  if (rightPart.length >= 4 && rightPart.length <= 10) {
    if (/^[A-Za-z0-9-]+$/.test(rightPart)) {
      // treat เป็น hash
      return { scope: 'hash', cls: finalName };
    }
  }
  // ไม่เข้าเงื่อนไข => scope=leftPart, cls=rightPart
  return { scope: leftPart, cls: rightPart };
}
