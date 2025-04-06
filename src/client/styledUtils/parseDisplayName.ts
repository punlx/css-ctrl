// src/client/styledUtils/parseDisplayName.ts
/**
 * parseDisplayName:
 * - แยก "scope_class" ออกเป็น { scope, cls }
 */
export function parseDisplayName(displayName: string): { scope: string; cls: string } {
  const underscoreIdx = displayName.indexOf('_');
  if (underscoreIdx < 0) {
    throw new Error(`[SWD-ERR] Invalid displayName "${displayName}". Must contain underscore.`);
  }
  return {
    scope: displayName.slice(0, underscoreIdx),
    cls: displayName.slice(underscoreIdx + 1),
  };
}
