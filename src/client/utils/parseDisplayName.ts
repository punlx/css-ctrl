// src/client/utils/parseDisplayName.ts

/**
 * Extracts the `scope` and `cls` from a displayName string.
 * If the string does not contain an underscore, it assigns the entire value to `cls`
 * and returns `scope` as "none".
 */
export function parseDisplayName(displayName: string): { scope: string; cls: string } {
  const underscoreIdx = displayName.indexOf('_');
  if (underscoreIdx < 0) {
    return { scope: 'none', cls: displayName };
  }
  const leftPart = displayName.slice(0, underscoreIdx);
  const rightPart = displayName.slice(underscoreIdx + 1);

  return { scope: leftPart, cls: rightPart };
}
