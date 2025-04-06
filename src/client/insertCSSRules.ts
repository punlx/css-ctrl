// src/client/insertCSSRules.ts
import { constructedSheet, fallbackStyleElement } from './constant';
import { insertedRulesMap, IInsertedRules } from './constant';
import { buildCssText } from '../shared/buildCssText';
import { isServer } from '../server/constant';
import { IStyleDefinition } from '../shared/parseStyles.types';

// -----------------------
// การ insert (คงเหมือนเดิม)
// -----------------------
const pendingStyleDefs = new Map<string, IStyleDefinition>();
let pending = false;
let dirty = false;

/**
 * แยก string (ที่อาจมีหลาย block) ออกเป็น rule ย่อย ๆ
 */
function splitCssIntoIndividualRules(cssText: string): string[] {
  // จับทุกอย่างที่ลงท้ายด้วย '}'
  const ruleMatches = cssText.match(/[^}]+}/g) || [];
  return ruleMatches.map((r) => r.trim());
}

/**
 * flushPendingStyles:
 * - สร้าง CSS จากทุก styleDef ใน pendingStyleDefs
 * - insertRule ทีละ rule
 */
function flushPendingStyles() {
  const allRules: string[] = [];

  // รวม rule list ทั้งหมด
  for (const [displayName, styleDef] of pendingStyleDefs.entries()) {
    const cssText = buildCssText(displayName, styleDef);
    const ruleList = splitCssIntoIndividualRules(cssText);
    allRules.push(...ruleList);
  }

  // insert ลงใน constructedSheet หรือ fallback
  if (constructedSheet) {
    allRules.forEach((rule) => {
      try {
        constructedSheet!.insertRule(rule, constructedSheet!.cssRules.length);
      } catch (err) {
        console.warn('insertRule error:', rule, err);
      }
    });
  } else if (fallbackStyleElement) {
    const fallbackSheet = fallbackStyleElement.sheet as CSSStyleSheet;
    allRules.forEach((rule) => {
      try {
        fallbackSheet.insertRule(rule, fallbackSheet.cssRules.length);
      } catch (err) {
        console.warn('fallback insertRule error:', rule, err);
      }
    });
  }

  // เคลียร์
  pendingStyleDefs.clear();
  pending = false;

  // หาก flush เสร็จแล้วพบว่ามี dirty => flush อีกรอบ
  if (dirty) {
    dirty = false;
    scheduleFlush();
  }
}

/**
 * scheduleFlush ด้วย requestAnimationFrame
 */
function scheduleFlush() {
  if (isServer) return;
  requestAnimationFrame(flushPendingStyles);
}

/**
 * insertCSSRules
 * - ใส่ styleDef เข้า pending batch
 * - แล้วจะ flush ด้วย requestAnimationFrame
 */
export function insertCSSRules(displayName: string, styleDef: IStyleDefinition) {
  pendingStyleDefs.set(displayName, styleDef);

  const inserted: IInsertedRules = { displayName };
  insertedRulesMap.set(displayName, inserted);

  if (pending) {
    dirty = true;
  } else {
    pending = true;
    dirty = false;
    scheduleFlush();
  }
}

// -----------------------
// การ remove แบบ Batch + Chunk + Regex
// -----------------------
const toRemoveNames: string[] = [];
let removing = false;

/**
 * scheduleRemoveDisplayNames:
 * - เก็บ displayNames ที่ต้องการลบเข้า queue
 * - trigger flushRemoveChunk() แบบ async
 */
export function scheduleRemoveDisplayNames(names: string[]) {
  if (isServer) return;

  // fallback: ถ้าไม่มี constructedSheet และไม่มี fallbackStyleElement ก็ไม่ต้องทำ
  if (!constructedSheet && !fallbackStyleElement) return;

  // รวมชื่อ
  toRemoveNames.push(...names);

  if (!removing) {
    removing = true;
    requestAnimationFrame(flushRemoveChunk);
  }
}

/**
 * flushRemoveChunk:
 * - สร้าง big RegExp รวมทุก displayName
 * - ลบแบบ chunk (300 rule ต่อ frame) เพื่อไม่บล็อก
 * - handle ทั้ง constructedSheet และ fallback
 */
function flushRemoveChunk() {
  // ถ้าไม่มี sheet อะไรเลย -> จบ
  if (!constructedSheet && !fallbackStyleElement) {
    removing = false;
    return;
  }

  // สร้าง set ไม่ให้ชื่อซ้ำ
  const uniqueNames = Array.from(new Set(toRemoveNames));
  toRemoveNames.length = 0; // เคลียร์ queue

  // สร้าง pattern RegExp e.g. (\.app_main1|app_main1|\.app_main2|app_main2)
  const patternParts: string[] = [];
  for (const n of uniqueNames) {
    const escaped = escapeRegExp(n);
    // ทั้ง .className และ displayName
    patternParts.push(`\\.${escaped}`, escaped);
  }
  // ถ้าว่างหมดก็ไม่ลบ
  if (patternParts.length === 0) {
    removing = false;
    return;
  }
  const finalPattern = patternParts.join('|');
  const regex = new RegExp(finalPattern);

  // ลบใน constructedSheet (ถ้ามี)
  if (constructedSheet) {
    let i = constructedSheet.cssRules.length - 1;
    const chunkSize = 300;

    function removeChunkConstructed() {
      let steps = chunkSize;
      for (; i >= 0 && steps > 0; i--, steps--) {
        const rule = constructedSheet!.cssRules[i];
        if (regex.test(rule.cssText)) {
          constructedSheet!.deleteRule(i);
        }
      }
      if (i >= 0) {
        requestAnimationFrame(removeChunkConstructed);
      } else {
        // จบ constructedSheet
        checkFallback();
      }
    }
    removeChunkConstructed();
  } else {
    // ไม่มี constructedSheet -> check fallback
    checkFallback();
  }

  // ฟังก์ชันลบ fallback
  function checkFallback() {
    if (fallbackStyleElement && fallbackStyleElement.sheet) {
      let fallbackSheet = fallbackStyleElement.sheet as CSSStyleSheet;
      let j = fallbackSheet.cssRules.length - 1;
      const chunkSize2 = 300;

      function removeChunkFallback() {
        let steps = chunkSize2;
        for (; j >= 0 && steps > 0; j--, steps--) {
          const rule = fallbackSheet.cssRules[j];
          if (regex.test(rule.cssText)) {
            fallbackSheet.deleteRule(j);
          }
        }
        if (j >= 0) {
          requestAnimationFrame(removeChunkFallback);
        } else {
          removing = false;
        }
      }
      removeChunkFallback();
    } else {
      removing = false;
    }
  }
}

/**
 * escapeRegExp:
 * - ป้องกัน meta char ใน regExp เช่น ., *, +
 */
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
