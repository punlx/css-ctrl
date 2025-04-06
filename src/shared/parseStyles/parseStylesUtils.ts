// src/shared/parseStyles/parseStylesUtils.ts
import { IStyleDefinition } from '../parseStyles.types';

/** (คงของเดิม ไม่แก้) */
export function createEmptyStyleDef(): IStyleDefinition {
  return {
    base: {},
    states: {},
    screens: [],
    containers: [],
    pseudos: {},
    hasRuntimeVar: false,
  };
}

/** (คงของเดิม ไม่แก้ signature) */
export function separateStyleAndProperties(abbr: string): [string, string] {
  const match = /^([\w\-\$\&]+)\[(.*)\]$/.exec(abbr.trim());
  if (!match) return ['', ''];
  return [match[1], match[2]];
}

/** (คงของเดิม ไม่แก้) */
export function convertCSSVariable(value: string) {
  if (value.includes('--')) {
    // เช่น "--&xxx" หรือ "--global-var"
    return value.replace(/(--[\w-]+)/g, 'var($1)');
  }
  return value;
}

/**
 * detectImportantSuffix:
 * - ฟังก์ชันใหม่ สำหรับตรวจจับว่า string ลงท้ายด้วย "!"" หลัง "]" หรือไม่
 * - ถ้าใช่ จะคืน isImportant = true, และตัด '!' ทิ้ง
 */
export function detectImportantSuffix(raw: string): { line: string; isImportant: boolean } {
  let trimmed = raw.trim();
  let isImportant = false;
  // มองหารูป "...]!"
  if (trimmed.endsWith(']!')) {
    isImportant = true;
    // ตัด '!' ตัวท้ายออก
    trimmed = trimmed.slice(0, -1);
  }
  return { line: trimmed, isImportant };
}
