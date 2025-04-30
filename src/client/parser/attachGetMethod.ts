// src/client/parser/attachGetMethod.ts

import { CSSResult, PropsForGlobalClass } from '../types';
import { buildVariableName } from '../utils/buildVariableName';
import { parseDisplayName } from '../utils/parseDisplayName';
import { parseVariableAbbr } from '../utils/parseVariableAbbr';
import { pushSetAction, pushRemoveAction, waitForNextFlush } from '../utils/flushAll';

/**
 * attachGetMethod: เพิ่ม .get(...).set(...).reset(...) และ .reset() (ล้างทั้งหมดของ scope)
 */
export function attachGetMethod<T extends Record<string, string[]>>(resultObj: CSSResult<T>): void {
  /**
   * registry เก็บว่า classKey ไหนมี finalVarName อะไรบ้าง
   * เช่น registry["box"] = Set(["--bg-app_box", "--color-app_box", ...])
   */
  const registry: Record<string, Set<string>> = {};

  /**
   * สำหรับ type overload ของ .get(...)
   * - .set(props)
   * - .reset(keys?)  (optional keys เหมือน code เก่า)
   * - .value(keys)   (ต้องส่ง keys เสมอ)
   */
  function get<K2 extends keyof T>(
    classKey: K2
  ): {
    set: (props: PropsForGlobalClass<T[K2]>) => void;
    reset: (keys?: Array<T[K2][number]>) => void;
    value: (
      keys: Array<T[K2][number]>
    ) => Promise<Record<T[K2][number], { prop: string; value: string }>>;
  };

  /**
   * ฟังก์ชันหลักรับเป็น string (classKey)
   * ถ้าไม่มี classKey ใน resultObj => return no-op (ตาม code เก่า)
   */
  function get(arg1: string) {
    if (typeof arg1 === 'string') {
      const displayName = resultObj[arg1];
      if (!displayName) {
        return {
          set: () => {},
          reset: () => {},
          value: async () => ({}),
        };
      }

      // parseDisplayName => { scope, cls }
      const { scope, cls } = parseDisplayName(displayName);

      return {
        /**
         * set(props) => สำหรับ setProperty (เป็น final varName)
         * เก็บลง registry ด้วย
         */
        set(props: PropsForGlobalClass<T[keyof T]>) {
          if (scope === 'none') {
            return;
          }

          const keys = Object.keys(props) as Array<keyof typeof props>;
          for (const abbr of keys) {
            let val = props[abbr];
            if (!val) continue;

            const { baseVarName, suffix } = parseVariableAbbr(abbr);
            const finalVarName = buildVariableName(baseVarName, scope, cls, suffix);

            // ถ้ามี --xxx ให้แทนเป็น var(--xxx)
            if (val.includes('--')) {
              val = val.replace(/(--[\w-]+)/g, 'var($1)');
            }

            // push action => setProperty (override action เดิมหากมี)
            pushSetAction(finalVarName, val);

            // เก็บลง registry เพื่อให้ reset ได้ภายหลัง
            if (!registry[arg1]) {
              registry[arg1] = new Set<string>();
            }
            registry[arg1].add(finalVarName);
          }
        },

        /**
         * reset(keys?) => removeProperty เฉพาะที่เคย set ไว้
         * ถ้าไม่ส่ง keys => removeProperty ทั้งหมดของ classKey
         * (ยังคงเหมือน code เก่า)
         */
        reset(keys?: Array<T[keyof T][number]>) {
          if (scope === 'none') {
            return;
          }
          if (!registry[arg1]) {
            return;
          }

          // reset all
          if (!keys) {
            for (const varName of registry[arg1]) {
              pushRemoveAction(varName);
            }
            registry[arg1].clear();
            return;
          }

          // reset เฉพาะ key ที่ส่งมา
          for (const abbr of keys) {
            const { baseVarName, suffix } = parseVariableAbbr(abbr);
            const finalVarName = buildVariableName(baseVarName, scope, cls, suffix);

            if (registry[arg1].has(finalVarName)) {
              pushRemoveAction(finalVarName);
              registry[arg1].delete(finalVarName);
            }
          }
        },

        /**
         * value(keys): Promise => รอให้ flushAll() ทำงานเสร็จ
         * แล้วค่อยอ่านค่าจริงจาก DOM (inline + fallback computed)
         * (บังคับต้องส่ง array of keys)
         */
        async value(keys: Array<T[keyof T][number]>) {
          if (scope === 'none') {
            return {};
          }

          // รอรอบ rAF ถัดไป ถ้ามีการ set/reset ที่ยัง pending
          await waitForNextFlush();

          const result: Record<T[keyof T][number], { prop: string; value: string }> = {} as any;

          for (const abbr of keys) {
            const { baseVarName, suffix } = parseVariableAbbr(abbr);
            const finalVarName = buildVariableName(baseVarName, scope, cls, suffix);

            // อ่านจาก inline style ก่อน ถ้าไม่มีจึง fallback getComputedStyle
            const computedVal =
              document.documentElement.style.getPropertyValue(finalVarName) ||
              getComputedStyle(document.documentElement).getPropertyValue(finalVarName);

            result[abbr] = {
              prop: finalVarName,
              value: computedVal,
            };
          }

          return result;
        },
      };
    }

    // fallback no-op
    return { set: () => {}, reset: () => {}, value: async () => ({}) };
  }

  /**
   * resetAll(): ล้างตัวแปรทั้งหมดของ resultObj (ทุก classKey, ทุก varName)
   */
  function resetAll() {
    for (const classKey in registry) {
      const setOfVar = registry[classKey];
      for (const varName of setOfVar) {
        pushRemoveAction(varName);
      }
      setOfVar.clear();
    }
  }

  // ติดตั้งเมธอด get + resetAll ให้ resultObj
  (resultObj as any).get = get;
  (resultObj as any).reset = resetAll;
}
