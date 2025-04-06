// src/shared/buildCssText.ts
import { IStyleDefinition } from './parseStyles.types';

export function buildCssText(displayName: string, styleDef: IStyleDefinition): string {
  let cssText = '';

  // ----- rootVars -----
  if (styleDef.rootVars) {
    let varBlock = '';
    for (const varName in styleDef.rootVars) {
      varBlock += `${varName}:${styleDef.rootVars[varName]};`;
    }
    if (varBlock) {
      cssText += `:root{${varBlock}}`;
    }
  }

  // ----- base + local vars -----
  let baseProps = '';
  const localVars = (styleDef as any)._resolvedLocalVars as Record<string, string> | undefined;
  if (localVars) {
    for (const localVarName in localVars) {
      baseProps += `${localVarName}:${localVars[localVarName]};`;
    }
  }
  if (Object.keys(styleDef.base).length > 0) {
    for (const prop in styleDef.base) {
      baseProps += `${prop}:${styleDef.base[prop]};`;
    }
  }
  if (baseProps) {
    cssText += `.${displayName}{${baseProps}}`;
  }

  // ----- states -----
  for (const state in styleDef.states) {
    const obj = styleDef.states[state];
    let props = '';
    for (const p in obj) {
      props += `${p}:${obj[p]};`;
    }
    cssText += `.${displayName}:${state}{${props}}`;
  }

  // ----- screens -----
  for (const scr of styleDef.screens) {
    let props = '';
    for (const p in scr.props) {
      props += `${p}:${scr.props[p]};`;
    }
    cssText += `@media only screen and ${scr.query}{.${displayName}{${props}}}`;
  }

  // ----- containers -----
  for (const ctnr of styleDef.containers) {
    let props = '';
    for (const p in ctnr.props) {
      props += `${p}:${ctnr.props[p]};`;
    }
    cssText += `@container ${ctnr.query}{.${displayName}{${props}}}`;
  }

  // ----- pseudos (อัปเดตให้รองรับหลาย pseudo) -----
  if (styleDef.pseudos) {
    for (const pseudoKey in styleDef.pseudos) {
      const pseudoObj = styleDef.pseudos[pseudoKey];
      if (!pseudoObj) continue;

      // รวม property ใน pseudoObj
      let pseudoProps = '';
      for (const prop in pseudoObj) {
        pseudoProps += `${prop}:${pseudoObj[prop]};`;
      }

      // เลือก selector ที่สอดคล้อง
      const pseudoSelector = `::${pseudoKey}`;
      cssText += `.${displayName}${pseudoSelector}{${pseudoProps}}`;
    }
  }

  // ----- queries -----
  if (styleDef.queries && styleDef.queries.length > 0) {
    for (const q of styleDef.queries) {
      cssText += buildQueryCssText(displayName, q.selector, q.styleDef);
    }
  }

  return cssText;
}

// ฟังก์ชันย่อยสำหรับ @query blocks
function buildQueryCssText(
  parentDisplayName: string,
  selector: string,
  qDef: IStyleDefinition
): string {
  let out = '';

  // ----- base + local vars -----
  let baseProps = '';
  const localVars = (qDef as any)._resolvedLocalVars as Record<string, string> | undefined;
  if (localVars) {
    for (const localVarName in localVars) {
      baseProps += `${localVarName}:${localVars[localVarName]};`;
    }
  }
  if (Object.keys(qDef.base).length > 0) {
    for (const prop in qDef.base) {
      baseProps += `${prop}:${qDef.base[prop]};`;
    }
  }
  if (baseProps) {
    out += `.${parentDisplayName} ${selector}{${baseProps}}`;
  }

  // ----- states -----
  for (const state in qDef.states) {
    const obj = qDef.states[state];
    let props = '';
    for (const p in obj) {
      props += `${p}:${obj[p]};`;
    }
    out += `.${parentDisplayName} ${selector}:${state}{${props}}`;
  }

  // ----- screens -----
  for (const scr of qDef.screens) {
    let props = '';
    for (const p in scr.props) {
      props += `${p}:${scr.props[p]};`;
    }
    out += `@media only screen and ${scr.query}{.${parentDisplayName} ${selector}{${props}}}`;
  }

  // ----- containers -----
  for (const ctnr of qDef.containers) {
    let props = '';
    for (const p in ctnr.props) {
      props += `${p}:${ctnr.props[p]};`;
    }
    out += `@container ${ctnr.query}{.${parentDisplayName} ${selector}{${props}}}`;
  }

  // ----- pseudos (อัปเดตให้รองรับหลาย pseudo) -----
  if (qDef.pseudos) {
    for (const pseudoKey in qDef.pseudos) {
      const pseudoObj = qDef.pseudos[pseudoKey];
      if (!pseudoObj) continue;

      let pseudoProps = '';
      for (const p in pseudoObj) {
        pseudoProps += `${p}:${pseudoObj[p]};`;
      }

      // ใช้ map เดียวกัน หรือจะประกาศซ้ำก็ได้
      const pseudoSelector = `::${pseudoKey}`;
      out += `.${parentDisplayName} ${selector}${pseudoSelector}{${pseudoProps}}`;
    }
  }

  return out;
}
