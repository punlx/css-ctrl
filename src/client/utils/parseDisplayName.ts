// src/client/utils/parseDisplayName.ts

export function parseDisplayName(displayName: string): { scope: string; cls: string } {
  const underscoreIdx = displayName.indexOf('_');
  if (underscoreIdx < 0) {
    return { scope: 'none', cls: displayName };
  }
  const leftPart = displayName.slice(0, underscoreIdx);
  const rightPart = displayName.slice(underscoreIdx + 1);

  return { scope: leftPart, cls: rightPart };
}
