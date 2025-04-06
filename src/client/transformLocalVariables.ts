// src/client/transformLocalVariables.ts
import { IStyleDefinition } from '../shared/parseStyles.types';

/**
 * transformLocalVariables:
 * - สร้าง "--&xxx-scope_class" => value จาก localVars
 * - replace "LOCALVAR(xxx)" => "var(--&xxx-scope_class)"
 * - เก็บ property ลงใน styleDef._resolvedLocalVars
 */
export function transformLocalVariables(
  styleDef: IStyleDefinition,
  scopeName: string,
  className: string
): void {
  if (!styleDef.localVars) {
    return;
  }

  // ถ้า scopeName==='none' => ใช้ className เฉย ๆ, ไม่ใส่ 'none_'
  const scopePart = scopeName === 'none' ? className : `${scopeName}_${className}`;

  // สร้าง map property
  const localVarProps: Record<string, string> = {};

  for (const varName in styleDef.localVars) {
    const rawVal = styleDef.localVars[varName];
    // ตัวแปรสุดท้าย => `--${varName}-${scopePart}`
    const finalVarName = `--${varName}-${scopePart}`;
    localVarProps[finalVarName] = rawVal;
  }

  // REGEX ไว้ replace LOCALVAR(xxx) => var(--xxx-scopePart)
  const placeholderRegex = /LOCALVAR\(([\w-]+)\)/g;
  const replacer = (match: string, p1: string): string => {
    const finalVarName = `--${p1}-${scopePart}`;
    return `var(${finalVarName})`;
  };

  // replace ใน base
  for (const prop in styleDef.base) {
    styleDef.base[prop] = styleDef.base[prop].replace(placeholderRegex, replacer);
  }

  // states
  for (const stName in styleDef.states) {
    for (const prop in styleDef.states[stName]) {
      styleDef.states[stName][prop] = styleDef.states[stName][prop].replace(
        placeholderRegex,
        replacer
      );
    }
  }

  // pseudos
  for (const pseudoName in styleDef.pseudos) {
    const obj = styleDef.pseudos[pseudoName];
    if (!obj) continue;
    for (const prop in obj) {
      obj[prop] = obj[prop].replace(placeholderRegex, replacer);
    }
  }

  // screens
  for (const scr of styleDef.screens) {
    for (const prop in scr.props) {
      scr.props[prop] = scr.props[prop].replace(placeholderRegex, replacer);
    }
  }

  // containers
  for (const ctnr of styleDef.containers) {
    for (const prop in ctnr.props) {
      ctnr.props[prop] = ctnr.props[prop].replace(placeholderRegex, replacer);
    }
  }

  // เก็บ mapping localVar => finalVarName ไว้ใน styleDef._resolvedLocalVars
  (styleDef as any)._resolvedLocalVars = localVarProps;
}
