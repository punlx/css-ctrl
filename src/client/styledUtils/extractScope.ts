// src/client/styledUtils/extractScope.ts

import { IParsedDirective } from '../parseDirectives';

export function extractScope(directives: IParsedDirective[]): string {
  let scopeName: string | null = null;

  for (const d of directives) {
    if (d.name === 'scope') {
      if (scopeName) {
        throw new Error(`[SWD-ERR] multiple @scope found in the same styled block.`);
      }
      scopeName = d.value;
    }
  }

  if (!scopeName) {
    throw new Error(`[SWD-ERR] You must provide "@scope <name>" in styled(...) template.`);
  }

  // ยอมรับ 'none' ได้
  // scopeName = 'none' หมายถึง ไม่ต้องมี prefix scope
  // หากต้องการบังคับเงื่อนไขเพิ่มเติมก็ทำได้ เช่น
  // if (!/^[\w-]+$/.test(scopeName) && scopeName !== 'none') {
  //   throw new Error(`[SWD-ERR] Invalid scopeName "${scopeName}".`);
  // }

  return scopeName;
}
