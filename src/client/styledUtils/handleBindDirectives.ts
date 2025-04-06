// src/client/styledUtils/handleBindDirectives.ts

import { IParsedDirective } from "../parseDirectives";

/**
 * handleBindDirectives(scopeName, directives, resultObj):
 * - parse @bind
 */
export function handleBindDirectives(
  scopeName: string,
  directives: IParsedDirective[],
  resultObj: Record<string, string>
) {
  const localBindKeys = new Set<string>();

  for (const d of directives) {
    if (d.name === 'bind') {
      const tokens = d.value.trim().split(/\s+/);
      if (tokens.length < 2) {
        throw new Error(`[SWD-ERR] Invalid @bind syntax: "${d.value}"`);
      }
      const bindKey = tokens[0];
      const classRefs = tokens.slice(1);

      if (localBindKeys.has(bindKey)) {
        throw new Error(`[SWD-ERR] @bind key "${bindKey}" is already used in this file.`);
      }
      localBindKeys.add(bindKey);

      if (Object.prototype.hasOwnProperty.call(resultObj, bindKey)) {
        throw new Error(
          `[SWD-ERR] @bind key "${bindKey}" conflicts with existing property in styled (scope="${scopeName}").`
        );
      }

      const finalClassList: string[] = [];
      for (const ref of classRefs) {
        if (!ref.startsWith('.')) {
          throw new Error(`[SWD-ERR] @bind usage must reference classes with a dot, got "${ref}"`);
        }
        const refName = ref.slice(1);
        if (!resultObj[refName]) {
          throw new Error(
            `[SWD-ERR] @bind referencing ".${refName}" but that class is not defined.`
          );
        }
        finalClassList.push(resultObj[refName]);
      }

      const joined = finalClassList.join(' ');
      resultObj[bindKey] = joined;
    }
  }
}
