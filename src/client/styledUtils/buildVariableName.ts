// src/client/styledUtils/buildVariableName.ts

/**
 * buildVariableName:
 * - ประกอบชื่อ CSS variable ตรงกับ transformVariables.ts
 * - เช่น baseVarName="bg", scope="app", cls="box", suffix="hover"
 *   => "--bg-app_box-hover"
 */
export function buildVariableName(
  baseVarName: string,
  scope: string,
  cls: string,
  suffix: string
): string {
  if (!suffix) {
    return `--${baseVarName}-${scope}_${cls}`;
  }
  return `--${baseVarName}-${scope}_${cls}-${suffix}`;
}
