// src/client/types.ts

/**
 * Converts an array of string-based property keys to an object whose keys
 * are those properties, and values are string. All properties are optional.
 */
export type PropsForGlobalClass<ClassArr extends string[]> = Partial<
  Record<ClassArr[number], string>
>;

/**
 * CSSResult<T> is the return type of the `css<T>()` function.
 * For each key in T, there is a corresponding string value (the final class name).
 * Additionally, the result object has:
 *   - .get(K): an object with .set(), .reset(), .value()
 *   - .reset(): a function that resets *all* tracked custom properties globally
 */
export type CSSResult<T extends Record<string, string[]>> = {
  [K in keyof T]: string;
} & {
  get<K2 extends keyof T>(
    classKey: K2
  ): {
    // Overload for set
    set: {
      (props: PropsForGlobalClass<T[K2]>): void;
      (element: HTMLElement, props: PropsForGlobalClass<T[K2]>): void;
    };

    // Overload for reset
    reset: {
      (): void;
      (keys: Array<T[K2][number]>): void;
      (element: HTMLElement): void;
      (element: HTMLElement, keys: Array<T[K2][number]>): void;
    };

    // Overload for value
    value: {
      (keys: Array<T[K2][number]>): Promise<Record<T[K2][number], { prop: string; value: string }>>;
      (element: HTMLElement, keys: Array<T[K2][number]>): Promise<
        Record<T[K2][number], { prop: string; value: string }>
      >;
    };
  };

  reset(): void;
};
