// src/client/utils/buildVariableName.ts

export function buildVariableName(
  baseVarName: string,
  scope: string,
  cls: string,
  suffix: string
): string {
  // (NEW) ถ้า scope=none => return '' (no-op)
  if (scope === 'none') {
    return '';
  }

  // ถ้าเป็น hash => 'hash_cls'
  // ถ้าเป็น custom => 'scope_cls'
  // สุดท้าย => `--${baseVarName}-${someString}${suffix ? '-'+suffix : ''}`

  let scopePart: string;
  if (scope === 'hash') {
    // scope=hash => `cls` เองคือ 'box_xxHH'
    // บางที extension gen "box_abc123", parse scope=hash, cls=box_abc123
    // => user design: let's assume => `--baseVarName-box_abc123-suffix`
    scopePart = cls; // no separate scope_ => because cls= 'box_AbCdE...'
  } else {
    // normal scope => scopeName + '_' + cls
    scopePart = scope + '_' + cls;
  }

  if (!suffix) {
    return `--${baseVarName}-${scopePart}`;
  }
  return `--${baseVarName}-${scopePart}-${suffix}`;
}
