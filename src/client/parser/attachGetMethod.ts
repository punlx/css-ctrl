// src/client/parser/attachGetMethod.ts

import { CSSResult } from '../types'; // สมมติว่า CSSResult<T> กับ PropsForGlobalClass อยู่ใน types.ts
import { PropsForGlobalClass } from '../types';
import { parseDisplayName } from '../utils/parseDisplayName';
import { parseVariableAbbr } from '../utils/parseVariableAbbr';
import { buildVariableName } from '../utils/buildVariableName';
import { pendingGlobalVars, scheduleFlush } from '../utils/flushAll';

import { CssCtrlPlugin } from '../../plugin/types';
import { UnionToIntersection } from '../../plugin/types';
import { plugin } from '../../shared/constants';
import { SelectStorage } from '../../plugin/select';

/**
 * attachGetMethod - ฟังก์ชันที่จะถูกเรียกในตอนสร้าง resultObj
 * เพื่อเติมเมธอด .get(...) ลงไปใน object CSSResult<T>
 */
export function attachGetMethod<T extends Record<string, string[]>>(resultObj: CSSResult<T>): void {
  // ----------------------------------------------
  // Overload 1: ถ้าเรียก get("classKey") อย่างเดียว => { set(...) }
  // ----------------------------------------------
  function get<K2 extends keyof T>(
    classKey: K2
  ): {
    set: (props: PropsForGlobalClass<T[K2]>) => void;
  };

  // ----------------------------------------------
  // Overload 2: ถ้าเรียก get("classKey", [plugins]) => รวม methods จากทุก plugin
  // ----------------------------------------------
  function get<K2 extends keyof T, PL extends Array<CssCtrlPlugin<any>>>(
    classKey: K2,
    plugins?: PL
  ): {
    set: (props: PropsForGlobalClass<T[K2]>) => void;
  } & UnionToIntersection<ReturnType<PL[number]>>;

  // ----------------------------------------------
  // ตัว implementation ของฟังก์ชัน get(...)
  // ----------------------------------------------
  function get(arg1: any, arg2?: any) {
    // ถ้าเรียก get(...) แบบไม่มี array plugin => Overload 1
    if (arg2 === undefined) {
      const displayName = resultObj[arg1];
      if (!displayName) {
        return { set: () => {} };
      }
      const { scope, cls } = parseDisplayName(displayName);

      return {
        set: (props: Record<string, string>) => {
          if (scope === 'none') return;

          // แปลง props => var(...)
          const keys = Object.keys(props);
          for (const abbr of keys) {
            let val = props[abbr];
            if (!val) continue;

            const { baseVarName, suffix } = parseVariableAbbr(abbr);
            const finalVarName = buildVariableName(baseVarName, scope, cls, suffix);

            // replace --xxx => var(--xxx)
            if (val.includes('--')) {
              val = val.replace(/(--[\w-]+)/g, 'var($1)');
            }
            pendingGlobalVars.set(finalVarName, val);
          }
          scheduleFlush();
        },
      };
    }

    // ถ้าเรียก get(...) พร้อม plugin => Overload 2
    const classKey = arg1;
    const plugins = arg2 as Array<CssCtrlPlugin<any>>;
    const displayName = resultObj[classKey];
    if (!displayName) {
      return { set: () => {} };
    }
    const { scope, cls } = parseDisplayName(displayName);

    // สร้าง storage (object) สำหรับ plugin เก็บ state
    const storage = {
      plugin,
    } as unknown as SelectStorage;

    // baseObj มี .set(...)
    const baseObj = {
      set: (props: Record<string, string>) => {
        if (scope === 'none') return;
        for (const abbr in props) {
          let val = props[abbr];
          if (!val) continue;

          const { baseVarName, suffix } = parseVariableAbbr(abbr);
          const finalVarName = buildVariableName(baseVarName, scope, cls, suffix);

          if (val.includes('--')) {
            val = val.replace(/(--[\w-]+)/g, 'var($1)');
          }
          pendingGlobalVars.set(finalVarName, val);
        }
        scheduleFlush();
      },
    };

    // รวม methods จาก plugin ทั้งหมด
    let combinedMethods = {} as UnionToIntersection<ReturnType<(typeof plugins)[number]>>;

    for (const pg of plugins) {
      const pluginObj = pg(storage, displayName);
      // แทนที่จะ merge ตรงๆ เราจะวน key เพื่อให้ plugin สามารถมีโครงสร้าง nested ได้
      for (const key of Object.keys(pluginObj)) {
        (combinedMethods as any)[key] = pluginObj[key];
      }
    }

    // สร้าง finalObj = baseObj + combinedMethods
    return Object.assign({}, baseObj, combinedMethods);
  }

  // ผูกฟังก์ชัน get(...) ลงใน resultObj
  (resultObj as any).get = get;
}
