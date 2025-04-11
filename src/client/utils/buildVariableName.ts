// src/client/utils/buildVariableName.ts

export function buildVariableName(
  baseVarName: string,
  scope: string,
  cls: string,
  suffix: string
): string {
  if (scope === 'none') {
    return '';
  }

  // (REMOVED) เคส scope === 'hash'
  const scopePart = scope + '_' + cls;

  if (!suffix) {
    return `--${baseVarName}-${scopePart}`;
  }
  return `--${baseVarName}-${scopePart}-${suffix}`;
}
