// src/shared/parseStyles/parseScreenStyle.ts

import { breakpoints, typographyDict } from '../../client/theme';
import { abbrMap } from '../constant';
import { IStyleDefinition } from '../parseStyles.types';
import {
  convertCSSVariable,
  separateStyleAndProperties,
  detectImportantSuffix,
} from './parseStylesUtils';

export function parseScreenStyle(
  abbrLine: string,
  styleDef: IStyleDefinition,
  isConstContext: boolean = false
) {
  const openParenIdx = abbrLine.indexOf('(');
  let inside = abbrLine.slice(openParenIdx + 1, -1).trim();

  if (!(inside.startsWith('min') || inside.startsWith('max'))) {
    const [bp] = inside.split(', ');
    if (breakpoints.dict[bp]) {
      inside = inside.replace(bp, breakpoints.dict[bp]);
    }
  }

  const commaIdx = inside.indexOf(',');
  if (commaIdx === -1) {
    throw new Error(`"screen" syntax error: ${abbrLine}`);
  }

  const screenPart = inside.slice(0, commaIdx).trim();
  const propsPart = inside.slice(commaIdx + 1).trim();

  const bracketOpen = screenPart.indexOf('[');
  const bracketClose = screenPart.indexOf(']');
  if (bracketOpen === -1 || bracketClose === -1) {
    throw new Error(`"screen" must contain something like min-w[600px]. Got ${screenPart}`);
  }

  const screenAbbr = screenPart.slice(0, bracketOpen).trim();
  const screenValue = screenPart.slice(bracketOpen + 1, bracketClose).trim();
  const screenProp = abbrMap[screenAbbr as keyof typeof abbrMap];
  if (!screenProp) {
    throw new Error(`"${screenAbbr}" not found in abbrMap or not min-w/max-w`);
  }

  const mediaQuery = `(${screenProp}:${screenValue})`;

  const styleList = propsPart.split(/ (?=[^\[\]]*(?:\[|$))/);
  const screenProps: Record<string, string> = {};

  for (const p of styleList) {
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
        throw new Error(`[SWD-ERR] !important is not allowed with local var (${abbr2}) in screen.`);
      }

      // เดิม: if (abbr2 === 'f') => fontDict
      // ใหม่: if (abbr2 === 'ty') => typographyDict
      if (abbr2 === 'ty') {
        const dictEntry = typographyDict.dict[val2] as Record<string, string> | undefined;
        if (!dictEntry) {
          throw new Error(`"${val2}" not found in theme.typography(...) (screen).`);
        }
        for (const [cssProp2, cssVal2] of Object.entries(dictEntry)) {
          screenProps[cssProp2] = convertCSSVariable(cssVal2) + (isImportant ? ' !important' : '');
        }
      } else {
        const cProp = abbrMap[abbr2 as keyof typeof abbrMap];
        if (!cProp) {
          throw new Error(`"${abbr2}" not found in abbrMap (screen).`);
        }
        if (val2.includes('--&')) {
          const replaced = val2.replace(/--&([\w-]+)/g, (_, varName) => {
            return `LOCALVAR(${varName})`;
          });
          screenProps[cProp] = replaced + (isImportant ? ' !important' : '');
        } else {
          screenProps[cProp] = convertCSSVariable(val2) + (isImportant ? ' !important' : '');
        }
      }
    }
  }

  styleDef.screens.push({ query: mediaQuery, props: screenProps });
}
