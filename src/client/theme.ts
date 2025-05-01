/**
 * Removes previous themes and applies the specified theme at the <html> level.
 * Also saves the current theme in localStorage if available.
 */
function setTheme(mode: string, modes: string[]) {
  if (typeof window !== 'undefined') {
    document.documentElement.classList.remove(...modes);
    document.documentElement.classList.add(mode);
    try {
      localStorage.setItem('css-ctrl-theme', mode);
    } catch {
      // Do nothing if localStorage is inaccessible
    }
  }
}

/**
 * Initializes the theme by reading from localStorage (if available)
 * or defaults to the first item in the modes array.
 */
const initialTheme = (modes: string[]) => {
  let saved = '';
  let currentMode = '';
  try {
    saved = localStorage.getItem('css-ctrl-theme') || modes[0];
  } catch {
    // Fallback to the default mode if localStorage is not accessible
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

/**
 * Exports a 'theme' object providing methods to switch among themes,
 * manage breakpoints, typography, keyframes, etc.
 * Only the 'palette()' method is demonstrated here. Other methods are placeholders.
 */
export const theme = {
  palette(colors: string[][]) {
    const modes = colors[0];
    const initialMode = modes[0];
    // Initialize the theme on the client side
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
      // For SSR
      init: () => initialTheme(modes),
    };
  },

  // Used for css-ctrl compiler.
  breakpoint(breakpointList: Record<string, string>) {},

  typography(typoMap: Record<string, string>) {},

  keyframe(keyframeMap: Record<string, string>) {},

  variable(variableMap: Record<string, string>) {},

  property(styleMap: Record<string, Record<string, string>>) {},

  class(classMap: Record<string, string>) {},
};
