// src/client/parser/attachGetMethod.ts

import {
  CSSResult,
  PropsForGlobalClass,
} from '../types';
import { buildVariableName } from '../utils/buildVariableName';
import { pendingGlobalActions, scheduleFlush } from '../utils/flushAll';
import { parseDisplayName } from '../utils/parseDisplayName';
import { parseVariableAbbr } from '../utils/parseVariableAbbr';

/**
 * เพิ่มเมธอด .get(...).set(...) และ .get(...).reset(...) ให้กับ resultObj
 * รวมถึง .reset() ในระดับ resultObj เพื่อลบตัวแปรทั้งหมดใน scope นี้
 */
export function attachGetMethod<T extends Record<string, string[]>>(resultObj: CSSResult<T>): void {
  // registry จะเก็บว่า className ไหนมี finalVarName อะไรบ้าง
  // เช่น registry["box"] = Set(["--bg-app_box", "--color-app_box", ...])
  const registry: Record<string, Set<string>> = {};

  /**
   * ประกาศ Overload ให้ TS เห็น:
   *   get<K2 extends keyof T>(classKey: K2): { set(...); reset(...); }
   */
  function get<K2 extends keyof T>(
    classKey: K2
  ): {
    set: (props: PropsForGlobalClass<T[K2]>) => void;
    reset: (keys?: Array<T[K2][number]>) => void;
  };

  /**
   * ฟังก์ชันหลักที่ถูกเรียกจริง ๆ
   *   - รับเป็น string (classKey)
   *   - ถ้าไม่มี classKey ใน resultObj => ส่ง no-op
   *   - ถ้ามี => return { set(...), reset(...) }
   */
  function get(arg1: string) {
    if (typeof arg1 === 'string') {
      const displayName = resultObj[arg1];
      if (!displayName) {
        // ถ้าไม่เจอ classKey => no-op
        return {
          set: () => {},
          reset: () => {},
        };
      }

      // แยก scope, cls จาก displayName (ตัวอย่าง "app_box" => scope="app", cls="box")
      const { scope, cls } = parseDisplayName(displayName);

      return {
        /**
         * set(props) => แปลง key => finalVarName แล้วใส่คิวไว้ setProperty(varName, value)
         * เก็บลง registry เพื่อให้สามารถ .reset() ได้ภายหลัง
         */
        set(props: PropsForGlobalClass<T[keyof T]>) {
          if (scope === 'none') {
            return;
          }

          const keys = Object.keys(props) as Array<keyof typeof props>;

          for (const abbr of keys) {
            let val = props[abbr];
            if (!val) continue;

            // แปลง abbr => baseVarName, suffix
            const { baseVarName, suffix } = parseVariableAbbr(abbr);
            // สร้างชื่อ var สุดท้าย
            const finalVarName = buildVariableName(baseVarName, scope, cls, suffix);

            // แทนที่ "--xxx" เป็น "var(--xxx)" ให้รองรับการนำ var() มาใช้ซ้อน
            if (val.includes('--')) {
              val = val.replace(/(--[\w-]+)/g, 'var($1)');
            }

            // push action type=set
            pendingGlobalActions.push({ type: 'set', varName: finalVarName, value: val });

            // เก็บลง registry
            if (!registry[arg1]) {
              registry[arg1] = new Set<string>();
            }
            registry[arg1].add(finalVarName);
          }

          scheduleFlush();
        },

        /**
         * reset(keys?) => ลบตัวแปรทั้งหมดของ classKey นี้ หรือเฉพาะที่ระบุ
         */
        reset(keys?: Array<T[keyof T][number]>) {
          if (scope === 'none') {
            return;
          }
          // ถ้า classKey นี้ไม่เคย set อะไรเลย => จบ
          if (!registry[arg1]) {
            return;
          }

          // ถ้าไม่ส่ง keys => removeProperty ทั้งหมด
          if (!keys) {
            for (const varName of registry[arg1]) {
              pendingGlobalActions.push({ type: 'remove', varName });
            }
            registry[arg1].clear();
            scheduleFlush();
            return;
          }

          // remove เฉพาะตัวที่ส่งมา
          for (const abbr of keys) {
            const { baseVarName, suffix } = parseVariableAbbr(abbr);
            const finalVarName = buildVariableName(baseVarName, scope, cls, suffix);

            if (registry[arg1].has(finalVarName)) {
              pendingGlobalActions.push({ type: 'remove', varName: finalVarName });
              registry[arg1].delete(finalVarName);
            }
          }

          scheduleFlush();
        },
      };
    }

    // fallback no-op (เผื่อกรณี typeof arg1 !== 'string')
    return { set: () => {}, reset: () => {} };
  }

  /**
   * reset ทั้งหมดของ resultObj นี้ (ลบทุกตัวแปรที่เคย set ในทุกรายการ classKey)
   */
  function resetAll() {
    // วนลบใน registry ทุก classKey
    for (const classKey in registry) {
      const setOfVars = registry[classKey];
      for (const varName of setOfVars) {
        pendingGlobalActions.push({ type: 'remove', varName });
      }
      setOfVars.clear();
    }
    scheduleFlush();
  }

  // ติดตั้ง get ลงไปใน resultObj (type cast เพื่อให้ตรง CSSResult<T>['get'])
  resultObj.get = get as CSSResult<T>['get'];

  // ติดตั้ง resetAll ลงใน resultObj
  // (ใช้ as any เพื่อหลีกเลี่ยงการ error ของ TS ที่ยังไม่รู้จัก .reset())
  (resultObj as any).reset = resetAll;
}
