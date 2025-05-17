// src/client/utils/flushAll.ts

let rafScheduled = false;

/**
 * Represents the final action to apply to a particular CSS custom property in a single frame.
 * If multiple actions for the same property occur within one frame,
 * only the last action is recorded.
 */
type FinalAction = { type: 'set'; value: string } | { type: 'remove' };

/**
 * A record storing the latest intended action for each variable name in the current frame,
 * grouped by the specific target element that should receive the style.
 * Using a WeakMap for memory efficiency (avoid leaks) when elements are removed from DOM.
 */
const pendingFinalMap = new WeakMap<HTMLElement, Record<string, FinalAction>>();

/**
 * A set of elements that have pending actions in the current frame,
 * so we can iterate and apply them in flushAll().
 */
const pendingElements = new Set<HTMLElement>();

/**
 * Used to coordinate a promise that resolves after flushAll() is executed in a rAF callback.
 */
let flushPromise: Promise<void> | null = null;
let flushResolve: (() => void) | null = null;

/**
 * flushAll() applies all pending set/remove actions to each element's style
 * and clears the pending actions. It is intended to run inside a requestAnimationFrame
 * callback. After applying actions, it also resolves any pending promise from waitForNextFlush().
 */
export function flushAll() {
  // Apply actions for each element that has pending updates
  for (const el of pendingElements) {
    const record = pendingFinalMap.get(el);
    if (!record) {
      continue;
    }
    const varNames = Object.keys(record);
    for (const varName of varNames) {
      const action = record[varName];
      if (action.type === 'set') {
        el.style.setProperty(varName, action.value);
      } else {
        el.style.removeProperty(varName);
      }
    }
    // Remove the record so that next frame we don't re-apply the same
    pendingFinalMap.delete(el);
  }

  // Clear the set of elements for this frame
  pendingElements.clear();

  rafScheduled = false;

  // Resolve the waiting promise if it exists
  if (flushResolve) {
    flushResolve();
    flushResolve = null;
    flushPromise = null;
  }
}

/**
 * scheduleFlush() ensures flushAll() is executed in the next requestAnimationFrame call.
 * It sets a flag to avoid scheduling multiple callbacks in the same frame.
 */
export function scheduleFlush() {
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(flushAll);
  }
}

/**
 * pushSetAction() records that a CSS custom property should be set to the given value.
 * If there's already an action for the same variable on the same element, it will be overridden.
 * By default, if element is not provided, it uses document.documentElement as the target.
 */
export function pushSetAction(varName: string, value: string, element?: HTMLElement) {
  const targetEl = element ?? document.documentElement;
  let record = pendingFinalMap.get(targetEl);
  if (!record) {
    record = {};
    pendingFinalMap.set(targetEl, record);
  }
  record[varName] = { type: 'set', value };
  pendingElements.add(targetEl);
  scheduleFlush();
}

/**
 * pushRemoveAction() records that a CSS custom property should be removed.
 * If there's already an action for the same variable on the same element,
 * it will be overridden (removing always overrides setting).
 * By default, if element is not provided, it uses document.documentElement as the target.
 */
export function pushRemoveAction(varName: string, element?: HTMLElement) {
  const targetEl = element ?? document.documentElement;
  let record = pendingFinalMap.get(targetEl);
  if (!record) {
    record = {};
    pendingFinalMap.set(targetEl, record);
  }
  record[varName] = { type: 'remove' };
  pendingElements.add(targetEl);
  scheduleFlush();
}

/**
 * waitForNextFlush() returns a promise that resolves once the flushAll() has completed.
 * If there is no pending flush, it resolves immediately.
 */
export function waitForNextFlush(): Promise<void> {
  if (!rafScheduled) {
    return Promise.resolve();
  }

  if (!flushPromise) {
    flushPromise = new Promise<void>((resolve) => {
      flushResolve = resolve;
    });
  }
  return flushPromise;
}
