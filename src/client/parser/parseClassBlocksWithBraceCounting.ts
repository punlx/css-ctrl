// src/client/parser/parseClassBlocksWithBraceCounting.ts

/**
 * Parses CSS-like text to identify class blocks of the form `.className { ... }`.
 * The previous implementation relied on a non-greedy regular expression which
 * failed whenever nested braces were present inside a block (e.g. `@media` or
 * nested selectors). This version performs a simple brace counting routine so
 * that nested braces are handled correctly.
 */
export function parseClassBlocksWithBraceCounting(
  text: string
): Array<{
  className: string;
  body: string;
}> {
  const result: Array<{ className: string; body: string }> = [];
  const pattern = /\.([\w-]+)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const clsName = match[1];
    let idx = pattern.lastIndex;
    let braceCount = 1;

    while (idx < text.length && braceCount > 0) {
      const ch = text[idx];
      if (ch === '{') {
        braceCount++;
      } else if (ch === '}') {
        braceCount--;
      }
      idx++;
    }

    const endIdx = idx - 1;
    const body = text.slice(pattern.lastIndex, endIdx).trim();
    result.push({ className: clsName, body });

    // Continue searching from the end of this block
    pattern.lastIndex = idx;
  }

  return result;
}
