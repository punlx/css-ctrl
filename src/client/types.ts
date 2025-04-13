// src/client/types.ts

import { CssCtrlPlugin, UnionToIntersection } from '../plugin/types';

/************************************************************
 * 1) ชนิดข้อมูล Utility สำหรับเมธอด .set(...)
 ************************************************************/

/** แปลง T[K] (string[]) => { varKey?: string } */
export type PropsForGlobalClass<ClassArr extends string[]> = Partial<
  Record<ClassArr[number], string>
>;

export type CSSResult<T extends Record<string, string[]>> = {
  [K in keyof T]: string;
} & {
  // Overload #1
  get<K2 extends keyof T>(
    classKey: K2
  ): {
    set: (props: PropsForGlobalClass<T[K2]>) => void;
  };

  // Overload #2
  get<K2 extends keyof T, PL extends Array<CssCtrlPlugin<any>>>(
    classKey: K2,
    plugins: PL
  ): {
    set: (props: PropsForGlobalClass<T[K2]>) => void;
  } & UnionToIntersection<ReturnType<PL[number]>>;
};
