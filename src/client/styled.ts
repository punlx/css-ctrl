// src/client/styled.ts
import { parseDirectives } from './parseDirectives';
import { ensureScopeUnique } from './styledUtils/ensureScopeUnique';
import { extractScope } from './styledUtils/extractScope';
import { handleBindDirectives } from './styledUtils/handleBindDirectives';
import { processClassBlocks } from './styledUtils/processClassBlocks';
import { attachGetMethod } from './styledUtils/scheduleFlush';

export type StyledResult<T extends Record<string, string[]>> = {
  [K in keyof T]: string; // map className -> final string e.g. "scope_class"
} & {
  get: <K2 extends keyof T>(
    className: K2
  ) => {
    set: (props: Partial<Record<T[K2][number], string>>) => void;
  };
};

/**
 * ฟังก์ชันหลัก styled()
 * - parse directive (@scope, @bind) + parse block .class { ... } + parse @const
 * - สร้างคลาสตาม scopeName_className
 * - return object สำหรับเข้าถึงชื่อคลาส + .get(...).set(...) แก้ตัวแปร
 */
export function styled<T extends Record<string, string[]>>(
  template: TemplateStringsArray
): StyledResult<T> {
  // 1) ได้ text จาก template (ถือว่าใช้ template[0] อย่างเดียว)
  const text = template[0];

  // 2) parse directives + class blocks + const blocks
  const { directives, classBlocks, constBlocks } = parseDirectives(text);
  // 3) หา scope (@scope)
  const scopeName = extractScope(directives);

  // 4) เช็คว่า scope นี้ซ้ำหรือไม่
  ensureScopeUnique(scopeName);

  // 5) สร้าง map const => partial styleDef
  const constMap = new Map<string, any>();
  for (const c of constBlocks) {
    // ถ้ามีชื่อซ้ำกัน จะ error ตอน parse ไปแล้ว
    constMap.set(c.name, c.styleDef);
  }
  // 6) ประมวลผล class blocks => ได้ map { className: "scope_className" }
  //    โดยจะ merge partial styleDef ของแต่ละ @use
  const classMapping = processClassBlocks(scopeName, classBlocks, constMap);

  // 7) สร้าง resultObj (mapping className -> scope_className)
  const resultObj: Record<string, any> = { ...classMapping };

  // 8) attach get(...).set(...) method (runtime variable)
  attachGetMethod(resultObj);

  // 9) จัดการ @bind directive
  handleBindDirectives(scopeName, directives, resultObj);

  // 10) return
  return resultObj as StyledResult<T>;
}
