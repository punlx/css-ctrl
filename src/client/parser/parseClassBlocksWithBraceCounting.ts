// src/client/parser/parseClassBlocksWithBraceCounting.ts

/**
 * Parses CSS-like text to identify class blocks of the form `.className { ... }`.
 * This function uses a non-greedy regex approach, ignoring nested braces. It returns
 * an array of objects containing the class name and the raw content of the block.
 */
export function parseClassBlocksWithBraceCounting(
  text: string
): Array<{
  className: string;
  body: string;
}> {
  const result: Array<{ className: string; body: string }> = [];
  const pattern = /\.([\w-]+)\s*\{[\s\S]*?\}/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const clsName = match[1];
    const block = match[0];
    const openCurlyPos = block.indexOf('{');
    const closeCurlyPos = block.lastIndexOf('}');
    let body = '';
    if (openCurlyPos !== -1 && closeCurlyPos !== -1 && closeCurlyPos > openCurlyPos) {
      body = block.slice(openCurlyPos + 1, closeCurlyPos).trim();
    }
    result.push({ className: clsName, body });
  }

  return result;
}
