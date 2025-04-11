// src/client/parser/attachGetMethod.ts

import {
  CSSResult,
  // (NEW) import PropsForGlobalClass
  PropsForGlobalClass,
} from '../types';
import { buildVariableName } from '../utils/buildVariableName';
import { pendingGlobalVars, scheduleFlush } from '../utils/flushAll';
import { parseDisplayName } from '../utils/parseDisplayName';
import { parseVariableAbbr } from '../utils/parseVariableAbbr';

export function attachGetMethod<T extends Record<string, string[]>>(resultObj: CSSResult<T>): void {
  function get<K2 extends keyof T>(
    classKey: K2
  ): {
    set: (props: PropsForGlobalClass<T[K2]>) => void;
  };

  // Implementation (NEW)
  function get(arg1: string) {
    // .get("classKey")
    if (typeof arg1 === 'string') {
      const displayName = resultObj[arg1];
      if (!displayName) {
        return {
          set: () => {},
        };
      }
      const { scope, cls } = parseDisplayName(displayName);

      return {
        set(props: PropsForGlobalClass<T[keyof T]>) {
          // ถ้า scope=none => no-op
          if (scope === 'none') {
            return;
          }

          // (NEW) ทำให้ TS รู้จัก key ใน props ว่าเป็น Union ของ T[K2][number]
          const keys = Object.keys(props) as Array<keyof typeof props>;

          for (const abbr of keys) {
            let val = props[abbr];
            if (!val) continue;

            // parse variable abbr => baseVar, suffix
            const { baseVarName, suffix } = parseVariableAbbr(abbr);

            // build var name
            const finalVarName = buildVariableName(baseVarName, scope, cls, suffix);

            // replace --xxx => var(--xxx)
            if (val.includes('--')) {
              val = val.replace(/(--[\w-]+)/g, 'var($1)');
            }
            // set to global
            pendingGlobalVars.set(finalVarName, val);
          }
          scheduleFlush();
        },
      };
    }

    // fallback no-op
    return { set: () => {} };
  }

  resultObj.get = get as CSSResult<T>['get'];
}
