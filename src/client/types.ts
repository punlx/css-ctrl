// src/client/types.ts

/************************************************************
 * 1) ชนิดข้อมูล Utility สำหรับเมธอด .set(...)
 ************************************************************/

/** แปลง T[K] (string[]) => { varKey?: string } */
export type PropsForGlobalClass<ClassArr extends string[]> = Partial<
  Record<ClassArr[number], string>
>;

/** กรณี .get( "classKey" ) => set() ได้ key เป็น string[] ของ classKey */
export type CSSResult<T extends Record<string, string[]>> = {
  [K in keyof T]: string;
} & {
  // (NEW) Overload เดียว:
  // ให้ .get("classKey") => set(props: PropsForGlobalClass<T[classKey]>)
  get<K2 extends keyof T>(
    classKey: K2
  ): {
    set: (props: PropsForGlobalClass<T[K2]>) => void;
  };
};
