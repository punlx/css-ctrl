export function parseClassBlocksWithBraceCounting(text: string): Array<{
  className: string;
  body: string;
}> {
  const result: Array<{ className: string; body: string }> = [];
  const pattern = /\.([\w-]+)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const clsName = match[1];
    const startIndex = pattern.lastIndex;
    let braceCount = 1;
    let i = startIndex;
    for (; i < text.length; i++) {
      if (text[i] === '{') {
        braceCount++;
      } else if (text[i] === '}') {
        braceCount--;
      }
      if (braceCount === 0) {
        break;
      }
    }
    const body = text.slice(startIndex, i).trim();
    result.push({ className: clsName, body });
  }
  return result;
}
