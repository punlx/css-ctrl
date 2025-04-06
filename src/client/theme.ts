/** ตั้ง theme mode (เช่น dark/light) */

const keyframeRuntimeDict: Record<string, Record<string, { set: (props: any) => void }>> = {};

function parseKeyframeAbbr(
  abbrBody: string,
  keyframeName: string,
  blockLabel: string
): {
  cssText: string;
  varMap: Record<string, string>;
  defaultVars: Record<string, string>;
} {
  const regex = /([\w\-\$]+)\[(.*?)\]/g;
  let match: RegExpExecArray | null;

  let cssText = '';
  const varMap: Record<string, string> = {};
  const defaultVars: Record<string, string> = {};

  while ((match = regex.exec(abbrBody)) !== null) {
    let styleAbbr = match[1];
    let propVal = match[2];

    if (propVal.includes('--')) {
      propVal = propVal.replace(/(--[\w-]+)/g, 'var($1)');
    }

    let isVar = false;
    if (styleAbbr.startsWith('$')) {
      isVar = true;
      styleAbbr = styleAbbr.slice(1);
    }

    if (isVar) {
      const finalVarName = `--${styleAbbr}-${keyframeName}-${blockLabel.replace('%', '')}`;
      cssText += `${styleAbbr}:var(${finalVarName});`;
      varMap[styleAbbr] = finalVarName;
      defaultVars[finalVarName] = propVal;
    } else {
      cssText += `${styleAbbr}:${propVal};`;
    }
  }

  return { cssText, varMap, defaultVars };
}

function parseKeyframeString(keyframeName: string, rawStr: string) {
  const regex = /(\b(?:\d+%|from|to))\(([^)]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(rawStr)) !== null) {
    const label = match[1];
    const abbrBody = match[2];

    const { cssText, varMap, defaultVars } = parseKeyframeAbbr(
      abbrBody.trim(),
      keyframeName,
      label
    );

    if (!keyframeRuntimeDict[keyframeName]) {
      keyframeRuntimeDict[keyframeName] = {};
    }
    if (!keyframeRuntimeDict[keyframeName][label]) {
      keyframeRuntimeDict[keyframeName][label] = {
        set: (props: Record<string, string>) => {
          for (const k in props) {
            if (!k.startsWith('$')) {
              console.error(`Only $var is allowed. got key="${k}"`);
              continue;
            }
            const shortAbbr = k.slice(1);
            const finalVarName = varMap[shortAbbr];
            if (!finalVarName) {
              console.warn(`No var for ${k} in block "${label}" of keyframe "${keyframeName}"`);
              continue;
            }
            document.documentElement.style.setProperty(finalVarName, props[k]);
          }
        },
      };
    }
  }
}

function setTheme(mode: string, modes: string[]) {
  if (typeof window !== 'undefined') {
    document.documentElement.classList.remove(...modes);
    document.documentElement.classList.add(mode);
    try {
      localStorage.setItem('styledwind-theme', mode);
    } catch {}
  }
}

export const theme = {
  palette(colors: string[][]) {
    const modes = colors[0];

    return {
      swtich: (mode: string) => setTheme(mode, modes),
      modes,
      getCurrentMode: () => localStorage.getItem('styledwind-theme'),
    };
  },

  breakpoint(breakpointList: Record<string, string>) {},

  typography(typoMap: Record<string, string>) {},

  keyframe(keyframeMap: Record<string, string>) {
    const resultObj: Record<string, Record<string, { set: (props: any) => void }>> = {};
    for (const keyName in keyframeMap) {
      const rawStr = keyframeMap[keyName];
      parseKeyframeString(keyName, rawStr);

      if (!keyframeRuntimeDict[keyName]) {
        keyframeRuntimeDict[keyName] = {};
      }
      resultObj[keyName] = keyframeRuntimeDict[keyName];
    }
    return resultObj;
  },

  variable(variableMap: Record<string, string>) {},

  define(styleMap: Record<string, Record<string, string>>) {},
};
