// src/client/parser/attachGetMethod.ts

import {
  CSSResult,
  PropsForAllLocalAndGlobal,
  PropsForGlobalClass,
  PropsForLocalAndGlobalClass,
} from '../types';
import { buildVariableName } from '../utils/buildVariableName';
import { findFirstDisplayNameFromElement } from '../utils/findFirstDisplayNameFromElement';
import { pendingGlobalVars, pendingLocalMap, scheduleFlush } from '../utils/flushAll';
import { parseDisplayName } from '../utils/parseDisplayName';
import { parseVariableAbbr } from '../utils/parseVariableAbbr';

export function attachGetMethod<T extends Record<string, string[]>>(resultObj: CSSResult<T>): void {
  // Overloads
  function get<K2 extends keyof T>(
    classKey: K2
  ): {
    set: (props: PropsForGlobalClass<T[K2]>) => void;
  };
  function get(el: HTMLElement): {
    set: (props: PropsForAllLocalAndGlobal<T>) => void;
  };
  function get<K2 extends keyof T>(
    classKey: K2,
    el: HTMLElement
  ): {
    set: (props: PropsForLocalAndGlobalClass<T[K2]>) => void;
  };

  // Implementation
  function get(arg1: string | HTMLElement, arg2?: HTMLElement) {
    // CASE 1: .get("box")
    if (typeof arg1 === 'string' && !arg2) {
      const displayName = resultObj[arg1];
      if (!displayName) {
        return { set: () => {} };
      }
      const { scope, cls } = parseDisplayName(displayName);

      return {
        set(props: Record<string, string>) {
          for (const abbr in props) {
            let val = props[abbr];
            if (!val) continue;
            const { baseVarName, suffix } = parseVariableAbbr(abbr);

            let finalVarName = '';
            if (scope === 'none') {
              finalVarName = suffix
                ? `--${baseVarName}-${cls}-${suffix}`
                : `--${baseVarName}-${cls}`;
            } else if (scope === 'hash') {
              finalVarName = suffix
                ? `--${baseVarName}-${cls}-${suffix}`
                : `--${baseVarName}-${cls}`;
            } else {
              finalVarName = buildVariableName(baseVarName, scope, cls, suffix);
            }
            if (val.includes('--')) {
              val = val.replace(/(--[\w-]+)/g, 'var($1)');
            }
            pendingGlobalVars.set(finalVarName, val);
          }
          scheduleFlush();
        },
      };
    }

    // CASE 2: .get(ref.current)
    if (typeof arg1 !== 'string') {
      const el = arg1;
      return {
        set(props: Record<string, string>) {
          const matchedDisplayName = findFirstDisplayNameFromElement(el, resultObj);
          const parsed = matchedDisplayName
            ? parseDisplayName(matchedDisplayName)
            : { scope: 'none', cls: '' };

          for (const abbr in props) {
            let val = props[abbr];
            if (!val) continue;

            if (abbr.startsWith('&')) {
              // local style
              const { baseVarName, suffix } = parseVariableAbbr(abbr);
              let localVar = '';
              if (parsed.scope === 'none') {
                localVar = suffix
                  ? `--${baseVarName}-${parsed.cls}-${suffix}`
                  : `--${baseVarName}-${parsed.cls}`;
              } else if (parsed.scope === 'hash') {
                localVar = suffix
                  ? `--${baseVarName}-${parsed.cls}-${suffix}`
                  : `--${baseVarName}-${parsed.cls}`;
              } else {
                localVar = buildVariableName(baseVarName, parsed.scope, parsed.cls, suffix);
              }
              if (val.includes('--')) {
                val = val.replace(/(--[\w-]+)/g, 'var($1)');
              }
              let existing = pendingLocalMap.get(el) || {};
              existing[localVar] = val;
              pendingLocalMap.set(el, existing);
            } else if (abbr.startsWith('$')) {
              // global
              const { baseVarName, suffix } = parseVariableAbbr(abbr);
              let finalVarName: string;
              if (parsed.scope === 'none') {
                finalVarName = suffix
                  ? `--${baseVarName}-${parsed.cls}-${suffix}`
                  : `--${baseVarName}-${parsed.cls}`;
              } else if (parsed.scope === 'hash') {
                finalVarName = suffix
                  ? `--${baseVarName}-${parsed.cls}-${suffix}`
                  : `--${baseVarName}-${parsed.cls}`;
              } else {
                finalVarName = buildVariableName(baseVarName, parsed.scope, parsed.cls, suffix);
              }
              if (val.includes('--')) {
                val = val.replace(/(--[\w-]+)/g, 'var($1)');
              }
              pendingGlobalVars.set(finalVarName, val);
            }
          }
          scheduleFlush();
        },
      };
    }

    // CASE 3: .get("box", ref.current)
    if (typeof arg1 === 'string' && arg2) {
      const classKey = arg1;
      const el = arg2;
      const displayName = resultObj[classKey];
      if (!displayName) {
        return { set: () => {} };
      }
      const { scope, cls } = parseDisplayName(displayName);

      return {
        set(props: Record<string, string>) {
          for (const abbr in props) {
            let val = props[abbr];
            if (!val) continue;

            // แยก $xxx vs &xxx
            if (abbr.startsWith('&')) {
              // local var
              const { baseVarName, suffix } = parseVariableAbbr(abbr);
              let localVar = '';
              if (scope === 'none') {
                localVar = suffix ? `--${baseVarName}-${cls}-${suffix}` : `--${baseVarName}-${cls}`;
              } else if (scope === 'hash') {
                localVar = suffix ? `--${baseVarName}-${cls}-${suffix}` : `--${baseVarName}-${cls}`;
              } else {
                localVar = buildVariableName(baseVarName, scope, cls, suffix);
              }
              if (val.includes('--')) {
                val = val.replace(/(--[\w-]+)/g, 'var($1)');
              }
              let existing = pendingLocalMap.get(el) || {};
              existing[localVar] = val;
              pendingLocalMap.set(el, existing);
            } else if (abbr.startsWith('$')) {
              // global var
              const { baseVarName, suffix } = parseVariableAbbr(abbr);
              let finalVarName: string;
              if (scope === 'none') {
                finalVarName = suffix
                  ? `--${baseVarName}-${cls}-${suffix}`
                  : `--${baseVarName}-${cls}`;
              } else if (scope === 'hash') {
                finalVarName = suffix
                  ? `--${baseVarName}-${cls}-${suffix}`
                  : `--${baseVarName}-${cls}`;
              } else {
                finalVarName = buildVariableName(baseVarName, scope, cls, suffix);
              }
              if (val.includes('--')) {
                val = val.replace(/(--[\w-]+)/g, 'var($1)');
              }
              pendingGlobalVars.set(finalVarName, val);
            }
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
