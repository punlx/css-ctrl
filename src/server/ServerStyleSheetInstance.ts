// src/server/ServerStyleSheetInstance.ts

import { _sheet } from './constant';
import { ServerStyleSheet } from './serverStyleSheet';

// เก็บ instance ของ ServerStyleSheet ไว้ในตัวแปรส่วนกลาง

/**
 * ดึง instance ปัจจุบันของ ServerStyleSheet
 * ถ้ายังไม่มี ก็สร้างใหม่
 */
export function serverStyleSheet(): ServerStyleSheet {
  if (!_sheet.serverStyleSheet) {
    _sheet.serverStyleSheet = new ServerStyleSheet();
  }
  return _sheet.serverStyleSheet;
}
