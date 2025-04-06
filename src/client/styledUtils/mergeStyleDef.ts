// src/client/styledUtils/mergeStyleDef.ts

import { IStyleDefinition } from '../../shared/parseStyles.types';

/**
 * mergeStyleDef(target, source):
 * - เอา source (partial styleDef) มารวมเข้า target
 * - property/state/pseudo ที่ซ้ำกัน => override ด้วย source
 */
export function mergeStyleDef(target: IStyleDefinition, source: IStyleDefinition) {
  // base
  for (const prop in source.base) {
    target.base[prop] = source.base[prop];
  }
  // states
  for (const st in source.states) {
    if (!target.states[st]) {
      target.states[st] = {};
    }
    for (const p in source.states[st]) {
      target.states[st][p] = source.states[st][p];
    }
  }
  // screens
  for (const s of source.screens) {
    // naive: push
    target.screens.push({ query: s.query, props: { ...s.props } });
  }
  // containers
  for (const c of source.containers) {
    target.containers.push({ query: c.query, props: { ...c.props } });
  }
  // pseudos
  for (const pName in source.pseudos) {
    if (!target.pseudos[pName]) {
      target.pseudos[pName] = {};
    }
    const fromPseudo = source.pseudos[pName]!;
    for (const prop in fromPseudo) {
      target.pseudos[pName]![prop] = fromPseudo[prop];
    }
  }

  // varBase
  if (source.varBase) {
    if (!target.varBase) {
      target.varBase = {};
    }
    for (const k in source.varBase) {
      target.varBase[k] = source.varBase[k];
    }
  }
  // varStates
  if (source.varStates) {
    if (!target.varStates) {
      target.varStates = {};
    }
    for (const stName in source.varStates) {
      if (!target.varStates[stName]) {
        target.varStates[stName] = {};
      }
      for (const k in source.varStates[stName]) {
        target.varStates[stName][k] = source.varStates[stName][k];
      }
    }
  }
  // varPseudos
  if (source.varPseudos) {
    if (!target.varPseudos) {
      target.varPseudos = {};
    }
    for (const pseudoKey in source.varPseudos) {
      if (!target.varPseudos[pseudoKey]) {
        target.varPseudos[pseudoKey] = {};
      }
      for (const k in source.varPseudos[pseudoKey]) {
        target.varPseudos[pseudoKey]![k] = source.varPseudos[pseudoKey][k];
      }
    }
  }

  // rootVars
  if (source.rootVars) {
    if (!target.rootVars) {
      target.rootVars = {};
    }
    for (const rv in source.rootVars) {
      target.rootVars[rv] = source.rootVars[rv];
    }
  }
}
