// src/client/transFormVariables.ts

import { IStyleDefinition } from '../shared/parseStyles.types';

/**
 * transformVariables:
 * - ถ้า scopeName==='none': ใช้รูป "--<varName>-<className>"
 * - ถ้า scopeName!='none': ปกติ => "--<varName>-<scopeName>_<className>"
 */
export function transFormVariables(
  styleDef: IStyleDefinition,
  scopeName: string,
  className: string
): void {
  // helper สร้าง prefix
  const scopePart = scopeName === 'none' ? className : `${scopeName}_${className}`;

  // -----------------------------
  // 1) Base variables (varBase)
  // -----------------------------
  if (styleDef.varBase) {
    for (const varName in styleDef.varBase) {
      const rawValue = styleDef.varBase[varName];

      // finalVarName => "--varName-scopePart"
      const finalVarName = `--${varName}-${scopePart}`;

      // ใส่ลง rootVars
      styleDef.rootVars = styleDef.rootVars || {};
      styleDef.rootVars[finalVarName] = rawValue;

      // replace var(--varName) => var(--varName-scopePart) ใน base
      for (const cssProp in styleDef.base) {
        styleDef.base[cssProp] = styleDef.base[cssProp].replace(
          `var(--${varName})`,
          `var(${finalVarName})`
        );
      }
    }
  }

  // -----------------------------
  // 2) State variables (varStates)
  // -----------------------------
  if (styleDef.varStates) {
    for (const stName in styleDef.varStates) {
      const varsOfThatState: Record<string, string> = styleDef.varStates[stName] || {};
      for (const varName in varsOfThatState) {
        const rawValue = varsOfThatState[varName];

        // "--varName-scopePart-stateName"
        const finalVarName = `--${varName}-${scopePart}-${stName}`;

        styleDef.rootVars = styleDef.rootVars || {};
        styleDef.rootVars[finalVarName] = rawValue;

        // replace var(--varName-state) => var(--varName-scopePart-state)
        const stateProps = styleDef.states[stName];
        if (stateProps) {
          for (const cssProp in stateProps) {
            stateProps[cssProp] = stateProps[cssProp].replace(
              `var(--${varName}-${stName})`,
              `var(${finalVarName})`
            );
          }
        }
      }
    }
  }

  // ------------------------------------------------------
  // 3) Pseudo variables
  // ------------------------------------------------------
  if (styleDef.varPseudos) {
    for (const pseudoName in styleDef.varPseudos) {
      const pseudoVars: Record<string, string> = styleDef.varPseudos[pseudoName] || {};
      for (const varName in pseudoVars) {
        const rawValue = pseudoVars[varName];
        // "--varName-scopePart-pseudoName"
        const finalVarName = `--${varName}-${scopePart}-${pseudoName}`;

        styleDef.rootVars = styleDef.rootVars || {};
        styleDef.rootVars[finalVarName] = rawValue;

        const pseudoProps = styleDef.pseudos[pseudoName];
        if (pseudoProps) {
          for (const cssProp in pseudoProps) {
            pseudoProps[cssProp] = pseudoProps[cssProp].replace(
              `var(--${varName}-${pseudoName})`,
              `var(${finalVarName})`
            );
          }
        }
      }
    }
  }
}
