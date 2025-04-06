// src/shared/parseStyles/parseSingleAbbr.ts

import { IStyleDefinition } from '../parseStyles.types';
import { createEmptyStyleDef } from './parseStylesUtils';
import { parseBaseStyle } from './parseBaseStyle';
import { parseContainerStyle } from './parseContainerStyle';
import { parsePseudoElementStyle } from './parsePseudoElementStyle';
import { parseScreenStyle } from './parseScreenStyle';
import { parseStateStyle } from './parseStateStyle';
import { knownStates, supportedPseudos } from '../constant';

/**
 * parseSingleAbbr:
 *  - abbrLine: string ที่อยู่ในรูปเช่น "bg[red]" หรือ "hover(bg[red])" เป็นต้น
 *  - styleDef: IStyleDefinition
 *  - isConstContext: boolean (ถ้าเป็น @const หรือ theme.define => true)
 *  - isQueryBlock: boolean (ถ้าอยู่ใน @query => true)
 *  - isDefineContext: boolean (default=false) => บอกว่าเป็น theme.define
 *    => ถ้าเป็น true => ไม่อนุญาต $variable
 */
export function parseSingleAbbr(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false,
  isQueryBlock: boolean = false,
  isDefineContext: boolean = false
) {
  const trimmed = abbrLine.trim();

  // ถ้า isDefineContext => ห้าม $variable (เฉพาะ theme.define)
  if (isDefineContext && /^\$[\w-]+\[/.test(trimmed)) {
    throw new Error(
      `[SWD-ERR] $variable is not allowed in theme.define block. Found: "${trimmed}"`
    );
  }

  // ถ้าอยู่ใน context ของ @const / theme.define => ห้ามมี @query
  if (isConstContext && trimmed.startsWith('@query')) {
    throw new Error(
      `[SWD-ERR] @query is not allowed in @const or theme.define() block. Found: "${trimmed}"`
    );
  }

  // ถ้าอยู่ใน query block (isQueryBlock=true) => ห้าม nested @query
  if (isQueryBlock && trimmed.startsWith('@query')) {
    throw new Error(`[SWD-ERR] Nested @query is not allowed.`);
  }

  // และใน query block ห้าม $var / local var ตามโค้ดเดิม
  if (isQueryBlock) {
    if (/^--&[\w-]+\[/.test(trimmed)) {
      throw new Error(`[SWD-ERR] Local var not allowed inside @query block. Found: "${trimmed}"`);
    }
    if (/^\$[\w-]+\[/.test(trimmed)) {
      throw new Error(
        `[SWD-ERR] Runtime variable ($var) not allowed inside @query block. Found: "${trimmed}"`
      );
    }
  }

  // ถ้ายังไม่มี hasRuntimeVar ใน styleDef และเจอ $... => set hasRuntimeVar
  if (!styleDef.hasRuntimeVar && /\$[\w-]+\[/.test(trimmed)) {
    styleDef.hasRuntimeVar = true;
  }

  // ตรวจว่ามี "(" -> อาจเป็น state/pseudo/screen/container
  const openParenIndex = trimmed.indexOf('(');
  if (openParenIndex === -1) {
    parseBaseStyle(trimmed, styleDef, isConstContext, isQueryBlock);
    return;
  }

  const prefix = trimmed.slice(0, openParenIndex);

  if (knownStates.includes(prefix)) {
    parseStateStyle(trimmed, styleDef, isConstContext);
    return;
  }
  if (supportedPseudos.includes(prefix)) {
    parsePseudoElementStyle(trimmed, styleDef, isConstContext);
    return;
  }
  if (prefix === 'screen') {
    parseScreenStyle(trimmed, styleDef, isConstContext);
    return;
  }
  if (prefix === 'container') {
    parseContainerStyle(trimmed, styleDef, isConstContext);
    return;
  }

  // ถ้าไม่เข้า case ข้างบน => parse base
  parseBaseStyle(trimmed, styleDef, isConstContext, isQueryBlock);
}
