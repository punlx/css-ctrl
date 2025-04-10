// src/client/utils/flushAll.ts

let rafScheduled = false;
export const pendingGlobalVars = new Map<string, string>();
// (REMOVED) export const pendingLocalMap = new Map<HTMLElement, Record<string, string>>();

export function flushAll() {
  // 1) Global
  for (const [varName, val] of pendingGlobalVars.entries()) {
    document.documentElement.style.setProperty(varName, val);
  }
  pendingGlobalVars.clear();

  // (REMOVED) no local style usage
  // for (const [el, props] of pendingLocalMap.entries()) {
  //   for (const [propName, propVal] of Object.entries(props)) {
  //     el.style.setProperty(propName, propVal);
  //   }
  // }
  // pendingLocalMap.clear();

  rafScheduled = false;
}

export function scheduleFlush() {
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushAll);
  }
}
