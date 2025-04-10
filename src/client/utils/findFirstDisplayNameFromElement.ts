// src/client/utils/findFirstDisplayNameFromElement.ts

import { CSSResult } from '../types';

export function findFirstDisplayNameFromElement<T extends Record<string, string[]>>(
  el: HTMLElement,
  resultObj: CSSResult<T>
): string | null {
  const classList = (el.className || '').split(/\s+/).filter(Boolean);
  for (const c of classList) {
    // c เช่น "app_box"
    for (const key in resultObj) {
      if (typeof resultObj[key] === 'string' && resultObj[key] === c) {
        return c; // finalName เช่น "app_box"
      }
    }
  }
  return null;
}
