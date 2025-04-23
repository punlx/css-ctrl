// snackbar.ts
import { createRoot, Root } from 'react-dom/client';

// ตำแหน่งต่าง ๆ
export type SnackbarPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'right-center'
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left'
  | 'left-center';

export type SnackbarStackBehavior = 'stack' | 'replace';

/** ประกาศ interface สำหรับ events โดยเพิ่ม target ที่เป็น Element */
export interface SnackbarEvents {
  /**
   * เรียกก่อนจะสร้าง DOM/render content ของ snackbar
   * ไม่ส่งค่าใดๆ กลับ
   */
  willShow?: () => void;

  /**
   * เรียกหลังสร้าง DOM เสร็จ ยังไม่จบการ fade-in
   * คืน { itemId, target } ของ item ที่เพิ่ง show
   */
  show?: (info: { itemId: string; target: HTMLElement }) => void;

  /**
   * เรียกหลังแสดงเสร็จ (หรือหลัง reposition)
   * คืน { itemId, target } ของ item ที่เพิ่ง didshow
   */
  didShow?: (info: { itemId: string; target: HTMLElement }) => void;

  /**
   * เรียกก่อนจะเริ่ม fade-out (ไม่ว่าจะ auto-close หรือ manual)
   * คืน { itemId, target } ของ item ที่กำลังจะปิด
   */
  willClose?: (info: { itemId: string; target: HTMLElement }) => void;

  /**
   * เรียกหลังการ remove DOM เสร็จ (จบ animation fade-out แล้ว)
   * คืน { itemId, target } ของ item ที่เพิ่งปิด
   */
  closed?: (info: { itemId: string; target: HTMLElement }) => void;

  /**
   * เรียกเพิ่มเติมหลัง closed อีกที ถ้าต้องการทำงานซ้ำอีกหน่อย
   * คืน { itemId, target } ของ item ที่เพิ่งปิด
   */
  didClosed?: (info: { itemId: string; target: HTMLElement }) => void;

  /**
   * เรียกเมื่อ stack มีการเปลี่ยนแปลง (เพิ่ม/ลบ item)
   * คืน { itemIds, targets } ของรายการ item ปัจจุบันใน stack
   */
  stackChanged?: (info: { itemIds: string[]; targets: HTMLElement[] }) => void;
}

export interface SnackbarPluginOptions {
  controls: string;
  type: 'status' | 'alert';
  heading?: string;
  spacing?: number;
  describe?: string;
  position: SnackbarPosition;
  stackBehavior?: SnackbarStackBehavior;
  maxStack?: number;
  close?: 'close-action' | 'auto-close';
  autoCloseDuration?: number; // ms
  animationDuration?: number; // fade in/out (ms)
  offsetX?: number;
  offsetY?: number;
}

/** ข้อมูลภายในของแต่ละ snackbar */
interface SnackbarItem {
  id: string;
  containerEl: HTMLDivElement;
  root: Root;
  timer?: number | null;
}

interface SnackbarState {
  containerOverlayEl?: HTMLDivElement | null;
  items: SnackbarItem[];
}

/** คลาสสำหรับ fade in/out */
const FADE_IN_CLASS = 'snackbarPluginFadeInClass';
const FADE_OUT_CLASS = 'snackbarPluginFadeOutClass';

/**
 * snackbar(options) => { actions: { show, closeAll }, events, aria: {...} }
 *   - ใช้ "absolute positioning" คล้าย antd
 *   - มีการแยก logic top-based vs bottom-based
 *     เพื่อให้ position = bottom-* วางตัวใหม่ที่ bottom=0, ตัวเก่าเลื่อนขึ้น
 */
export function snackbar(options: SnackbarPluginOptions) {
  const {
    position,
    stackBehavior = 'stack',
    maxStack = 5,
    close = 'auto-close',
    autoCloseDuration = 4000,
    animationDuration = 300,
    offsetX,
    offsetY,
    controls,
    describe,
    heading,
    type,
    spacing = 0,
  } = options;

  // ตั้งค่า duration ใน CSS variable
  document.documentElement.style.setProperty(
    '--snackbarPluginFadeDuration',
    `${animationDuration}ms`
  );
  validateOffset(position, offsetX, offsetY);

  /**
   * เก็บ state ภายใน + Events
   */
  const storage: SnackbarState & { _events: SnackbarEvents } = {
    containerOverlayEl: null,
    items: [],
    _events: {},
  };

  // สร้าง/หา container overlay
  function getOverlayContainer(): HTMLDivElement {
    if (storage.containerOverlayEl) {
      return storage.containerOverlayEl;
    }
    const className = getOverlayClassName(position);
    let overlay = document.querySelector<HTMLDivElement>(`.${className}`);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.classList.add(className);

      // fixed
      // จัดตำแหน่งตาม offset/position
      applyOverlayPosition(overlay, position, offsetX, offsetY);

      // กำหนดค่าเพื่อให้ child เป็น absolute
      document.body.appendChild(overlay);
    }
    storage.containerOverlayEl = overlay;
    return overlay;
  }

  /**
   * repositionSnackbars:
   *  - ถ้า top-based => newest on top(0), older down
   *  - ถ้า bottom-based => newest on bottom(0), older up
   */
  function repositionSnackbars() {
    if (!storage.containerOverlayEl) return;

    const isBottom =
      position === 'bottom-left' || position === 'bottom-center' || position === 'bottom-right';

    if (isBottom) {
      // ถ้า bottom => item[0] อยู่ล่างสุด (bottom=0), item[1] ถัดขึ้นไป
      let currentOffset = 0;
      for (let i = 0; i < storage.items.length; i++) {
        const item = storage.items[i];
        const el = item.containerEl;
        const itemHeight = el.offsetHeight || 0;

        el.style.position = 'absolute';
        el.style.left = '';
        el.style.right = '';
        el.style.top = '';
        el.style.bottom = '';

        if (position === 'bottom-left') {
          el.style.left = '0';
        } else if (position === 'bottom-right') {
          el.style.right = '0';
        }

        el.style.bottom = `${currentOffset}px`;
        currentOffset += itemHeight + spacing;
      }
    } else {
      // top-based (รวมถึง right-center, left-center => ให้ stack จากบนลงล่าง)
      let currentOffset = 0;
      for (let i = 0; i < storage.items.length; i++) {
        const item = storage.items[i];
        const el = item.containerEl;
        const itemHeight = el.offsetHeight || 0;

        el.style.position = 'absolute';
        el.style.left = '';
        el.style.right = '';
        el.style.top = '';
        el.style.bottom = '';

        if (position === 'top-left' || position === 'left-center') {
          el.style.left = '0';
        } else if (position === 'top-right' || position === 'right-center') {
          el.style.right = '0';
        }

        el.style.top = `${currentOffset}px`;
        currentOffset += itemHeight + spacing;
      }
    }
  }

  function show(content: any) {
    // เรียก event: willShow (ไม่ส่งค่าใด ๆ)
    storage._events.willShow?.();

    const overlay = getOverlayContainer();

    if (stackBehavior === 'replace') {
      for (const item of storage.items) {
        removeItemNow(item, false);
      }
      storage.items = [];
    }

    // aria-expanded="true"
    const triggers = document.querySelectorAll(`[aria-controls="${controls}"]`);
    triggers.forEach((triggerEl) => {
      triggerEl.setAttribute('aria-expanded', 'true');
    });

    const itemDiv = document.createElement('div');
    itemDiv.classList.add('snackbarPluginContainer');
    itemDiv.classList.add(FADE_IN_CLASS);

    if (heading) itemDiv.setAttribute('aria-labelledby', `${controls}-${heading}`);
    if (describe) itemDiv.setAttribute('aria-describedby', `${controls}-${describe}`);
    itemDiv.setAttribute('aria-atomic', 'true');
    if (type === 'alert') {
      itemDiv.role = 'alert';
    } else if (type === 'status') {
      itemDiv.role = 'status';
      itemDiv.ariaLive = 'polite';
    }

    // appendChild => newest => index=0
    overlay.appendChild(itemDiv);

    const root = createRoot(itemDiv);
    root.render(content);

    const newItem: SnackbarItem = {
      id: createUid(),
      containerEl: itemDiv,
      root,
      timer: undefined,
    };

    storage.items.unshift(newItem);

    // ถ้า stack เต็ม -> pop อันท้ายสุด
    if (storage.items.length > maxStack) {
      const removedItem = storage.items.pop();
      if (removedItem) {
        removeItemWithFadeOut(removedItem);
      }
    }

    // event: show => ส่ง { itemId, target }
    storage._events.show?.({ itemId: newItem.id, target: itemDiv });

    // รอ 1 frame => วัด size => reposition
    requestAnimationFrame(() => {
      repositionSnackbars();

      // event: didshow => ส่ง { itemId, target }
      storage._events.didShow?.({ itemId: newItem.id, target: itemDiv });
    });

    // เมื่อ stack เปลี่ยน => เรียก stackChanged({ itemIds, targets })
    storage._events.stackChanged?.({
      itemIds: storage.items.map((it) => it.id),
      targets: storage.items.map((it) => it.containerEl),
    });

    if (close === 'auto-close') {
      newItem.timer = window.setTimeout(() => {
        removeItemWithFadeOut(newItem);
      }, autoCloseDuration);
    }
  }

  function closeAll() {
    const triggers = document.querySelectorAll(`[aria-controls="${controls}"]`);
    triggers.forEach((triggerEl) => {
      triggerEl.setAttribute('aria-expanded', 'false');
    });
    for (const item of storage.items) {
      if (item.timer) {
        clearTimeout(item.timer);
      }
      removeItemWithFadeOut(item);
    }
    storage.items = [];
  }

  function removeItemWithFadeOut(item: SnackbarItem) {
    // event: willClose => ส่ง { itemId, target }
    storage._events.willClose?.({ itemId: item.id, target: item.containerEl });

    if (!item.containerEl.parentNode) {
      return;
    }
    item.containerEl.classList.remove(FADE_IN_CLASS);
    item.containerEl.classList.add(FADE_OUT_CLASS);

    requestAnimationFrame(() => {
      item.containerEl.addEventListener(
        'animationend',
        () => {
          removeItemNow(item, true);
        },
        { once: true }
      );
    });
  }

  function removeItemNow(item: SnackbarItem, removeFromStorage: boolean) {
    if (item.timer) {
      clearTimeout(item.timer);
      item.timer = undefined;
    }
    item.root.unmount?.();

    const parent = item.containerEl.parentNode;
    if (parent) {
      parent.removeChild(item.containerEl);
    }

    if (removeFromStorage) {
      const idx = storage.items.indexOf(item);
      if (idx >= 0) {
        storage.items.splice(idx, 1);
      }
    }

    // reposition the rest
    requestAnimationFrame(() => {
      repositionSnackbars();
    });

    // event: closed => ส่ง { itemId, target }
    storage._events.closed?.({ itemId: item.id, target: item.containerEl });

    // event: didClosed => ส่ง { itemId, target }
    storage._events.didClosed?.({ itemId: item.id, target: item.containerEl });

    // stackChanged => ส่งรายการ itemId + target ปัจจุบัน
    storage._events.stackChanged?.({
      itemIds: storage.items.map((it) => it.id),
      targets: storage.items.map((it) => it.containerEl),
    });

    // ถ้าไม่มี item เหลือ => ลบ containerOverlayEl ออกจาก DOM
    if (storage.items.length === 0 && storage.containerOverlayEl) {
      const triggers = document.querySelectorAll(`[aria-controls="${controls}"]`);
      triggers.forEach((triggerEl) => {
        triggerEl.setAttribute('aria-expanded', 'false');
      });
      setTimeout(() => {
        if (storage.items.length === 0 && storage.containerOverlayEl?.parentNode) {
          storage.containerOverlayEl.parentNode.removeChild(storage.containerOverlayEl);
          storage.containerOverlayEl = null;
        }
      }, 50);
    }
  }

  /**
   * เพิ่มฟังก์ชัน events(...) เพื่อผูก callback กับ lifecycle
   */
  function events(handlers: SnackbarEvents) {
    storage._events = {
      willShow: handlers.willShow,
      show: handlers.show,
      didShow: handlers.didShow,
      willClose: handlers.willClose,
      closed: handlers.closed,
      didClosed: handlers.didClosed,
      stackChanged: handlers.stackChanged,
    };
  }

  return {
    actions: {
      show,
      closeAll,
    },
    events,

    aria: {
      trigger: {
        'aria-haspopup': true,
        'aria-controls': controls,
        'aria-expanded': false,
      },
      notify: {
        heading: {
          id: `${controls}-${heading}`,
        },
        describe: {
          id: `${controls}-${describe}`,
        },
      },
    },
  };
}

// ---------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------
function validateOffset(position: SnackbarPosition, offsetX?: number, offsetY?: number) {
  if ((position === 'top-center' || position === 'bottom-center') && typeof offsetX === 'number') {
    console.warn(`[CSS-CTRL-WARN] OffsetX has no effect when using position "${position}".`);
  }
  if ((position === 'right-center' || position === 'left-center') && typeof offsetY === 'number') {
    console.warn(`[CSS-CTRL-WARN] OffsetY has no effect when using position "${position}".`);
  }
}

function getOverlayClassName(position: SnackbarPosition) {
  const NOTIFICATION_BASE_CLASS = 'snackbarPlugin';
  switch (position) {
    case 'top-left':
      return `${NOTIFICATION_BASE_CLASS}TopLeftOverlay`;
    case 'top-center':
      return `${NOTIFICATION_BASE_CLASS}TopCenterOverlay`;
    case 'top-right':
      return `${NOTIFICATION_BASE_CLASS}TopRightOverlay`;
    case 'right-center':
      return `${NOTIFICATION_BASE_CLASS}RightCenterOverlay`;
    case 'bottom-right':
      return `${NOTIFICATION_BASE_CLASS}BottomRightOverlay`;
    case 'bottom-center':
      return `${NOTIFICATION_BASE_CLASS}BottomCenterOverlay`;
    case 'bottom-left':
      return `${NOTIFICATION_BASE_CLASS}BottomLeftOverlay`;
    case 'left-center':
      return `${NOTIFICATION_BASE_CLASS}LeftCenterOverlay`;
  }
}

function applyOverlayPosition(
  el: HTMLDivElement,
  position: SnackbarPosition,
  offsetX?: number,
  offsetY?: number
) {
  switch (position) {
    case 'top-left':
      el.style.top = (offsetY || 0) + 'px';
      el.style.left = (offsetX || 0) + 'px';
      break;
    case 'top-center':
      el.style.top = (offsetY || 0) + 'px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      break;
    case 'top-right':
      el.style.top = (offsetY || 0) + 'px';
      el.style.right = (offsetX || 0) + 'px';
      break;
    case 'right-center':
      el.style.top = '50%';
      el.style.right = (offsetX || 0) + 'px';
      el.style.transform = 'translateY(-50%)';
      break;
    case 'bottom-right':
      el.style.bottom = (offsetY || 0) + 'px';
      el.style.right = (offsetX || 0) + 'px';
      break;
    case 'bottom-center':
      el.style.bottom = (offsetY || 0) + 'px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      break;
    case 'bottom-left':
      el.style.bottom = (offsetY || 0) + 'px';
      el.style.left = (offsetX || 0) + 'px';
      break;
    case 'left-center':
      el.style.left = (offsetX || 0) + 'px';
      el.style.top = '50%';
      el.style.transform = 'translateY(-50%)';
      break;
  }
}

function createUid() {
  return 'nfy-' + Math.random().toString(36).substring(2, 9);
}
