// src/client/parser/parseClassBlocksWithBraceCounting.ts

export function parseClassBlocksWithBraceCounting(text: string): Array<{
  className: string;
  body: string;
}> {
  const result: Array<{ className: string; body: string }> = [];
  // (NEW) ใช้ regex non-greedy เพื่อจับ .className { ... } อย่างง่าย
  const pattern = /\.([\w-]+)\s*\{[\s\S]*?\}/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const clsName = match[1];
    // เก็บเนื้อหาภายใน { ... } แบบง่าย (ไม่สน nested braces)
    const block = match[0]; // ตัวอย่าง ".foo { color: red; }"
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
