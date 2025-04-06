// src/client/styledUtils/processClassBlocks.ts

import { IStyleDefinition } from '../../shared/parseStyles.types';
import { createEmptyStyleDef } from '../../shared/parseStyles/parseStylesUtils';
import { parseSingleAbbr } from '../../shared/parseStyles/parseSingleAbbr';
import { mergeStyleDef } from './mergeStyleDef';
import { processOneClass } from '../processOneClass';
import { IClassBlock } from '../parseDirectives';
import { extractQueryBlocks } from './extractQueryBlocks';

/**
 * usedScopeClasses:
 * - เก็บ "scopeName:className" เพื่อกันซ้ำข้ามไฟล์
 */
export const usedScopeClasses = new Set<string>();

/**
 * processClassBlocks:
 * - วน loop classBlocks (แต่ละ .className { ... })
 * - แยกและ parse @use, จากนั้น merge ลง classStyleDef ก่อน
 * - แล้วค่อย parse บรรทัดปกติ (override ได้)
 * - แยก parse @query <selector> { ... } -> styleDef.queries
 * - ภายใน query block ก็ parse line + @use (merge styleDef) เช่นเดียวกัน
 * - เรียก processOneClass -> ได้ displayName = "scopeName_className" หรือ ".className" (ถ้า scope=none)
 */
export function processClassBlocks(
  scopeName: string,
  classBlocks: IClassBlock[],
  constMap: Map<string, IStyleDefinition>
): Record<string, string> {
  const localClasses = new Set<string>();
  const resultMap: Record<string, string> = {};

  for (const block of classBlocks) {
    const clsName = block.className;

    // 1) กันซ้ำภายในไฟล์
    if (localClasses.has(clsName)) {
      throw new Error(
        `[SWD-ERR] Duplicate class ".${clsName}" in scope "${scopeName}" (same file).`
      );
    }
    localClasses.add(clsName);

    // 2) กันซ้ำข้ามไฟล์
    if (scopeName !== 'none') {
      const scopeClassKey = `${scopeName}:${clsName}`;
      if (process.env.NODE_ENV === 'production') {
        if (usedScopeClasses.has(scopeClassKey)) {
          console.warn(
            `[SWD-ERR] Class ".${clsName}" in scope "${scopeName}" is already used in another file.`
          );
        }
      }
      usedScopeClasses.add(scopeClassKey);
    }

    // 3) สร้าง styleDef
    const classStyleDef = createEmptyStyleDef();

    // extract query blocks
    const { queries, newBody } = extractQueryBlocks(block.body);
    const realQueryBlocks = queries.map((q) => ({
      selector: q.selector,
      styleDef: createEmptyStyleDef(),
    }));
    classStyleDef.queries = realQueryBlocks;

    // 4) parse body หลัก (split line => parseSingleAbbr)
    const lines = newBody
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    let usedConstNames: string[] = [];
    const normalLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('@use ')) {
        if (usedConstNames.length > 0) {
          throw new Error(`[SWD-ERR] Multiple @use lines in class ".${clsName}" are not allowed.`);
        }
        const tokens = line.replace('@use', '').trim().split(/\s+/);
        usedConstNames = tokens;
      } else {
        normalLines.push(line);
      }
    }

    // (A) merge const ก่อน
    if (usedConstNames.length > 0) {
      for (const cName of usedConstNames) {
        if (!constMap.has(cName)) {
          throw new Error(`[SWD-ERR] @use refers to unknown const "${cName}".`);
        }
        const partialDef = constMap.get(cName)!;
        mergeStyleDef(classStyleDef, partialDef);
      }
    }
    // (B) parse บรรทัดปกติ -> override
    for (const ln of normalLines) {
      parseSingleAbbr(ln, classStyleDef);
    }

    // 5) parse query blocks
    for (let i = 0; i < realQueryBlocks.length; i++) {
      const qBlock = realQueryBlocks[i];
      const qRawBody = queries[i].rawBody;

      // **คัดลอก localVars จาก parent => query styleDef**
      // เพื่อให้ query block มองเห็น var ที่ parent ประกาศ
      if (!qBlock.styleDef.localVars) {
        qBlock.styleDef.localVars = {};
      }
      if (classStyleDef.localVars) {
        // merge เข้าไป
        Object.assign(qBlock.styleDef.localVars, classStyleDef.localVars);
      }

      const qLines = qRawBody
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const usedConstNamesQ: string[] = [];
      const normalQueryLines: string[] = [];

      for (const qLn of qLines) {
        if (qLn.startsWith('@use ')) {
          const tokens = qLn.replace('@use', '').trim().split(/\s+/);
          usedConstNamesQ.push(...tokens);
        } else {
          normalQueryLines.push(qLn);
        }
      }

      // (A) merge const ของ query
      for (const cName of usedConstNamesQ) {
        if (!constMap.has(cName)) {
          throw new Error(`[SWD-ERR] @use refers to unknown const "${cName}" inside @query.`);
        }
        const partialDef = constMap.get(cName)!;
        if (partialDef.hasRuntimeVar) {
          throw new Error(
            `[SWD-ERR] @use "${cName}" has $variable, not allowed inside @query block.`
          );
        }
        mergeStyleDef(qBlock.styleDef, partialDef);
      }
      // (B) parse บรรทัดปกติ => isQueryBlock=true
      for (const qLn of normalQueryLines) {
        parseSingleAbbr(qLn, qBlock.styleDef, false, true);
      }
    }

    // 6) ตรวจ usedLocalVars ที่ parent
    if ((classStyleDef as any)._usedLocalVars) {
      for (const usedVar of (classStyleDef as any)._usedLocalVars) {
        if (!classStyleDef.localVars || !(usedVar in classStyleDef.localVars)) {
          throw new Error(
            `[SWD-ERR] local var "${usedVar}" is used but not declared in ".${clsName}" (scope="${scopeName}").`
          );
        }
      }
    }

    // ตรวจ usedLocalVars ใน query
    for (let i = 0; i < realQueryBlocks.length; i++) {
      const qStyleDef = realQueryBlocks[i].styleDef;
      const sel = queries[i].selector;
      if ((qStyleDef as any)._usedLocalVars) {
        for (const usedVar of (qStyleDef as any)._usedLocalVars) {
          // ตอน parseSingleAbbr, query block ได้ localVars มาจาก parent
          if (!qStyleDef.localVars || !(usedVar in qStyleDef.localVars)) {
            throw new Error(
              `[SWD-ERR] local var "${usedVar}" is used but not declared (query="${sel}", class=".${clsName}").`
            );
          }
        }
      }
    }

    // 7) processOneClass => insert CSS
    const displayName = processOneClass(clsName, classStyleDef, scopeName);
    resultMap[clsName] = displayName;
  }

  return resultMap;
}
