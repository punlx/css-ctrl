/**
 * เปลี่ยน theme (ในระดับ root <html>) โดยลบ class เก่าออกแล้วใส่ class ใหม่
 */
function setTheme(mode: string, modes: string[]) {
  if (typeof window !== 'undefined') {
    document.documentElement.classList.remove(...modes);
    document.documentElement.classList.add(mode);
    try {
      localStorage.setItem('css-ctrl-theme', mode);
    } catch {
      // do nothing
    }
  }
}

/**
 * สำหรับเรียกครั้งแรกตอน client mount (หรือ SSR) เพื่ออ่านค่าจาก localStorage ถ้ามี
 */
const initialTheme = (modes: string[]) => {
  let saved = '';
  let currentMode = '';
  try {
    saved = localStorage.getItem('css-ctrl-theme') || modes[0];
  } catch {
    // do nothing
  }

  if (saved && modes.indexOf(saved) !== -1) {
    setTheme(saved, modes);
    currentMode = saved;
  } else {
    currentMode = modes[0];
    setTheme(currentMode, modes);
  }

  return currentMode;
};

export const theme = {
  palette(colors: string[][]) {
    const modes = colors[0];
    const initialMode = modes[0];
    // สำหรับ client side
    if (typeof window !== 'undefined') {
      initialTheme(modes);
    }
    return {
      switch: (mode: string) => setTheme(mode, modes),
      modes,
      getCurrentMode: () => {
        if (typeof window === 'undefined') return initialMode;
        return localStorage?.getItem('css-ctrl-theme') || initialMode;
      },
      // สำหรับ SSR
      init: () => initialTheme(modes),
    };
  },

  breakpoint(breakpointList: Record<string, string>) {},

  typography(typoMap: Record<string, string>) {},

  keyframe(keyframeMap: Record<string, string>) {},

  variable(variableMap: Record<string, string>) {},

  property(styleMap: Record<string, Record<string, string>>) {},

  class(classMap: Record<string, string>) {},
};
