// src/client/styledUtils/extractQueryBlocks.ts
interface IRawQueryBlock {
  selector: string;
  rawBody: string;
}
/**
 * regex จับ @query <selector> { ... } (ข้าม newline)
 */
const queryRegex = /@query\s+([^{]+)\s*\{([\s\S]*?)\}/g;
/**
 * extractQueryBlocks:
 * - ค้นหาและดึงบล็อก @query <selector> { ... } ออกมาจาก body ของ .class
 * - คืน array ของ "IRawQueryBlock" กับ text ส่วนที่เหลือ
 */
export function extractQueryBlocks(classBody: string): {
  queries: IRawQueryBlock[];
  newBody: string;
} {
  const queries: IRawQueryBlock[] = [];
  let newBody = classBody;
  let match: RegExpExecArray | null;
  while ((match = queryRegex.exec(classBody)) !== null) {
    const raw = match[0];
    const selector = match[1].trim();
    const rawQueryBlockBody = match[2].trim();
    // ตัด substring ที่ match ออกไปจาก newBody
    newBody = newBody.replace(raw, '').trim();
    queries.push({
      selector,
      rawBody: rawQueryBlockBody,
    });
  }
  if (queries.length === 0) {
  }
  return { queries, newBody };
}
