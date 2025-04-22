// drawer.ts
import { createRoot, Root } from 'react-dom/client';

export interface DrawerPluginAPI {
  actions: {
    show(): void;
    close(): void;
    getState(): { open: boolean };
    closeAll(): void;
  };
  events(e: DrawerEvents): void;
  aria: {
    heading: { id: string };
    describe: { id: string };
  };
}

/** ฟังก์ชันสำหรับ trap focus แบบง่าย ๆ */
function enableFocusTrap(container: HTMLElement): () => void {
  const keydownHandler = (evt: KeyboardEvent) => {
    if (evt.key === 'Tab') {
      const focusable = container.querySelectorAll<HTMLElement>(
        'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!evt.shiftKey && document.activeElement === last) {
        evt.preventDefault();
        first.focus();
      } else if (evt.shiftKey && document.activeElement === first) {
        evt.preventDefault();
        last.focus();
      }
    }
  };
  document.addEventListener('keydown', keydownHandler);
  return () => {
    document.removeEventListener('keydown', keydownHandler);
  };
}

/** interface สำหรับ Event callback ของ Drawer */
export interface DrawerEvents {
  willShow?: (info: { open: boolean }) => void;
  show?: (info: { open: boolean }) => void;
  didShow?: (info: { open: boolean }) => void;
  willClose?: (info: { open: boolean }) => void;
  closed?: (info: { open: boolean }) => void;
  didClosed?: (info: { open: boolean }) => void;
}

/** ข้อมูลภายในของ Drawer Plugin */
interface DrawerState {
  open: boolean;
  containerEl?: HTMLDivElement | null;
  overlayEl?: HTMLDivElement | null;
  root?: Root | null;
  previousActiveElement?: HTMLElement | null;
  outsideClickHandler?: (evt: MouseEvent) => void;
  keydownHandler?: (evt: KeyboardEvent) => void;
  focusTrapCleanup?: () => void;
  _events: DrawerEvents;
}

/** interface สำหรับ storage ภายใน (ถ้าอยากเก็บเพิ่ม) */
interface DrawerStorage extends Record<string, unknown> {
  drawer: DrawerState;
}

/** ตัวเลือกในการสร้าง Drawer */
export interface DrawerPluginOptions {
  id: string;
  /** เนื้อหา React ที่จะ render เป็น Drawer (เช่น <DrawerContent/> ) */
  drawer: any;
  /** ตำแหน่งที่ Drawer จะเลื่อนเข้ามา (default = 'left') */
  placement?: 'left' | 'right' | 'top' | 'bottom';
  /** close-mode => 'outside-close' (คลิก backdrop + ESC) หรือ 'close-action' (ต้องเรียก .close()) */
  close?: 'outside-close' | 'close-action';
  /** เปิด/ปิด focus trap (default = true) */
  trapFocus?: boolean;
  /** ระยะเวลาทรานซิชัน (ms) */
  fadeDuration?: number;
  /** สี backdrop overlay (default = 'rgba(0,0,0,0.5)') */
  backdropColor?: string;
  /** แสดง/ไม่แสดง overlay (default = true) */
  overlay?: boolean;
  /** ถ้ามี initialFocus => โฟกัส element ภายใน drawer */
  initialFocus?: string;
  /** zIndex (default=9999) */
  zIndex?: number;
  /** heading/describe สำหรับ aria */
  heading?: string;
  describe?: string;
}

/** สำหรับเก็บ Drawer ทั้งหมดไว้ใน registry หากต้องการ closeAll */
const drawerRegistry: DrawerPluginAPI[] = [];

/** ฟังก์ชันหลักสำหรับสร้าง Drawer Plugin */
export function drawer(options: DrawerPluginOptions): DrawerPluginAPI {
  const storage: DrawerStorage = {
    drawer: {
      open: false,
      _events: {},
    },
  };

  const {
    id,
    drawer: drawerContent,
    placement = 'left',
    close = 'close-action',
    trapFocus = true,
    fadeDuration = 300,
    backdropColor = 'rgba(0,0,0,0.5)',
    overlay = true,
    initialFocus,
    zIndex = 9999,
    heading,
    describe,
  } = options;

  function callEvent(name: keyof DrawerEvents) {
    const cb = storage.drawer._events[name];
    if (cb) {
      cb({ open: storage.drawer.open });
    }
  }

  function events(e: DrawerEvents) {
    storage.drawer._events = {
      willShow: e.willShow,
      show: e.show,
      didShow: e.didShow,
      willClose: e.willClose,
      closed: e.closed,
      didClosed: e.didClosed,
    };
  }

  function handleOverlayClick(evt: MouseEvent) {
    const overlayEl = storage.drawer.overlayEl;
    if (!overlayEl) return;
    if (evt.target === overlayEl) {
      if (close === 'outside-close') {
        closeDrawer();
      }
    }
  }

  function showDrawer() {
    if (storage.drawer.open) return;
    storage.drawer.open = true;
    callEvent('willShow');

    // เก็บ previous focus
    storage.drawer.previousActiveElement = document.activeElement as HTMLElement;

    // สร้าง overlay ถ้าต้องการ
    let overlayEl: HTMLDivElement | null = null;
    if (overlay) {
      overlayEl = document.createElement('div');
      overlayEl.classList.add('drawerPluginOverlay');
      overlayEl.style.position = 'fixed';
      overlayEl.style.top = '0';
      overlayEl.style.left = '0';
      overlayEl.style.right = '0';
      overlayEl.style.bottom = '0';
      overlayEl.style.backgroundColor = backdropColor;
      overlayEl.style.opacity = '0';
      overlayEl.style.transition = `opacity ${fadeDuration}ms ease`;
      overlayEl.style.zIndex = String(zIndex);

      document.body.appendChild(overlayEl);

      if (close === 'outside-close') {
        overlayEl.addEventListener('click', handleOverlayClick);
      }
    }
    storage.drawer.overlayEl = overlayEl;

    // สร้าง container สำหรับ Drawer
    const containerEl = document.createElement('div');
    containerEl.classList.add('drawerPluginContainer');
    containerEl.setAttribute('role', 'dialog');
    containerEl.setAttribute('aria-modal', 'true');
    if (heading) {
      containerEl.setAttribute('aria-labelledby', `${id}-${heading}`);
    }
    if (describe) {
      containerEl.setAttribute('aria-describedby', `${id}-${describe}`);
    }
    containerEl.style.position = 'fixed';
    containerEl.style.zIndex = String(zIndex + 1);
    containerEl.style.transition = `transform ${fadeDuration}ms ease`;
    containerEl.style.backgroundColor = '#fff';
    containerEl.style.outline = 'none';

    // กำหนดตำแหน่งเริ่มต้น
    switch (placement) {
      case 'left':
        containerEl.style.top = '0';
        containerEl.style.bottom = '0';
        containerEl.style.left = '0';
        containerEl.style.transform = 'translateX(-100%)';
        break;
      case 'right':
        containerEl.style.top = '0';
        containerEl.style.bottom = '0';
        containerEl.style.right = '0';
        containerEl.style.transform = 'translateX(100%)';
        break;
      case 'top':
        containerEl.style.left = '0';
        containerEl.style.right = '0';
        containerEl.style.top = '0';
        containerEl.style.transform = 'translateY(-100%)';
        break;
      case 'bottom':
        containerEl.style.left = '0';
        containerEl.style.right = '0';
        containerEl.style.bottom = '0';
        containerEl.style.transform = 'translateY(100%)';
        break;
    }

    document.body.appendChild(containerEl);

    const root = createRoot(containerEl);
    root.render(drawerContent);

    storage.drawer.containerEl = containerEl;
    storage.drawer.root = root;

    // keydown => ESC (ถ้า close==='outside-close')
    if (close === 'outside-close') {
      const keydownHandler = (evt: KeyboardEvent) => {
        if (evt.key === 'Escape') {
          closeDrawer();
        }
      };
      storage.drawer.keydownHandler = keydownHandler;
      document.addEventListener('keydown', keydownHandler);
    }

    // trap focus
    if (trapFocus) {
      storage.drawer.focusTrapCleanup = enableFocusTrap(containerEl);
    }

    // requestAnimationFrame เพื่อให้ DOM พร้อม
    requestAnimationFrame(() => {
      // animate overlay in
      if (overlayEl) {
        overlayEl.style.opacity = '1';
      }
      // animate drawer in
      switch (placement) {
        case 'left':
          containerEl.style.transform = 'translateX(0)';
          break;
        case 'right':
          containerEl.style.transform = 'translateX(0)';
          break;
        case 'top':
          containerEl.style.transform = 'translateY(0)';
          break;
        case 'bottom':
          containerEl.style.transform = 'translateY(0)';
          break;
      }
      requestAnimationFrame(() => {
        callEvent('show');
        setTimeout(() => {
          callEvent('didShow');
        }, fadeDuration);
      });
    });

    // focus
    requestAnimationFrame(() => {
      if (initialFocus) {
        const el = containerEl.querySelector<HTMLElement>(initialFocus);
        if (el) {
          el.focus();
        } else {
          containerEl.focus();
        }
      } else {
        containerEl.focus();
      }
    });
  }

  function closeDrawer() {
    if (!storage.drawer.open) return;
    callEvent('willClose');
    storage.drawer.open = false;

    const { containerEl, overlayEl, root } = storage.drawer;

    // ถอน event listeners
    if (storage.drawer.keydownHandler) {
      document.removeEventListener('keydown', storage.drawer.keydownHandler);
      storage.drawer.keydownHandler = undefined;
    }
    if (overlayEl && close === 'outside-close') {
      overlayEl.removeEventListener('click', handleOverlayClick);
    }
    if (storage.drawer.focusTrapCleanup) {
      storage.drawer.focusTrapCleanup();
      storage.drawer.focusTrapCleanup = undefined;
    }

    // animate out
    if (overlayEl) {
      overlayEl.style.opacity = '0';
    }
    if (containerEl) {
      switch (placement) {
        case 'left':
          containerEl.style.transform = 'translateX(-100%)';
          break;
        case 'right':
          containerEl.style.transform = 'translateX(100%)';
          break;
        case 'top':
          containerEl.style.transform = 'translateY(-100%)';
          break;
        case 'bottom':
          containerEl.style.transform = 'translateY(100%)';
          break;
      }
    }

    // รอ animation เสร็จ
    setTimeout(() => {
      if (root) {
        root.unmount?.();
        storage.drawer.root = null;
      }
      if (containerEl && containerEl.parentNode) {
        containerEl.parentNode.removeChild(containerEl);
      }
      if (overlayEl && overlayEl.parentNode) {
        overlayEl.parentNode.removeChild(overlayEl);
      }
      // restore focus
      if (storage.drawer.previousActiveElement) {
        storage.drawer.previousActiveElement.focus();
      }
      callEvent('closed');
      callEvent('didClosed');
    }, fadeDuration);
  }

  function getState() {
    return { open: storage.drawer.open };
  }

  // เสริมเผื่ออยากให้ plugin รองรับ closeAll
  function closeAll() {
    drawerRegistry.forEach((inst) => {
      inst.actions.close();
    });
  }

  const api = {
    actions: {
      show: showDrawer,
      close: closeDrawer,
      getState,
      closeAll, // นำไปใช้ถ้าต้องการปิด Drawer ทุกตัว
    },
    events,
    aria: {
      heading: { id: `${id}-${heading}` },
      describe: { id: `${id}-${describe}` },
    },
  };

  // เก็บลงใน registry
  if (!drawerRegistry.includes(api)) {
    drawerRegistry.push(api);
  }

  return api;
}

/* -------------------------------------------------------------
   ตัวอย่าง CSS (รวมอยู่ในไฟล์เดียวเพื่อให้เห็นภาพพร้อมใช้งาน)
   คุณสามารถย้ายไปไฟล์ .css แยกได้ตามสะดวก
------------------------------------------------------------- */
