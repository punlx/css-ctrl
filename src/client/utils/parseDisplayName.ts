export function parseDisplayName(displayName: string): { scope: string; cls: string } {
  const underscoreIdx = displayName.indexOf('_');
  if (underscoreIdx < 0) {
    return { scope: 'none', cls: displayName };
  }
  const leftPart = displayName.slice(0, underscoreIdx);
  const rightPart = displayName.slice(underscoreIdx + 1);
  if (rightPart.length >= 4 && rightPart.length <= 8 && /^[A-Za-z0-9-]+$/.test(rightPart)) {
    return { scope: 'hash', cls: displayName };
  }
  return { scope: leftPart, cls: rightPart };
}
