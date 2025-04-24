// drawer.ts
import { createRoot, Root } from 'react-dom/client';

interface DrawerEvents {
  willShow?: (info: { open: boolean }) => void;
  show?: (info: { open: boolean }) => void;
  didShow?: (info: { open: boolean }) => void;
  willClose?: (info: { open: boolean }) => void;
  closed?: (info: { open: boolean }) => void;
  didClosed?: (info: { open: boolean }) => void;
}

interface DrawerPluginAPI {
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
interface DrawerPluginOptions {
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

  /** NEW: ถ้าต้องการป้องกันการเลื่อน body (default=false) */
  disableBodyScroll?: boolean;
}

/** สำหรับเก็บ Drawer ทั้งหมดไว้ใน registry หากต้องการ closeAll */
const drawerRegistry: DrawerPluginAPI[] = [];

/**
 * stack สำหรับเก็บค่า overflow เดิมของ body ก่อนที่จะถูก set เป็น 'hidden'
 * ทำให้รองรับกรณีเปิด-ปิด Drawer ซ้อนกันได้ดีขึ้น
 */
const oldBodyOverflowStack: string[] = [];

/** ฟังก์ชันเสริมสำหรับจัดการ body overflow */
function pushBodyOverflow() {
  oldBodyOverflowStack.push(document.body.style.overflow);
  document.body.style.overflow = 'hidden';
}
function popBodyOverflow() {
  // ถ้า stack ว่าง => ใช้ overflow=''
  const oldVal = oldBodyOverflowStack.pop() ?? '';
  document.body.style.overflow = oldVal;
}

/** ฟังก์ชันสำหรับลบ instance ออกจาก registry ป้องกัน memory leak */
function removeFromRegistry(api: DrawerPluginAPI) {
  const idx = drawerRegistry.indexOf(api);
  if (idx !== -1) {
    drawerRegistry.splice(idx, 1);
  }
}

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
    disableBodyScroll = true,
  } = options;

  // เตือน ถ้า overlay=false แต่ใช้ close='outside-close'
  if (!overlay && close === 'outside-close') {
    console.warn(
      `[DrawerPlugin] overlay=false + close='outside-close' means 'outside-close' won't work.\n` +
        `You must close the Drawer manually via drawerInstance.actions.close(), or use close='close-action' instead.`
    );
  }

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

    // ถ้าต้องการ disable body scroll => push ค่าเดิมของ overflow เข้า stack
    if (disableBodyScroll) {
      pushBodyOverflow();
    }

    // เก็บ previous focus
    storage.drawer.previousActiveElement = document.activeElement as HTMLElement;

    // สร้าง overlay ถ้าต้องการ
    let overlayEl: HTMLDivElement | null = null;
    if (overlay) {
      overlayEl = document.createElement('div');
      overlayEl.classList.add('drawerPluginOverlay');

      // กำหนด style สำหรับ overlay โดยตรง (ไม่แตะ global)
      //   ADD STYLES
      overlayEl.style.setProperty(`--DRAWER_PLUGIN_BACLDROP_BG_COLOR`, backdropColor);

      overlayEl.style.setProperty(`--DRAWER_PLUGIN_FADE_DURATION`, `${fadeDuration}ms`);

      overlayEl.style.setProperty(`--DRAWER_PLUGIN_Z_INDEX`, String(zIndex));

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

    // inline style เฉพาะตัว container
    containerEl.style.position = 'fixed';
    containerEl.style.zIndex = String(zIndex + 1);
    containerEl.style.backgroundColor = '#fff';
    containerEl.style.outline = 'none';
    // กำหนด transition/transform เฉพาะ drawer
    containerEl.style.transition = `transform ${fadeDuration}ms ease`;
    containerEl.style.willChange = 'transform';

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

    // ใช้ React 18 createRoot
    const root = createRoot(containerEl);
    root.render(drawerContent);

    storage.drawer.containerEl = containerEl;
    storage.drawer.root = root;

    // keydown => ESC (เฉพาะ outside-close)
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

    // animate in
    requestAnimationFrame(() => {
      if (overlayEl) {
        overlayEl.style.opacity = '1';
      }
      switch (placement) {
        case 'left':
        case 'right':
          containerEl.style.transform = 'translateX(0)';
          break;
        case 'top':
        case 'bottom':
          containerEl.style.transform = 'translateY(0)';
          break;
      }
    });

    // เมื่อ transition in เสร็จ => เรียก didShow
    const onTransitionEndShow = (e: TransitionEvent) => {
      // เช็คว่าเป็น transform ของ containerEl เอง
      if (e.propertyName === 'transform' && e.target === containerEl) {
        containerEl.removeEventListener('transitionend', onTransitionEndShow);
        callEvent('show');
        callEvent('didShow');
      }
    };
    containerEl.addEventListener('transitionend', onTransitionEndShow);

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

    // ถ้ามี disableBodyScroll => pop ค่า overflow เดิมคืน
    if (disableBodyScroll) {
      popBodyOverflow();
    }

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

    // ฟัง transitionend => didClosed
    const onTransitionEndClose = (e: TransitionEvent) => {
      if (e.propertyName === 'transform' && e.target === containerEl) {
        cleanup();
      }
    };
    containerEl?.addEventListener('transitionend', onTransitionEndClose);

    function cleanup() {
      containerEl?.removeEventListener('transitionend', onTransitionEndClose);
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

      // เช็คก่อนว่า previousActiveElement ยังอยู่ใน DOM ไหม
      if (
        storage.drawer.previousActiveElement &&
        document.contains(storage.drawer.previousActiveElement)
      ) {
        storage.drawer.previousActiveElement.focus();
      }

      // เรียก event
      callEvent('closed');
      callEvent('didClosed');

      // นำ instance ออกจาก registry
      removeFromRegistry(api);
    }
  }

  function getState() {
    return { open: storage.drawer.open };
  }

  // รองรับ closeAll
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
      closeAll,
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
