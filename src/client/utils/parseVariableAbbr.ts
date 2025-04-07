export function parseVariableAbbr(abbr: string): {
  baseVarName: string;
  suffix: string;
} {
  const varNameFull = abbr.startsWith('$') || abbr.startsWith('&') ? abbr.slice(1) : abbr;
  let baseVarName = varNameFull;
  let suffix = '';
  const dashIdx = varNameFull.lastIndexOf('-');
  if (dashIdx > 0) {
    baseVarName = varNameFull.slice(0, dashIdx);
    suffix = varNameFull.slice(dashIdx + 1);
  }
  return { baseVarName, suffix };
}
