// src/client/styledUtils/parseVariableAbbr.ts
/**
 * parseVariableAbbr:
 * - แยก "$bg-hover" => { baseVarName: "bg", suffix: "hover" }
 * - ถ้าไม่มี dash => { baseVarName: "bg", suffix: "" }
 */
export function parseVariableAbbr(abbr: string): { baseVarName: string; suffix: string } {
  if (!abbr.startsWith('$')) {
    throw new Error(`[SWD-ERR] Only $variable is supported. Got "${abbr}"`);
  }
  const varNameFull = abbr.slice(1); // ตัด '$'
  let baseVarName = varNameFull;
  let suffix = '';

  const dashIdx = varNameFull.lastIndexOf('-');
  if (dashIdx > 0) {
    baseVarName = varNameFull.slice(0, dashIdx);
    suffix = varNameFull.slice(dashIdx + 1);
  }
  return { baseVarName, suffix };
}
