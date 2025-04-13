// src/plugin/types.ts

/**
 * CssCtrlPlugin - รูปแบบของ plugin ที่ใช้ในระบบ CSS-CTRL (runtime)
 *
 * Plugin คือฟังก์ชันที่รับ 'storage' (object)
 * แล้วคืนออบเจ็กต์ที่มี methods สำหรับใช้งาน (เช่น { select(...), ... }).
 */
export type CssCtrlPlugin<PluginMethods extends object> = (
  storage: Record<string, unknown>,
  classKey: string
) => PluginMethods;
// src/client/utils/unionToIntersection.ts

/**
 * แปลง Union เป็น Intersection
 * เช่น (A|B|C) => A & B & C
 */
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;
