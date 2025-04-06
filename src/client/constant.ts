// * src/client/constant.ts

/* ------------------------------------------
 * - ประกาศ constructedSheet และ fallbackStyleElement
 * - เช็ค typeof window เพื่อไม่ให้เกิด "CSSStyleSheet is not defined" บน SSR
 * ------------------------------------------ */

/** ชุด interface/const ตามที่ไลบรารีต้นฉบับใช้งาน */
export interface IInsertedRules {
  displayName: string;
}
export const insertedRulesMap = new Map<string, IInsertedRules>();

/** ตัวแปรหลักเก็บ CSSStyleSheet (เฉพาะฝั่ง Client) */
export let constructedSheet: CSSStyleSheet | null = null;

/** ตัวแปร fallback <style> element, หาก browser ไม่รองรับ adoptedStyleSheets */
export let fallbackStyleElement: HTMLStyleElement | null = null;

/**
 * เช็คว่าตอนนี้อยู่บน client (window/document มี)
 * ถ้าใช่ => สร้าง CSSStyleSheet หรือสร้าง <style> fallback
 */
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // ถ้า browser รองรับ adoptedStyleSheets
  if ('adoptedStyleSheets' in Document.prototype) {
    constructedSheet = new CSSStyleSheet();
    // เพิ่มเข้าไปใน document.adoptedStyleSheets
    // ให้ browser ใช้ stylesheet ตัวนี้
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, constructedSheet];
  } else {
    // fallback: สร้าง <style> ธรรมดา
    const styleEl = document.createElement('style');
    styleEl.id = 'styledwind-construct-fallback';
    document.head.appendChild(styleEl);
    fallbackStyleElement = styleEl;
  }
}
