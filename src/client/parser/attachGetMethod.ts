// src/client/parser/attachGetMethod.ts

import { CSSResult, PropsForGlobalClass } from '../types';
import { buildVariableName } from '../utils/buildVariableName';
import { parseDisplayName } from '../utils/parseDisplayName';
import { parseVariableAbbr } from '../utils/parseVariableAbbr';
import { pushSetAction, pushRemoveAction, waitForNextFlush } from '../utils/flushAll';

/**
 * Attaches `.get(...)` to the provided `CSSResult<T>` object.
 * This method enables chaining of `.set(...)`, `.reset(...)`, and `.value(...)` actions
 * on the registered classes. It also attaches a `.reset()` method that resets all
 * associated variables globally.
 */
export function attachGetMethod<T extends Record<string, string[]>>(resultObj: CSSResult<T>): void {
  /**
   * Registry that tracks which variable names have been set for each classKey.
   * Example: registry["box"] = Set(["--bg-app_box", "--color-app_box", ...])
   */
  const registry: Record<string, Set<string>> = {};

  /**
   * Overloaded .get(...) function that returns an object containing
   * set(...), reset(...), and value(...) methods.
   */
  function get<K2 extends keyof T>(
    classKey: K2
  ): {
    set: (props: PropsForGlobalClass<T[K2]>) => void;
    reset: (keys?: Array<T[K2][number]>) => void;
    value: (
      keys: Array<T[K2][number]>
    ) => Promise<Record<T[K2][number], { prop: string; value: string }>>;
  };

  /**
   * Fallback function signature that does nothing if the provided key is invalid.
   */
  function get(arg1: string) {
    if (typeof arg1 === 'string') {
      const displayName = resultObj[arg1];
      if (!displayName) {
        return {
          set: () => {},
          reset: () => {},
          value: async () => ({}),
        };
      }

      // Parse the displayName to extract scope and class parts.
      const { scope, cls } = parseDisplayName(displayName);

      return {
        /**
         * set(props) updates the final variable names via pushSetAction.
         * Also stores them in the registry to allow subsequent resets.
         */
        set(props: PropsForGlobalClass<T[keyof T]>) {
          if (scope === 'none') {
            return;
          }

          const keys = Object.keys(props) as Array<keyof typeof props>;
          for (const abbr of keys) {
            let val = props[abbr];
            if (!val) continue;

            const { baseVarName, suffix } = parseVariableAbbr(abbr);
            const finalVarName = buildVariableName(baseVarName, scope, cls, suffix);

            // Replace any reference to `--var` with `var(--var)`
            if (val.includes('--')) {
              val = val.replace(/(--[\w-]+)/g, 'var($1)');
            }

            // Schedule a set action and override any previous action for the same var.
            pushSetAction(finalVarName, val);

            // Track the final variable name in the registry.
            if (!registry[arg1]) {
              registry[arg1] = new Set<string>();
            }
            registry[arg1].add(finalVarName);
          }
        },

        /**
         * reset(keys?) removes the specified properties if keys are provided.
         * If no keys are provided, remove all properties previously set for this classKey.
         */
        reset(keys?: Array<T[keyof T][number]>) {
          if (scope === 'none') {
            return;
          }
          if (!registry[arg1]) {
            return;
          }

          // If no keys are provided, remove all properties for this classKey.
          if (!keys) {
            for (const varName of registry[arg1]) {
              pushRemoveAction(varName);
            }
            registry[arg1].clear();
            return;
          }

          // Otherwise, remove only the specified keys.
          for (const abbr of keys) {
            const { baseVarName, suffix } = parseVariableAbbr(abbr);
            const finalVarName = buildVariableName(baseVarName, scope, cls, suffix);

            if (registry[arg1].has(finalVarName)) {
              pushRemoveAction(finalVarName);
              registry[arg1].delete(finalVarName);
            }
          }
        },

        /**
         * value(keys) returns the current value of the specified keys.
         * It waits for the next flush cycle to ensure any pending sets/resets
         * have been applied before returning the computed or inline values.
         */
        async value(keys: Array<T[keyof T][number]>) {
          if (scope === 'none') {
            return {};
          }

          // Ensure all queued set/remove actions have been flushed.
          await waitForNextFlush();

          const result: Record<
            T[keyof T][number],
            { prop: string; value: string }
          > = {} as any;

          for (const abbr of keys) {
            const { baseVarName, suffix } = parseVariableAbbr(abbr);
            const finalVarName = buildVariableName(baseVarName, scope, cls, suffix);

            // Check inline style first, then fallback to computed style.
            const computedVal =
              document.documentElement.style.getPropertyValue(finalVarName) ||
              getComputedStyle(document.documentElement).getPropertyValue(finalVarName);

            result[abbr] = {
              prop: finalVarName,
              value: computedVal,
            };
          }

          return result;
        },
      };
    }

    // Fallback no-op if the argument is not a string.
    return { set: () => {}, reset: () => {}, value: async () => ({}) };
  }

  /**
   * resetAll() removes all properties stored in the registry for every classKey.
   */
  function resetAll() {
    for (const classKey in registry) {
      const setOfVar = registry[classKey];
      for (const varName of setOfVar) {
        pushRemoveAction(varName);
      }
      setOfVar.clear();
    }
  }

  // Attach the get method and the global resetAll method to the result object.
  (resultObj as any).get = get;
  (resultObj as any).reset = resetAll;
}
