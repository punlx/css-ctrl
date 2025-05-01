// src/client/utils/parseVariableAbbr.ts

/**
 * Splits a variable abbreviation into the base variable name and the suffix.
 * For example, "bg-color" -> { baseVarName: "bg", suffix: "color" }.
 */
export function parseVariableAbbr(abbr: string): {
  baseVarName: string;
  suffix: string;
} {
  const varNameFull = abbr;
  let baseVarName = varNameFull;
  let suffix = '';

  const dashIdx = varNameFull.lastIndexOf('-');
  if (dashIdx > 0) {
    baseVarName = varNameFull.slice(0, dashIdx);
    suffix = varNameFull.slice(dashIdx + 1);
  }
  return { baseVarName, suffix };
}
