// src/client/parser/attachVarMethod.ts

import { CSSResult, PropsForGlobalClass } from '../types';
import { pushSetAction, pushRemoveAction, waitForNextFlush } from '../utils/flushAll';

/**
 * attachVarMethod() ติดตั้ง .var.set(...), .var.reset(...), .var.value(...) ลงใน resultObj
 *  - ใช้ registry จดจำ varName ที่เคย set เพื่อนำไป reset เฉพาะตัว หรือทั้งหมดได้
 *  - ใช้ pushSetAction(), pushRemoveAction() แบบเดียวกับ .get() เพื่อทำงานใน rAF ถัดไป
 *  - scopeName จะนำไป build เป็น --varName-scopeName ถ้า scopeName !== 'none'
 */
export function attachVarMethod<VarKeys extends string[]>(
  resultObj: CSSResult<any>,
  scopeName: string,
  varKeys: VarKeys
): void {
  /**
   * Registry เก็บว่า element ไหน เคยถูก set custom property อะไรบ้าง
   * Map<HTMLElement, Set<string>> => เก็บเป็น varName เต็ม ๆ เช่น "--color-app"
   */
  const registry = new Map<HTMLElement, Set<string>>();

  /**
   * ฟังก์ชันช่วยสร้างชื่อ var แบบมี scope เช่น:
   *   scopeName = "app"
   *   varName = "color"
   * ได้เป็น "--color-app"
   */
  function buildVarName(varName: string): string {
    if (scopeName === 'none') {
      return `--${varName}`;
    }
    return `--${varName}-${scopeName}`;
  }

  /**
   * set(...)
   * Overload: set(props) | set(element, props)
   */
  function setVar(...args: [any, any?]) {
    let targetEl: HTMLElement;
    let props: PropsForGlobalClass<VarKeys>;

    if (args.length === 2 && args[0] instanceof HTMLElement) {
      targetEl = args[0];
      props = args[1];
    } else {
      targetEl = document.documentElement;
      props = args[0];
    }

    const keys = Object.keys(props) as Array<keyof typeof props>;
    for (const k of keys) {
      const val = props[k];
      if (!val) continue;

      const varName = buildVarName(k as string);

      // Replace any reference to --xxx with var(--xxx)
      let finalVal = val;
      if (finalVal.includes('--')) {
        finalVal = finalVal.replace(/(--[\w-]+)/g, 'var($1)');
      }

      pushSetAction(varName, finalVal, targetEl);

      // บันทึกลง registry
      if (!registry.has(targetEl)) {
        registry.set(targetEl, new Set());
      }
      registry.get(targetEl)!.add(varName);
    }
  }

  /**
   * reset(...)
   * Overload:
   *   reset()
   *   reset(keys)
   *   reset(element)
   *   reset(element, keys)
   */
  function resetVar(...args: [any, any?]) {
    if (registry.size === 0) {
      return;
    }

    let targetEl: HTMLElement;
    let keys: Array<VarKeys[number]> | undefined;

    // case reset(element, keys)
    if (args.length === 2 && args[0] instanceof HTMLElement) {
      targetEl = args[0];
      keys = args[1];
    }
    // case reset(element)
    else if (args.length === 1 && args[0] instanceof HTMLElement) {
      targetEl = args[0];
      keys = undefined;
    }
    // case reset(keys) or reset()
    else {
      targetEl = document.documentElement;
      keys = args[0];
    }

    if (!registry.has(targetEl)) {
      return;
    }
    const setOfVar = registry.get(targetEl)!;

    // ถ้าไม่ส่ง keys => remove ทั้งหมด
    if (!keys) {
      for (const varName of setOfVar) {
        pushRemoveAction(varName, targetEl);
      }
      setOfVar.clear();
      return;
    }

    // remove เฉพาะ key ที่ส่งมา
    for (const k of keys) {
      const varName = buildVarName(k);
      if (setOfVar.has(varName)) {
        pushRemoveAction(varName, targetEl);
        setOfVar.delete(varName);
      }
    }
  }

  /**
   * value(...)
   * Overload:
   *   value(keys)
   *   value(element, keys)
   * ต้องรอ flushAll() ก่อน ถึงจะได้ค่าล่าสุด
   */
  async function valueVar(...args: [any, any?]) {
    if (registry.size === 0 && !args[0]) {
      return {};
    }

    let targetEl: HTMLElement;
    let keys: Array<VarKeys[number]>;

    if (args.length === 2 && args[0] instanceof HTMLElement) {
      targetEl = args[0];
      keys = args[1];
    } else {
      targetEl = document.documentElement;
      keys = args[0];
    }

    // ensure flush
    await waitForNextFlush();

    const result: Record<VarKeys[number], { prop: string; value: string }> = {} as any;

    for (const k of keys) {
      const varName = buildVarName(k);
      const inlineVal = targetEl.style.getPropertyValue(varName);
      const computedVal = inlineVal || getComputedStyle(targetEl).getPropertyValue(varName);
      result[k] = {
        prop: varName,
        value: computedVal,
      };
    }

    return result;
  }

  (resultObj as any).var = {
    set: setVar,
    reset: resetVar,
    value: valueVar,
  };
}
