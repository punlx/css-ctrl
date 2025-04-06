// src/client/styledUtils/ensureScopeUnique.ts

export const usedScopes = new Set<string>();

/**
 * ensureScopeUnique:
 * - ป้องกัน scopeName ซ้ำข้ามไฟล์
 * - production: ใช้เตือนปกติ
 * - dev: ข้ามหรือแจ้งเตือนครั้งแรก
 * - ถ้า scopeName === 'none' -> ข้ามการเตือน
 */
export function ensureScopeUnique(scopeName: string) {
  // ถ้า scopeName === 'none' -> ข้ามการเตือน/เช็คซ้ำ
  if (scopeName === 'none') {
    return;
  }

  // Production: เตือนว่าซ้ำตามปกติ
  if (process.env.NODE_ENV === 'production') {
    if (usedScopes.has(scopeName)) {
      console.warn(`[SWD-ERR] scope "${scopeName}" is already used in another file.`);
    }
  }
  // dev -> เดิมอาจ skip เตือนซ้ำ แต่ตัวอย่างนี้ใส่ลง set ปกติ
  usedScopes.add(scopeName);
}
