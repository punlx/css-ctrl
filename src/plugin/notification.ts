// notification.ts
import { createRoot, Root } from 'react-dom/client';

// ตำแหน่งต่าง ๆ
export type NotificationPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'right-center'
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left'
  | 'left-center';

export type NotificationStackBehavior = 'overlay' | 'stack' | 'replace';

export interface NotificationPluginOptions {
  controls: string;
  type: 'status' | 'alert';
  heading?: string;
  spacing?: number;
  describe?: string;
  position: NotificationPosition;
  stackBehavior?: NotificationStackBehavior;
  maxStack?: number;
  close?: 'close-action' | 'auto-close';
  autoCloseDuration?: number; // ms
  animationDuration?: number; // fade in/out (ms)
  offsetX?: number;
  offsetY?: number;
}

/** ข้อมูลภายในของแต่ละ notification */
interface NotificationItem {
  id: string;
  containerEl: HTMLDivElement;
  root: Root;
  timer?: number | null;
}

interface NotificationState {
  containerOverlayEl?: HTMLDivElement | null;
  items: NotificationItem[];
}

const NOTIFICATION_BASE_CLASS = 'notificationPlugin';
const FADE_IN_CLASS = 'notificationPluginFadeInClass';
const FADE_OUT_CLASS = 'notificationPluginFadeOutClass';

/**
 * notification(options) => { actions: { open, closeAll }, ... }
 *   - ใช้ "absolute positioning" คล้าย antd
 *   - มีการแยก logic top-based vs bottom-based
 *     เพื่อให้ position = bottom-* วางตัวใหม่ที่ bottom=0, ตัวเก่าเลื่อนขึ้น
 */
export function notification(options: NotificationPluginOptions) {
  const {
    position,
    stackBehavior = 'stack',
    maxStack = 5,
    close = 'close-action',
    autoCloseDuration = 3000,
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
    '--notificationPluginFadeDuration',
    `${animationDuration}ms`
  );
  validateOffset(position, offsetX, offsetY);

  const storage: NotificationState = {
    containerOverlayEl: null,
    items: [],
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
      overlay.style.position = 'fixed';
      overlay.style.zIndex = '9999';

      // จัดตำแหน่งตาม offset/position
      applyOverlayPosition(overlay, position, offsetX, offsetY);

      // กำหนดค่าเพื่อให้ child เป็น absolute
      overlay.style.width = 'auto';
      overlay.style.height = 'auto';
      overlay.style.pointerEvents = 'none';

      document.body.appendChild(overlay);
    }
    storage.containerOverlayEl = overlay;
    return overlay;
  }

  /**
   * repositionNotifications:
   *  - ถ้า top-based => newest on top(0), older down
   *  - ถ้า bottom-based => newest on bottom(0), older up
   */
  function repositionNotifications() {
    if (!storage.containerOverlayEl) return;

    // เช็คว่าเป็น bottom-based หรือไม่
    const isBottom =
      position === 'bottom-left' || position === 'bottom-center' || position === 'bottom-right';

    if (isBottom) {
      // กรณี bottom => วาง item[0] = bottom=0 => item[1] เหนือมัน
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

        // ถ้า overlay อยู่ bottom-right => right=0
        // ถ้า bottom-left => left=0
        // ถ้า bottom-center => translateX(-50%) => code ต้นฉบับ handle ใน applyOverlayPosition
        // สมมุติว่า (เหมือน antd) => right=0 ถ้า user อยาก align
        // แต่จริง ๆ ถ้าต้อง align left => check position
        if (position === 'bottom-left') {
          el.style.left = '0';
        } else if (position === 'bottom-right') {
          el.style.right = '0';
        }

        // bottom = currentOffset
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

  function open(content: any) {
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
    itemDiv.classList.add('notificationPluginItem');
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

    const newItem: NotificationItem = {
      id: createUid(),
      containerEl: itemDiv,
      root,
      timer: undefined,
    };

    storage.items.unshift(newItem);

    if (storage.items.length > maxStack) {
      const removedItem = storage.items.pop();
      if (removedItem) {
        removeItemWithFadeOut(removedItem);
      }
    }

    // รอ 1 frame => วัด size => reposition
    requestAnimationFrame(() => {
      repositionNotifications();
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

  function removeItemWithFadeOut(item: NotificationItem) {
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

  function removeItemNow(item: NotificationItem, removeFromStorage: boolean) {
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
      repositionNotifications();
    });

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

  return {
    actions: {
      open,
      closeAll,
    },
    aria: {
      trigger: {
        'aria-haspopup': 'true',
        'aria-controls': controls,
        'aria-expanded': 'false',
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
function validateOffset(position: NotificationPosition, offsetX?: number, offsetY?: number) {
  if ((position === 'top-center' || position === 'bottom-center') && typeof offsetX === 'number') {
    throw new Error(`ถ้าใช้ ${position} จะปรับ offsetX ไม่ได้`);
  }
  if ((position === 'right-center' || position === 'left-center') && typeof offsetY === 'number') {
    throw new Error(`ถ้าใช้ ${position} จะปรับ offsetY ไม่ได้`);
  }
}

function getOverlayClassName(position: NotificationPosition) {
  const NOTIFICATION_BASE_CLASS = 'notificationPlugin';
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
  position: NotificationPosition,
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
