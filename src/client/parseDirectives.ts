// src/client/parseDirectives.ts

import { IStyleDefinition } from '../shared/parseStyles.types';
import { createEmptyStyleDef } from '../shared/parseStyles/parseStylesUtils';
import { parseSingleAbbr } from '../shared/parseStyles/parseSingleAbbr';

/**
 * โครงสร้างเก็บ Directive ที่ parse ได้ (เช่น @scope, @bind)
 */
export interface IParsedDirective {
  name: string;
  value: string;
}

/**
 * โครงสร้างของ block class เช่น .box { ... }
 */
export interface IClassBlock {
  className: string;
  body: string;
}

/**
 * โครงสร้างเก็บข้อมูล @const
 * - name: ชื่อ const
 * - styleDef: partial IStyleDefinition (parse แล้ว แต่ยังไม่ transformVariables)
 */
export interface IConstBlock {
  name: string;
  styleDef: IStyleDefinition;
}

/**
 * ผลลัพธ์จาก parseDirectivesAndClasses:
 * - directives: รวม @scope, @bind (หรือ directive อื่น ๆ แบบบรรทัดเดียว ยกเว้น @use)
 * - classBlocks: เก็บ .className { ... } (ยังไม่ parse ภายใน)
 * - constBlocks: เก็บ @const name { ... } (parse เป็น partial styleDef แล้ว)
 */
export interface IParseResult {
  directives: IParsedDirective[];
  classBlocks: IClassBlock[];
  constBlocks: IConstBlock[];
}

/**
 * parseDirectivesAndClasses:
 * - ดึง @const <name> { ... } ออกมาก่อน (แล้ว parse บรรทัดข้างในเป็น partial styleDef)
 * - ดึง top-level directive (@scope, @bind) ยกเว้น @use, @query
 * - ดึง block .className { ... } (ภายในอาจมี @use หรือ @query ... แบบ nested brace)
 */
export function parseDirectives(text: string): IParseResult {
  const directives: IParsedDirective[] = [];
  const classBlocks: IClassBlock[] = [];
  const constBlocks: IConstBlock[] = [];

  let newText = text;

  // -------------------------------------------------
  // 1) หา & parse บล็อก @const ด้วย matchAll
  // -------------------------------------------------
  const constRegex = /^[ \t]*@const\s+([\w-]+)\s*\{([\s\S]*?)\}/gm;
  // ดึง match ทั้งหมดออกมาก่อน
  const allConstMatches = [...newText.matchAll(constRegex)];

  for (const match of allConstMatches) {
    const fullMatch = match[0]; // '...@const <name> {...}'
    const constName = match[1];
    const rawBlock = match[2];

    // ตรวจซ้ำชื่อ const
    if (constBlocks.find((c) => c.name === constName)) {
      throw new Error(`[SWD-ERR] Duplicate @const name "${constName}".`);
    }

    // ภายใน @const ไม่อนุญาต directive (@use, @const, @scope, @bind)
    if (/(@use|@const|@scope|@bind)/.test(rawBlock)) {
      throw new Error(
        `[SWD-ERR] Not allowed directive (@use/@const/@scope/@bind) inside @const "${constName}".`
      );
    }

    // parse บรรทัดภายใน @const -> partial styleDef
    const partialStyleDef = createEmptyStyleDef();
    const lines = rawBlock
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      parseSingleAbbr(line, partialStyleDef, true);
    }

    // เก็บลง constBlocks
    constBlocks.push({
      name: constName,
      styleDef: partialStyleDef,
    });

    // ค่อยลบ block นี้ออกจาก newText
    newText = newText.replace(fullMatch, '').trim();
  }

  // -------------------------------------------------
  // 2) หา directive Top-Level (@scope, @bind) ยกเว้น @use, @query
  // -------------------------------------------------
  const directiveRegex = /^[ \t]*@([\w-]+)\s+([^\r\n]+)/gm;
  let match: RegExpExecArray | null;
  directiveRegex.lastIndex = 0;

  while ((match = directiveRegex.exec(newText)) !== null) {
    const dirName = match[1];
    const dirValue = match[2].trim();

    // หากเป็น @use, @query ให้ข้าม
    if (dirName === 'use' || dirName === 'query') {
      continue;
    }

    directives.push({ name: dirName, value: dirValue });

    // ตัด directive ที่ match ออกไป
    newText = newText.replace(match[0], '').trim();

    // รีเซ็ต lastIndex = 0 ให้ regex เริ่มค้นใหม่จากต้น
    directiveRegex.lastIndex = 0;
  }

  // -------------------------------------------------
  // 3) parse block .className { ... } พร้อมรองรับ nested braces
  // -------------------------------------------------
  const blocks = parseClassBlocksWithBraceCounting(newText);
  for (const blk of blocks) {
    classBlocks.push(blk);
  }

  return { directives, classBlocks, constBlocks };
}

/**
 * parseClassBlocksWithBraceCounting:
 * - หา pattern ".className {" ด้วย regex
 * - จากนั้น “นับ” จำนวนปีกกา { } ไปเรื่อย ๆ จนกว่าจะเจอคู่ปิด
 * - slice substring ภายในนั้นมาเป็น body
 * - รองรับกรณีมี { } ซ้อน (เช่น @query {...})
 */
function parseClassBlocksWithBraceCounting(text: string): IClassBlock[] {
  const result: IClassBlock[] = [];

  // regex จับชื่อ class => .<className>{
  // แล้วใช้ brace counting เพื่อหา "}" ที่แท้จริง
  const pattern = /\.([\w-]+)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const className = match[1];
    // ตำแหน่งหลัง {
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
        // เจอจุดปิด block แล้ว
        break;
      }
    }
    // i คือ index ของ '}' สุดท้าย
    const body = text.slice(startIndex, i).trim();

    result.push({
      className,
      body,
    });
  }

  return result;
}
