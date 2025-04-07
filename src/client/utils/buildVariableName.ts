export function buildVariableName(
  baseVarName: string,
  scope: string,
  cls: string,
  suffix: string
): string {
  if (suffix) {
    return `--${baseVarName}-${scope}_${cls}-${suffix}`;
  }
  return `--${baseVarName}-${scope}_${cls}`;
}
