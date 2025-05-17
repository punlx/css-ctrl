import { theme } from '../src/client/theme';

describe('theme.palette', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    localStorage.clear();
  });

  test('initializes and switches theme', () => {
    const p = theme.palette([
      ['light', 'dark'],
    ]);
    // should initialize to first mode
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(p.defaultMode).toBe('light');

    // switch to dark
    p.switch('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('css-ctrl-theme')).toBe('dark');
  });

  test('getCurrentMode reflects storage', () => {
    localStorage.setItem('css-ctrl-theme', 'dark');
    const p = theme.palette([
      ['light', 'dark'],
    ]);
    expect(p.getCurrentMode()).toBe('dark');
  });

  test('init reads saved mode', () => {
    const p = theme.palette([
      ['light', 'dark'],
    ]);
    p.switch('dark');
    document.documentElement.className = '';
    expect(p.init()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  test('SSR fallback when window undefined', () => {
    const backup = global.window;
    // @ts-ignore
    delete global.window;
    const p = theme.palette([
      ['light', 'dark'],
    ]);
    expect(p.getCurrentMode()).toBe('light');
    expect(p.init()).toBe('light');
    global.window = backup;
  });
});
