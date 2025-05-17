// src/client/parser/attachGetMethod.ts

import { CSSResult, PropsForGlobalClass } from '../types';
import { buildVariableName } from '../utils/buildVariableName';
import { parseDisplayName } from '../utils/parseDisplayName';
import { parseVariableAbbr } from '../utils/parseVariableAbbr';
import { pushSetAction, pushRemoveAction, waitForNextFlush } from '../utils/flushAll';

/**
 * Attaches .get(...) to the provided CSSResult<T> object.
 * This method enables chaining of .set(...), .reset(...), and .value(...) actions
 * on the registered classes. It also attaches a .reset() method that resets all
 * associated variables globally.
 */
export function attachGetMethod<T extends Record<string, string[]>>(resultObj: CSSResult<T>): void {
  /**
   * Registry that tracks which variable names have been set for each classKey.
   * Example: registry["box"] = Map<HTMLElement, Set(["--bg-app_box", "--color-app_box", ...])>
   */
  const registry: Record<string, Map<HTMLElement, Set<string>>> = {};

  /**
   * Overloaded .get(...) function that returns an object containing
   * set(...), reset(...), and value(...) methods.
   */
  function get<K2 extends keyof T>(
    classKey: K2
  ): {
    /**
     * Overload 1: set(props) -> set CSS vars on the root (documentElement)
     * Overload 2: set(element, props) -> set CSS vars on the specific HTMLElement
     */
    set(props: PropsForGlobalClass<T[K2]>): void;
    set(target: HTMLElement, props: PropsForGlobalClass<T[K2]>): void;

    /**
     * Overload 1: reset() -> remove all varNames for this classKey on root
     * Overload 2: reset(keys)
     * Overload 3: reset(element)
     * Overload 4: reset(element, keys)
     */
    reset(...args: [any, any?]): void;

    /**
     * Overload 1: value(keys) -> read from root
     * Overload 2: value(element, keys) -> read from the specified HTMLElement
     */
    value(
      keys: Array<T[K2][number]>
    ): Promise<Record<T[K2][number], { prop: string; value: string }>>;
    value(
      target: HTMLElement,
      keys: Array<T[K2][number]>
    ): Promise<Record<T[K2][number], { prop: string; value: string }>>;
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
         * set(...) updates the final variable names via pushSetAction.
         * Also stores them in the registry to allow subsequent resets.
         *
         * รองรับ overload:
         *   set(props)
         *   set(element, props)
         */
        set(...args: [any, any?]) {
          if (scope === 'none') {
            return;
          }

          let targetEl: HTMLElement;
          let props: PropsForGlobalClass<T[keyof T]>;

          if (args.length === 2 && args[0] instanceof HTMLElement) {
            targetEl = args[0];
            props = args[1];
          } else {
            targetEl = document.documentElement;
            props = args[0];
          }

          // Ensure registry for this classKey
          if (!registry[arg1]) {
            registry[arg1] = new Map<HTMLElement, Set<string>>();
          }
          const mapForClass = registry[arg1];

          const keys = Object.keys(props) as Array<keyof typeof props>;
          for (const abbr of keys) {
            let val = props[abbr];
            if (!val) continue;

            const { baseVarName, suffix } = parseVariableAbbr(abbr);
            const finalVarName = buildVariableName(baseVarName, scope, cls, suffix);

            // Replace any reference to --var with var(--var)
            if (val.includes('--')) {
              val = val.replace(/(--[\w-]+)/g, 'var($1)');
            }

            // Schedule a set action and override any previous action for the same var.
            pushSetAction(finalVarName, val, targetEl);

            // Track the final variable name in the registry under this element
            if (!mapForClass.has(targetEl)) {
              mapForClass.set(targetEl, new Set<string>());
            }
            mapForClass.get(targetEl)!.add(finalVarName);
          }
        },

        /**
         * reset(...args) removes varNames previously set for this classKey.
         * Overload:
         *   reset()
         *   reset(keys)
         *   reset(element)
         *   reset(element, keys)
         */
        reset(...args: [any, any?]) {
          if (scope === 'none') {
            return;
          }
          if (!registry[arg1]) {
            return;
          }

          let targetEl: HTMLElement;
          let keys: Array<T[keyof T][number]> | undefined;

          // Case: reset(element, keys)
          if (args.length === 2 && args[0] instanceof HTMLElement) {
            targetEl = args[0];
            keys = args[1];
          }
          // Case: reset(element)
          else if (args.length === 1 && args[0] instanceof HTMLElement) {
            targetEl = args[0];
            keys = undefined;
          }
          // Case: reset(keys?) or reset()
          else {
            targetEl = document.documentElement;
            keys = args[0];
          }

          const mapForClass = registry[arg1];
          if (!mapForClass.has(targetEl)) {
            return;
          }

          const setOfVar = mapForClass.get(targetEl)!;

          // If no keys are provided, remove all properties for this element
          if (!keys) {
            for (const varName of setOfVar) {
              pushRemoveAction(varName, targetEl);
            }
            setOfVar.clear();
            return;
          }

          // Otherwise, remove only the specified keys
          for (const abbr of keys) {
            const { baseVarName, suffix } = parseVariableAbbr(abbr);
            const finalVarName = buildVariableName(baseVarName, scope, cls, suffix);
            if (setOfVar.has(finalVarName)) {
              pushRemoveAction(finalVarName, targetEl);
              setOfVar.delete(finalVarName);
            }
          }
        },

        /**
         * value(...) returns the current value of the specified keys.
         * Overload:
         *   value(keys)
         *   value(element, keys)
         *
         * It waits for the next flush cycle to ensure any pending sets/resets
         * have been applied before returning the computed or inline values.
         */
        async value(...args: [any, any?]) {
          if (scope === 'none') {
            return {};
          }

          let targetEl: HTMLElement;
          let keys: Array<T[keyof T][number]>;

          if (args.length === 2 && args[0] instanceof HTMLElement) {
            targetEl = args[0];
            keys = args[1];
          } else {
            targetEl = document.documentElement;
            keys = args[0];
          }

          // Ensure all queued set/remove actions have been flushed.
          await waitForNextFlush();

          const result: Record<T[keyof T][number], { prop: string; value: string }> = {} as any;

          for (const abbr of keys) {
            const { baseVarName, suffix } = parseVariableAbbr(abbr);
            const finalVarName = buildVariableName(baseVarName, scope, cls, suffix);

            // Check inline style first, then fallback to computed style (from targetEl).
            const inlineVal = targetEl.style.getPropertyValue(finalVarName);
            const computedVal =
              inlineVal || getComputedStyle(targetEl).getPropertyValue(finalVarName);

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
   * resetAll() removes all properties stored in the registry for every classKey
   * and every element that was tracked.
   */
  function resetAll() {
    for (const classKey in registry) {
      const mapForClass = registry[classKey];
      for (const [el, setOfVar] of mapForClass.entries()) {
        for (const varName of setOfVar) {
          pushRemoveAction(varName, el);
        }
        setOfVar.clear();
      }
      mapForClass.clear();
    }
  }

  // Attach the get method and the global resetAll method to the result object.
  (resultObj as any).get = get;
  (resultObj as any).reset = resetAll;
}
