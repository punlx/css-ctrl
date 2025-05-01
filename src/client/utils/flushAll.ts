// src/client/utils/flushAll.ts

let rafScheduled = false;

/**
 * Represents the final action to apply to a particular CSS custom property in a single frame.
 * If multiple actions for the same property occur within one frame,
 * only the last action is recorded.
 */
type FinalAction =
  | { type: 'set'; value: string }
  | { type: 'remove' };

/**
 * A record storing the latest intended action for each variable name in the current frame.
 * This ensures that repeated set/remove actions override previous actions
 * for the same variable within one animation frame.
 */
export const pendingGlobalFinal: Record<string, FinalAction> = {};

/**
 * Used to coordinate a promise that resolves after flushAll() is executed in a rAF callback.
 */
let flushPromise: Promise<void> | null = null;
let flushResolve: (() => void) | null = null;

/**
 * flushAll() applies all pending set/remove actions to the documentElement's style
 * and clears the pending actions. It is intended to run inside a requestAnimationFrame
 * callback. After applying actions, it also resolves any pending promise from waitForNextFlush().
 */
export function flushAll() {
  const varNames = Object.keys(pendingGlobalFinal);
  for (const varName of varNames) {
    const action = pendingGlobalFinal[varName];
    if (action.type === 'set') {
      document.documentElement.style.setProperty(varName, action.value);
    } else {
      document.documentElement.style.removeProperty(varName);
    }
  }

  // Clear pending actions
  for (const v of varNames) {
    delete pendingGlobalFinal[v];
  }

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
 * If there's already an action for the same variable, it will be overridden.
 */
export function pushSetAction(varName: string, value: string) {
  pendingGlobalFinal[varName] = { type: 'set', value };
  scheduleFlush();
}

/**
 * pushRemoveAction() records that a CSS custom property should be removed.
 * If there's already an action for the same variable, it will be overridden.
 */
export function pushRemoveAction(varName: string) {
  pendingGlobalFinal[varName] = { type: 'remove' };
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
