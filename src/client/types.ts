/************************************************************
 * 1) ชนิดข้อมูล Utility สำหรับเมธอด .set(...)
 ************************************************************/

/** แปลง T[K] (string[]) => { varKey?: string } */
export type PropsForGlobalClass<ClassArr extends string[]> = Partial<
  Record<ClassArr[number], string>
>;

/**
 * CSSResult<T>:
 *  - แต่ละ key (K) => string (เป็น className)
 *  - มี .get(K) => { set, reset, value }
 *  - มี .reset() => resetAll
 */
export type CSSResult<T extends Record<string, string[]>> = {
  [K in keyof T]: string;
} & {
  get<K2 extends keyof T>(
    classKey: K2
  ): {
    /**
     * .set({...}) => รับเป็น PropsForGlobalClass<T[K2]>
     */
    set: (props: PropsForGlobalClass<T[K2]>) => void;

    /**
     * .reset(keys) => ต้องส่ง array ของ T[K2][number] เสมอ
     */
    reset: (keys: Array<T[K2][number]>) => void;

    /**
     * .value(keys) => ต้องส่ง array ของ T[K2][number] เสมอ
     * คืน Promise ของ Record<key, { prop, value }>
     */
    value: (
      keys: Array<T[K2][number]>
    ) => Promise<Record<T[K2][number], { prop: string; value: string }>>;
  };

  /**
   * .reset() => Reset global ทั้งหมด
   */
  reset(): void;
};
