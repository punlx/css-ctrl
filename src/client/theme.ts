// เราจะประกาศตัวแปร global เพื่อเก็บชุด modes ล่าสุดที่เคยใช้
// (เป็นวิธีสั้น ๆ ที่ไม่ต้องใช้ version หรือ paletteId)
let oldModes: string[] = [];

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
 * เวอร์ชัน "วิธีสั้น ๆ" จะเช็คว่า modes ชุดใหม่ != modes เก่า
 * ถ้าต่างกัน (เช่น เปลี่ยนลำดับหรือเปลี่ยนจำนวน) จะลบ localStorage เก่าทิ้ง
 * เพื่อบังคับให้เริ่ม theme ใหม่
 */
function initialTheme(modes: string[]) {
  if (typeof window === 'undefined') {
    // SSR: ถ้าเป็นฝั่ง server ก็ไม่ต้องทำอะไร
    return modes[0];
  }

  // เช็คว่า modes ปัจจุบัน ต่างจาก oldModes เก่าที่เคยใช้ไหม
  // ถ้าต่างกัน => ลบค่า theme เก่าออก เพื่อ reset
  if (!arrayEquals(oldModes, modes)) {
    try {
      localStorage.removeItem('css-ctrl-theme');
    } catch {
      // localStorage inaccessible ก็ข้ามไปได้
    }
    // จำว่าตอนนี้เราใช้ modes นี้อยู่
    oldModes = [...modes];
  }

  let saved = '';
  let currentMode = '';
  try {
    // ถ้ามีค่าเก่าใน localStorage ก็เอาค่านั้น
    // ถ้าไม่มีใช้ค่าแรกใน modes
    saved = localStorage.getItem('css-ctrl-theme') || modes[0];
  } catch {
    // ใช้ default ถ้า localStorage ใช้ไม่ได้
    saved = modes[0];
  }

  // ถ้า saved ยังอยู่ใน modes ก็ใช้ตามนั้น
  // ถ้าไม่อยู่ ก็ fallback เป็นค่าแรกของ modes
  if (modes.includes(saved)) {
    setTheme(saved, modes);
    currentMode = saved;
  } else {
    currentMode = modes[0];
    setTheme(currentMode, modes);
  }

  return currentMode;
}

/**
 * ฟังก์ชันช่วยเทียบว่า array สองอันเท่ากันไหม (เทียบแบบ element ตรงตำแหน่ง)
 * เพื่อใช้เช็คว่ามีการเปลี่ยนแปลงลำดับ/จำนวนนัดไหม
 */
function arrayEquals(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Exports a 'theme' object providing methods to switch among themes,
 * manage breakpoints, typography, keyframes, etc.
 * ในตัวอย่างนี้เราจะสนใจเฉพาะ palette() เป็นหลัก
 */
export const theme = {
  palette(colors: string[][]) {
    const modes = colors[0];
    const initialMode = modes[0];
    if (typeof window !== 'undefined') {
      initialTheme(modes);
    }
    return {
      // ใช้สลับ theme manually
      switch: (mode: string) => setTheme(mode, modes),
      modes,
      // เอา theme ปัจจุบันออกมา (ถ้าบน server ก็คืนค่า default)
      getCurrentMode: () => {
        if (typeof window === 'undefined') return initialMode;
        return localStorage?.getItem('css-ctrl-theme') || initialMode;
      },
      // เผื่อใช้ init ซ้ำในฝั่ง client
      init: () => initialTheme(modes),
      defaultMode: initialMode,
    };
  },

  // ไว้สำหรับ css-ctrl compiler (ยังไม่เปิดใช้ในตัวอย่าง)
  breakpoint(breakpointList: Record<string, string>) {},
  typography(typoMap: Record<string, string>) {},
  keyframe(keyframeMap: Record<string, string>) {},
  variable(variableMap: Record<string, string>) {},
  property(styleMap: Record<string, Record<string, string>>) {},
  class(classMap: Record<string, string>) {},
};
