// src/client/utils/parseVariableAbbr.ts

export function parseVariableAbbr(abbr: string): {
  baseVarName: string;
  suffix: string;
} {
  // (REMOVED) เดิมเคยเช็ค prefix $ หรือ & => abbr.slice(1)
  // ตอนนี้ไม่มี prefix, ใช้ abbr ตรง ๆ

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
