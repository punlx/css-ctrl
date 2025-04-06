// src/shared/parseStyles/parseStateStyle.ts

import { typographyDict } from '../../client/theme';
import { abbrMap } from '../constant';
import { IStyleDefinition } from '../parseStyles.types';
import {
  convertCSSVariable,
  separateStyleAndProperties,
  detectImportantSuffix,
} from './parseStylesUtils';

export function parseStateStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false
) {
  const openParenIdx = abbrLine.indexOf('(');
  const funcName = abbrLine.slice(0, openParenIdx).trim(); // "hover", "focus", etc.
  const inside = abbrLine.slice(openParenIdx + 1, -1).trim();

  const propsInState = inside.split(/ (?=[^\[\]]*(?:\[|$))/);
  const result: Record<string, string> = {};

  for (const p of propsInState) {
    const { line: tokenNoBang, isImportant } = detectImportantSuffix(p);
    if (isConstContext && isImportant) {
      throw new Error(`[SWD-ERR] !important is not allowed in @const block. Found: "${abbrLine}"`);
    }

    const [abbr, val] = separateStyleAndProperties(tokenNoBang);
    if (!abbr) continue;

    const expansions = [`${abbr}[${val}]`];
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      if (abbr2.startsWith('--&') && isImportant) {
        throw new Error(
          `[SWD-ERR] !important is not allowed with local var (${abbr2}) in state ${funcName}.`
        );
      }

      const isVar = abbr2.startsWith('$');
      const realAbbr = isVar ? abbr2.slice(1) : abbr2;

      // เดิม: if (realAbbr==='f') => fontDict
      // ใหม่: if (realAbbr==='ty') => typographyDict
      if (realAbbr === 'ty') {
        const dictEntry = typographyDict.dict[val2] as Record<string, string> | undefined;
        if (!dictEntry) {
          throw new Error(
            `[SWD-ERR] Typography key "${val2}" not found in theme.typography(...) for state ${funcName}.`
          );
        }
        for (const [cssProp2, cssVal2] of Object.entries(dictEntry)) {
          result[cssProp2] = convertCSSVariable(cssVal2) + (isImportant ? ' !important' : '');
        }
        continue;
      }

      const cProp = abbrMap[realAbbr as keyof typeof abbrMap];
      if (!cProp) {
        throw new Error(`"${realAbbr}" not found in abbrMap for state ${funcName}.`);
      }

      let finalVal = convertCSSVariable(val2);
      if (isVar) {
        styleDef.varStates = styleDef.varStates || {};
        styleDef.varStates[funcName] = styleDef.varStates[funcName] || {};
        styleDef.varStates[funcName][realAbbr] = finalVal;

        result[cProp] = `var(--${realAbbr}-${funcName})` + (isImportant ? ' !important' : '');
      } else if (val2.includes('--&')) {
        const replaced = val2.replace(/--&([\w-]+)/g, (_, varName) => {
          return `LOCALVAR(${varName})`;
        });
        result[cProp] = replaced + (isImportant ? ' !important' : '');
      } else {
        result[cProp] = finalVal + (isImportant ? ' !important' : '');
      }
    }
  }

  styleDef.states[funcName] = result;
}
