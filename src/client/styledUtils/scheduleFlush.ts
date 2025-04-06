// src/client/styledUtils/scheduleFlush.ts

import { buildVariableName } from './buildVariableName';
import { parseDisplayName } from './parseDisplayName';
import { parseVariableAbbr } from './parseVariableAbbr';

const pendingVars: Record<string, string> = {};
let rafScheduled = false;

export function flushVars() {
  for (const [varName, val] of Object.entries(pendingVars)) {
    if (document.documentElement.style.getPropertyValue(varName) !== val) {
      document.documentElement.style.setProperty(varName, val);
    }
  }
  for (const key in pendingVars) {
    delete pendingVars[key];
  }
  rafScheduled = false;
}

export function scheduleFlush() {
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushVars);
  }
}

//=====================================
// attachGetMethod + handleBindDirectives
//=====================================

type InterimResult<T> = {
  [K in keyof T]: string;
} & {
  [key: string]: string | undefined;
} & {
  get?: <K2 extends keyof T>(
    classKey: K2
  ) => {
    set: (props: Partial<Record<string, string>>) => void;
  };
};

export function attachGetMethod<T extends Record<string, any>>(resultObj: InterimResult<T>): void {
  resultObj.get = function <K2 extends keyof T>(classKey: K2) {
    return {
      set: (props: Partial<Record<string, string>>) => {
        const displayName = resultObj[classKey as string];
        if (!displayName) return;

        const { scope, cls } = parseDisplayName(displayName);

        for (const abbr in props) {
          let val = props[abbr];
          if (!val) continue;

          // แยก varName / suffix
          const { baseVarName, suffix } = parseVariableAbbr(abbr);
          // ประกอบชื่อ
          const finalVar = buildVariableName(baseVarName, scope, cls, suffix);

          // ถ้า value มี --xxx => replace เป็น var(--xxx)
          if (val.includes('--')) {
            val = val.replace(/(--[\w-]+)/g, 'var($1)');
          }
          // เก็บลง queue
          pendingVars[finalVar] = val;
        }
        // schedule flush
        scheduleFlush();
      },
    };
  };
}
