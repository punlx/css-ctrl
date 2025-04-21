// notification.ts
import { createRoot, Root } from 'react-dom/client';

// กำหนดตำแหน่งต่าง ๆ
export type NotificationPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'right-center'
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left'
  | 'left-center';

// กำหนดวิธี stack
export type NotificationStackBehavior = 'overlay' | 'stack' | 'replace';

export interface NotificationPluginOptions {
  controls: string;
  type: 'status' | 'alert';
  heading?: string;
  describe?: string;
  position: NotificationPosition;
  stackBehavior?: NotificationStackBehavior;
  maxStack?: number;

  // ถ้าตั้งเป็น 'auto-close' => จะปิดอัตโนมัติ
  close?: 'close-action' | 'auto-close';
  autoCloseDuration?: number; // ms

  animationDuration?: number; // ใช้สำหรับ fade in/out (ms)

  // offset
  offsetX?: number;
  offsetY?: number;
}

/** ข้อมูลภายในของแต่ละ notification */
interface NotificationItem {
  id: string;
  containerEl: HTMLDivElement; // <div> ของ notification ตัวนี้
  root: Root; // React Root
  timer?: number | null; // handle setTimeout ถ้ามี autoClose
}

/** storage สำหรับ plugin instance */
interface NotificationState {
  containerOverlayEl?: HTMLDivElement | null; // container หลักสำหรับตำแหน่งนั้น
  items: NotificationItem[]; // เก็บ noti ที่กำลังแสดง
}

const NOTIFICATION_BASE_CLASS = 'notificationPlugin'; // prefix
const FADE_IN_CLASS = 'notificationPluginFadeInClass';
const FADE_OUT_CLASS = 'notificationPluginFadeOutClass';

export function notification(options: NotificationPluginOptions) {
  // default config
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
  } = options;

  // ===== 1) รองรับการปรับ animationDuration โดยใช้ CSS Custom Property =====
  // (แบบเดียวกับ dialog.ts)
  // เมื่อประกาศ plugin instance นี้ขึ้นมา (หรือจะทำใน open() ก็ได้)
  // เราจะ set ไว้ที่ document.documentElement
  document.documentElement.style.setProperty(
    '--notificationPluginFadeDuration',
    `${animationDuration}ms`
  );

  // ตรวจสอบ offset ตาม requirement
  validateOffset(position, offsetX, offsetY);

  // สร้าง storage ภายใน (เหมือน dialog.ts ที่มี storage.dialog...)
  const storage: NotificationState = {
    containerOverlayEl: null,
    items: [],
  };

  // ====== Utility: สร้าง/หา container overlay สำหรับ position นั้น ======
  function getOverlayContainer(): HTMLDivElement {
    if (storage.containerOverlayEl) {
      return storage.containerOverlayEl;
    }

    // ชื่อ class สำหรับ container overlay ตาม position
    const className = getOverlayClassName(position);

    // เช็คว่ามีอยู่แล้วหรือไม่
    let overlay = document.querySelector<HTMLDivElement>(`.${className}`);
    if (!overlay) {
      // สร้างใหม่
      overlay = document.createElement('div');
      overlay.classList.add(className);

      // ตั้ง position เป็น fixed
      overlay.style.position = 'fixed';
      overlay.style.zIndex = '9999'; // กำหนด zIndex ได้ตามต้องการ

      // ตั้ง style.top/left/right/bottom ตาม position + offset
      applyOverlayPosition(overlay, position, offsetX, offsetY);

      document.body.appendChild(overlay);
    }

    storage.containerOverlayEl = overlay;
    return overlay;
  }

  // ====== Action: open notification ======
  function open(content: any) {
    // content = ReactNode ที่ user ส่งมา (เหมือน dialog.ts ที่ส่ง modal)

    const overlay = getOverlayContainer();

    // ถ้า stackBehavior = 'replace' => ลบของเก่าหมดก่อน
    if (stackBehavior === 'replace') {
      for (const item of storage.items) {
        removeItemNow(item, false); // ลบทันที
      }
      storage.items = [];
    }

    // ===== [NEW CODE] ตั้งค่า aria-expanded="true" ที่ trigger =====
    const triggers = document.querySelectorAll(`[aria-controls="${controls}"]`);
    triggers.forEach((triggerEl) => {
      triggerEl.setAttribute('aria-expanded', 'true');
    });

    // สร้าง div สำหรับ notification ชิ้นนี้
    const itemDiv = document.createElement('div');
    // ใส่คลาส fade in
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

    // ===== 2) prepend แทน append => ให้ noti ใหม่อยู่บนสุด =====
    overlay.prepend(itemDiv);

    // createRoot
    const root = createRoot(itemDiv);
    root.render(content);

    // สร้าง item object
    const newItem: NotificationItem = {
      id: createUid(),
      containerEl: itemDiv,
      root,
      timer: undefined,
    };

    // ===== จัดเก็บ item ใหม่ใน index 0 => ให้เป็น “ลำดับแรก”
    storage.items.unshift(newItem);

    // ตรวจ maxStack => ถ้าเกินให้ลบตัวท้ายสุด (เก่าสุด)
    if (storage.items.length > maxStack) {
      const removedItem = storage.items.pop();
      if (removedItem) {
        removeItemWithFadeOut(removedItem);
      }
    }

    // ถ้า close=auto-close => ตั้ง timer
    if (close === 'auto-close') {
      newItem.timer = window.setTimeout(() => {
        removeItemWithFadeOut(newItem);
      }, autoCloseDuration);
    }
  }

  // ====== Action: closeAll ======
  function closeAll() {
    // ===== [NEW CODE] ตั้งค่า aria-expanded="false" ที่ trigger เมื่อปิดทั้งหมด =====
    const triggers = document.querySelectorAll(`[aria-controls="${controls}"]`);
    triggers.forEach((triggerEl) => {
      triggerEl.setAttribute('aria-expanded', 'false');
    });

    // ลบทุกอันด้วย fade out
    for (const item of storage.items) {
      if (item.timer) {
        clearTimeout(item.timer);
      }
      removeItemWithFadeOut(item);
    }
    storage.items = [];
  }

  // ====== Remove item (fade out + animationend => unmount) ======
  function removeItemWithFadeOut(item: NotificationItem) {
    if (!item.containerEl.parentNode) {
      return;
    }

    // เอา class fadeIn ออก ใส่ class fadeOut
    item.containerEl.classList.remove(FADE_IN_CLASS);
    item.containerEl.classList.add(FADE_OUT_CLASS);

    // ฟัง event animationend => unmount + remove child
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

  // ลบ item ออกจาก DOM ทันที (ใช้ในกรณี replace หรือ animationend)
  function removeItemNow(item: NotificationItem, removeFromStorage: boolean) {
    if (item.timer) {
      clearTimeout(item.timer);
      item.timer = undefined;
    }
    item.root.unmount?.();

    if (item.containerEl.parentNode) {
      item.containerEl.parentNode.removeChild(item.containerEl);
    }

    if (removeFromStorage) {
      const idx = storage.items.indexOf(item);
      if (idx >= 0) {
        storage.items.splice(idx, 1);
      }
    }

    // ถ้าลบจน empty => optional: remove overlayContainerEl ออกได้
    if (storage.items.length === 0 && storage.containerOverlayEl) {
      // ===== [NEW CODE] ตั้ง aria-expanded="false" ด้วย (กรณีรายการหมด) =====
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

  // ====== Return API เหมือน dialog.ts ======
  return {
    actions: {
      open,
      closeAll,
    },
    aria: {
      trigger: {
        'aria-haspopup': `true`,
        'aria-controls': controls,
        'aria-expanded': `false`,
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
// Helper function
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
