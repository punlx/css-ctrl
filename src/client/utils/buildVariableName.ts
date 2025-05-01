// src/client/utils/buildVariableName.ts

/**
 * Constructs the final CSS custom property name based on the base variable name,
 * scope, class, and an optional suffix. Returns an empty string if the scope
 * is "none".
 */
export function buildVariableName(
  baseVarName: string,
  scope: string,
  cls: string,
  suffix: string
): string {
  if (scope === 'none') {
    return '';
  }

  const scopePart = scope + '_' + cls;

  if (!suffix) {
    return `--${baseVarName}-${scopePart}`;
  }
  return `--${baseVarName}-${scopePart}-${suffix}`;
}
