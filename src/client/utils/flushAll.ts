// src/client/utils/flushAll.ts

let rafScheduled = false;

/**
 * FinalAction เก็บสถานะสุดท้ายของ varName นั้น ๆ ใน 1 เฟรม
 * - type = 'set' => setProperty(varName, value)
 * - type = 'remove' => removeProperty(varName)
 */
type FinalAction =
  | { type: 'set'; value: string }
  | { type: 'remove' };

/**
 * pendingGlobalFinal: Map เก็บ varName -> FinalAction
 * หากใน 1 เฟรมมีการ set/remove ซ้ำ ๆ varName เดียวกัน
 * เราจะ "เขียนทับ" (override) เหลือแค่สถานะสุดท้าย
 */
export const pendingGlobalFinal: Record<string, FinalAction> = {};

/**
 * flushAll(): ทำงานใน requestAnimationFrame รอบถัดไป
 * วิ่ง set/removeProperty ตาม pendingGlobalFinal แล้วเคลียร์
 */
export function flushAll() {
  const varNames = Object.keys(pendingGlobalFinal);
  for (const varName of varNames) {
    const action = pendingGlobalFinal[varName];
    if (action.type === 'set') {
      document.documentElement.style.setProperty(varName, action.value);
    } else {
      document.documentElement.style.removeProperty(varName);
    }
  }
  // เคลียร์ map
  for (const v of varNames) {
    delete pendingGlobalFinal[v];
  }

  rafScheduled = false;
}

/**
 * scheduleFlush(): ขอให้ flushAll() ทำงานภายใน rAF แค่ 1 ครั้งต่อเฟรม
 */
export function scheduleFlush() {
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushAll);
  }
}

/**
 * pushSetAction(): ตั้งค่า "สถานะสุดท้าย" ของ varName = { type: 'set', value }
 * ถ้ามี action เดิมจะถูกทับ
 */
export function pushSetAction(varName: string, value: string) {
  pendingGlobalFinal[varName] = { type: 'set', value };
  scheduleFlush();
}

/**
 * pushRemoveAction(): ตั้งค่า "สถานะสุดท้าย" ของ varName = { type: 'remove' }
 * ถ้ามี action เดิมจะถูกทับ
 */
export function pushRemoveAction(varName: string) {
  pendingGlobalFinal[varName] = { type: 'remove' };
  scheduleFlush();
}
