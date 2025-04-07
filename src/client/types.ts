/************************************************************
 * 1) ชนิดข้อมูล Utility สำหรับเมธอด .set(...)
 ************************************************************/

/** แยกเฉพาะ $xxx */
export type ExtractGlobalKeys<A extends string> = A extends `$${string}` ? A : never;

/** แยก $xxx หรือ &xxx */
export type ExtractLocalAndGlobalKeys<A extends string> = A extends `$${string}` | `&${string}`
  ? A
  : never;

/** แปลง T[K] (string[]) => { '$bg'?: string } (เฉพาะ $xxx) */
export type PropsForGlobalClass<ClassArr extends string[]> = Partial<
  Record<ExtractGlobalKeys<ClassArr[number]>, string>
>;

/** แปลง T[K] (string[]) => { '$bg'?: string, '&color'?: string } (ทั้ง $ และ &) */
export type PropsForLocalAndGlobalClass<ClassArr extends string[]> = Partial<
  Record<ExtractLocalAndGlobalKeys<ClassArr[number]>, string>
>;

/** กรณี .get(HTMLElement) => union ของคีย์ทั้งหมดใน T */
export type AllKeysOf<T extends Record<string, string[]>> = T[keyof T][number];
export type PropsForAllLocalAndGlobal<T extends Record<string, string[]>> = Partial<
  Record<ExtractLocalAndGlobalKeys<AllKeysOf<T>>, string>
>;
export type CSSResult<T extends Record<string, string[]>> = {
  [K in keyof T]: string;
} & {
  // Overload 1: .get("classKey") => set เฉพาะ $xxx จาก T[classKey]
  get<K2 extends keyof T>(
    classKey: K2
  ): {
    set: (props: PropsForGlobalClass<T[K2]>) => void;
  };

  // Overload 2: .get(HTMLElement) => set() ได้ $xxx และ &xxx (union ของทุกคลาส)
  get(el: HTMLElement): {
    set: (props: PropsForAllLocalAndGlobal<T>) => void;
  };

  // Overload 3: .get("classKey", HTMLElement) => set() ได้ $xxx และ &xxx เฉพาะ T[classKey]
  get<K2 extends keyof T>(
    classKey: K2,
    el: HTMLElement
  ): {
    set: (props: PropsForLocalAndGlobalClass<T[K2]>) => void;
  };
};
