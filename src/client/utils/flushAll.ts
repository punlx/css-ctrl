// src/client/utils/flushAll.ts

let rafScheduled = false;

/**
 * โครงสร้าง Action ที่จะถูก Flush ใน requestAnimationFrame
 * - type = 'set': setProperty(varName, value)
 * - type = 'remove': removeProperty(varName)
 */
export type GlobalAction =
  | { type: 'set'; varName: string; value: string }
  | { type: 'remove'; varName: string };

/** Queue ของ Action ทั้งหมด */
export const pendingGlobalActions: GlobalAction[] = [];

/** ทำหน้าที่ flush ค่าใน pendingGlobalActions ครั้งเดียวใน 1 frame */
export function flushAll() {
  for (const action of pendingGlobalActions) {
    if (action.type === 'set') {
      document.documentElement.style.setProperty(action.varName, action.value);
    } else {
      document.documentElement.style.removeProperty(action.varName);
    }
  }
  pendingGlobalActions.length = 0;
  rafScheduled = false;
}

/** scheduleFlush เพื่อให้ flushAll() ทำงานภายใน requestAnimationFrame */
export function scheduleFlush() {
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushAll);
  }
}
