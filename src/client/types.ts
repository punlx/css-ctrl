// src/client/types.ts

/**
 * Converts an array of string-based property keys to an object whose keys
 * are those properties, and values are string. All properties are optional.
 */
export type PropsForGlobalClass<ClassArr extends string[]> = Partial<
  Record<ClassArr[number], string>
>;

/**
 * CSSResult<T> is the return type of the css<T>() function.
 * For each key in T, there is a corresponding string value (the final class name).
 * Additionally, the result object has:
 *   - .get(K): an object with .set(), .reset(), .value()
 *   - .reset(): a function that resets *all* tracked custom properties globally
 */
export type CSSResult<T extends Record<string, string[]>> = {
  [K in keyof T]: string;
} & {
  get<K2 extends Exclude<keyof T, 'var'>>(
    classKey: K2
  ): {
    set: {
      (props: PropsForGlobalClass<T[K2]>): void;
      (element: HTMLElement, props: PropsForGlobalClass<T[K2]>): void;
    };
    reset: {
      (): void;
      (keys: Array<T[K2][number]>): void;
      (element: HTMLElement): void;
      (element: HTMLElement, keys: Array<T[K2][number]>): void;
    };
    value: {
      (keys: Array<T[K2][number]>): Promise<Record<T[K2][number], { prop: string; value: string }>>;
      (element: HTMLElement, keys: Array<T[K2][number]>): Promise<
        Record<T[K2][number], { prop: string; value: string }>
      >;
    };
  };

  /**
   * reset() removes all tracked custom properties for all classes on all elements
   */
  reset(): void;
} & /**
   * หาก T มีคีย์ "var" อยู่ ให้เพิ่ม property .var เข้ามา
   */ (T extends { var: string[] }
    ? {
        var: {
          /**
           * set()
           * Overload:
           *   set(props)
           *   set(element, props)
           */
          set: {
            (props: PropsForGlobalClass<T['var']>): void;
            (element: HTMLElement, props: PropsForGlobalClass<T['var']>): void;
          };

          /**
           * reset()
           * Overload:
           *   reset()
           *   reset(keys)
           *   reset(element)
           *   reset(element, keys)
           */
          reset: {
            (): void;
            (keys: Array<T['var'][number]>): void;
            (element: HTMLElement): void;
            (element: HTMLElement, keys: Array<T['var'][number]>): void;
          };

          /**
           * value()
           * Overload:
           *   value(keys)
           *   value(element, keys)
           */
          value: {
            (keys: Array<T['var'][number]>): Promise<
              Record<T['var'][number], { prop: string; value: string }>
            >;
            (element: HTMLElement, keys: Array<T['var'][number]>): Promise<
              Record<T['var'][number], { prop: string; value: string }>
            >;
          };
        };
      }
    : {});
