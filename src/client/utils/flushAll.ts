// src/client/utils/flushAll.ts

let rafScheduled = false;
export const pendingGlobalVars = new Map<string, string>();

export function flushAll() {
  // 1) Global
  for (const [varName, val] of pendingGlobalVars.entries()) {
    document.documentElement.style.setProperty(varName, val);
  }
  pendingGlobalVars.clear();


  rafScheduled = false;
}

export function scheduleFlush() {
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushAll);
  }
}
