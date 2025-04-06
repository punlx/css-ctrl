// src/client/processOneClass.ts

import { insertedRulesMap, IInsertedRules } from './constant';
import { insertCSSRules, scheduleRemoveDisplayNames } from './insertCSSRules';
import { isServer } from '../server/constant';
import { serverStyleSheet } from '../server/ServerStyleSheetInstance';
import { transFormVariables } from './transFormVariables';
import { transformLocalVariables } from './transformLocalVariables';
import { IStyleDefinition } from '../shared/parseStyles.types';

/**
 * processOneClass:
 * - สร้าง displayName
 *   ถ้า scopeName==='none' => displayName = className เฉยๆ
 *   ถ้า scopeName อื่น => scopeName_className
 * - transformVariables + insertCSS
 * - Dev/HMR ลบของเก่า (ถ้ามี) -> insert ใหม่
 */
export function processOneClass(
  className: string,
  styleDef: IStyleDefinition,
  scopeName: string
): string {
  // สร้าง key เพื่อดู cache
  // ถ้า scope=none ก็ใช้ key='none_className' ป้องกันไม่ให้ชนกันเอง
  const key = scopeName === 'none' ? `none_${className}` : `${scopeName}_${className}`;

  // Production -> ใช้ cache
  if (process.env.NODE_ENV === 'production') {
    const cached = insertedRulesMap.get(key);
    if (cached) {
      return cached.displayName;
    }
  } else {
    // Dev/HMR: ลบ rule เก่าก่อน
    const old = insertedRulesMap.get(key);
    if (old) {
      scheduleRemoveDisplayNames([old.displayName]);
      insertedRulesMap.delete(key);
    }
  }

  // กำหนด displayName
  let displayName: string;
  if (scopeName === 'none') {
    displayName = className; // ไม่เติม prefix
  } else {
    displayName = `${scopeName}_${className}`;
  }

  // transform variable
  transFormVariables(styleDef, scopeName, className);
  transformLocalVariables(styleDef, scopeName, className);

  // ถ้ามี styleDef.queries => transform ด้วย
  if (styleDef.queries && styleDef.queries.length > 0) {
    for (const qb of styleDef.queries) {
      if (!qb.styleDef.localVars) {
        qb.styleDef.localVars = {};
      }
      Object.assign(qb.styleDef.localVars, styleDef.localVars);

      transFormVariables(qb.styleDef, scopeName, className);
      transformLocalVariables(qb.styleDef, scopeName, className);
    }
  }

  // Insert CSS (SSR หรือ Client)
  if (isServer) {
    serverStyleSheet().insertCSSRules(displayName, styleDef);
  } else {
    insertCSSRules(displayName, styleDef);
  }

  // เก็บลง Map
  const inserted: IInsertedRules = { displayName };
  insertedRulesMap.set(key, inserted);

  return displayName;
}
