// src/shared/parseStyles/parsePseudoElementStyle.ts

import { typographyDict } from '../../client/theme';
import { abbrMap } from '../constant';
import { IStyleDefinition } from '../parseStyles.types';
import {
  convertCSSVariable,
  separateStyleAndProperties,
  detectImportantSuffix,
} from './parseStylesUtils';

export function parsePseudoElementStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false
) {
  const openParenIdx = abbrLine.indexOf('(');
  const pseudoName = abbrLine.slice(0, openParenIdx).trim();
  const inside = abbrLine.slice(openParenIdx + 1, -1).trim();
  const propsInPseudo = inside.split(/ (?=[^\[\]]*(?:\[|$))/);

  const result: Record<string, string> = styleDef.pseudos[pseudoName] || {};
  styleDef.varPseudos = styleDef.varPseudos || {};
  styleDef.varPseudos[pseudoName] = styleDef.varPseudos[pseudoName] || {};

  for (const p of propsInPseudo) {
    const { line: tokenNoBang, isImportant } = detectImportantSuffix(p);
    if (isConstContext && isImportant) {
      throw new Error(`[SWD-ERR] !important is not allowed in @const block. Found: "${abbrLine}"`);
    }
    const [abbr, val] = separateStyleAndProperties(tokenNoBang);
    if (!abbr) continue;

    if (abbr.startsWith('--&') && isImportant) {
      throw new Error(
        `[SWD-ERR] !important is not allowed with local var (${abbr}) in pseudo ${pseudoName}.`
      );
    }

    if (abbr === 'ct') {
      result['content'] = `"${val}"` + (isImportant ? ' !important' : '');
      continue;
    }

    const expansions = [`${abbr}[${val}]`];
    for (const ex of expansions) {
      const [abbr2, val2] = separateStyleAndProperties(ex);
      if (!abbr2) continue;

      const isVariable = abbr2.startsWith('$');
      const realAbbr = isVariable ? abbr2.slice(1) : abbr2;

      // เดิม: if (realAbbr === 'f') => fontDict
      // ใหม่: if (realAbbr === 'ty') => typographyDict
      if (realAbbr === 'ty') {
        const dictEntry = typographyDict.dict[val2] as Record<string, string> | undefined;
        if (!dictEntry) {
          throw new Error(
            `[SWD-ERR] Typography key "${val2}" not found in theme.typography(...) for pseudo ${pseudoName}.`
          );
        }
        for (const [cssProp2, cssVal2] of Object.entries(dictEntry)) {
          result[cssProp2] = convertCSSVariable(cssVal2) + (isImportant ? ' !important' : '');
        }
        continue;
      }

      const cProp = abbrMap[realAbbr as keyof typeof abbrMap];
      if (!cProp) {
        throw new Error(`"${realAbbr}" not found in abbrMap for pseudo-element ${pseudoName}.`);
      }

      const finalVal = convertCSSVariable(val2);
      if (isVariable) {
        styleDef.varPseudos[pseudoName]![realAbbr] = finalVal;
        result[cProp] = `var(--${realAbbr}-${pseudoName})` + (isImportant ? ' !important' : '');
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

  styleDef.pseudos[pseudoName] = result;
}
