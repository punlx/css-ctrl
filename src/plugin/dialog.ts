// src/plugin/dialog.ts

import { createRoot } from 'react-dom/client';

const DIALOG_PLUGIN_FADE_DURATION = 'dialogPluginFadeDuration';
const DIALOG_PLUGIN_BACKDROP_COLOR = 'dialogPluginBackdropColor';
const DIALOG_PLUGIN_Fade_SCALE = 'dialogPluginFadeScale';
const DIALOG_PLUGIN_OVERFLOW = 'dialogPluginOverflow';
const getDialogInternalPLuginMaxHeight = (scroll: 'body' | 'modal') =>
  scroll === 'body' ? '100%' : 'calc(100% - 6em)';
const DIALOG_INTERNAL_PLUGIN_MAX_HEIGHT = 'dialogInternalPluginMaxHeight';
const DIALOG_PLUGIN_WIDTH = 'dialogPluginWidth';

const getDialogPluginWidth = (scroll: 'body' | 'modal') =>
  scroll === 'body' ? '100%' : 'fit-content';

// Callback สำหรับ dialog
export interface DialogCallbackInfo {
  open: boolean;
}

export interface DialogEvents {
  willShow?: (info: DialogCallbackInfo) => void;
  show?: (info: DialogCallbackInfo) => void;
  didShow?: (info: DialogCallbackInfo) => void;
  willClose?: (info: DialogCallbackInfo) => void;
  closed?: (info: DialogCallbackInfo) => void;
  didClosed?: (info: DialogCallbackInfo) => void;
}

export interface DialogItems {
  state?: { open: boolean };
  dialog?: HTMLDialogElement | null;
  root?: any; // React Root
  modal?: any; // JSX/ReactNode

  // เพิ่มเพื่อเก็บ element ก่อนหน้า (สำหรับ restore focus)
  previousActiveElement?: HTMLElement | null;
}

// เก็บทั้งหมดไว้ใน storage.dialog
export interface DialogState {
  dialogItems: DialogItems;
  _events: DialogEvents;
}

/**
 * DialogStorage: interface ของ storage ที่ใช้ใน plugin dialog
 * (extend Record<string,unknown>) => TS ยอมให้มี property อื่นด้วย
 */
export interface DialogStorage extends Record<string, unknown> {
  dialog: DialogState;
}

/**
 * dialog plugin จะคืน API
 *
 * Requirement ใหม่: เปลี่ยนจาก backdropCloseable เป็น close?: "outside-close" | "close-action"
 */
export interface DialogPluginOptions {
  id: string;
  modal: any;
  heading: string;
  fadeDuration?: number;
  fadeScale?: number;
  // backdropCloseable?: boolean;  // ถูกตัดออก แต่เรายังคงคอมเมนต์ไว้ตาม requirement
  close?: 'outside-close' | 'close-action'; // โดย outside-close = esc + backdrop ปิด, close-action = ปิดด้วย .close() เท่านั้น
  scroll?: 'body' | 'modal';
  backdropColor?: string;
  describe?: string;

  // เพิ่ม property ใหม่เพื่อใช้สร้าง headingId
}

/**
 * สุดท้าย: เดิมเคยเป็น CssCtrlPlugin<T> = (storage: DialogStorage, className: string) => T
 * ตอนนี้ปรับให้เรียกแบบ: const dialogA = dialog(options); dialogA.action.show();
 */
export function dialog(options: DialogPluginOptions) {
  // สร้าง "dummy storage" แบบที่เคยมีในฟอร์ม plugin
  const storage: DialogStorage = {
    dialog: {
      dialogItems: {},
      _events: {},
    },
  };

  // คง logic เดิมทุกบรรทัด
  // เปลี่ยนชื่อตัวแปรจาก close -> closeMode เพื่อไม่ชนกับ function close()
  const {
    modal,
    fadeDuration = 300,
    scroll = 'body',
    backdropColor = '#00000080',
    fadeScale = 0.9,
    describe,
    heading,
    close: closeMode = 'close-action', // rename destructured property
    id, // รับค่าจาก options.id
  } = options as DialogPluginOptions & { backdropCloseable?: boolean };

  // ===== Utility =====

  function getState(): { open: boolean } {
    return storage.dialog.dialogItems.state || { open: false };
  }

  function callEvent(name: keyof DialogEvents) {
    const cb = storage.dialog._events[name];
    if (cb) {
      cb(getState());
    }
  }

  function onBackdropClick(e: MouseEvent) {
    // ถ้า user คลิกบนตัว dialogEl เอง (ไม่ใช่ลูกภายใน)
    if (e.target === e.currentTarget) {
      // ถ้า closeMode เป็น outside-close => อนุญาตให้ปิด
      if (closeMode === 'outside-close') {
        closeDialog();
      }
    }
  }

  // ====== Focus Trap และ ESC Close ======
  function trapFocus(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      const dialogEl = storage.dialog.dialogItems.dialog;
      if (!dialogEl) return;

      // หา focusable elements ใน dialog
      const focusableElements = Array.from(
        dialogEl.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ) as HTMLElement[];

      if (!focusableElements.length) return;
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // SHIFT + TAB
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // TAB
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  function handleEscKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      // ถ้าเป็น outside-close => อนุญาตให้ปิดด้วย ESC
      if (closeMode === 'outside-close') {
        closeDialog();
      }
    }
  }

  // ===== Action =====

  function show() {
    callEvent('willShow');

    // ถ้ามี dialog อยู่แล้ว => error
    if (storage.dialog.dialogItems.dialog) {
      throw new Error('[dialog plugin] already open');
    }

    // บันทึกองค์ประกอบที่โฟกัสอยู่ก่อนเปิด dialog
    storage.dialog.dialogItems.previousActiveElement = document.activeElement as HTMLElement;

    // 1) สร้าง <dialog>
    const dialogEl = document.createElement('dialog');

    // set attribute สำหรับ dialog
    dialogEl.role = 'dialog';
    dialogEl.tabIndex = -1;
    dialogEl.ariaModal = 'true';

    if (describe) {
      dialogEl.setAttribute('aria-describedby', `${id}-${describe}`);
    }

    // ===== เพิ่ม logic สำหรับ headingId =====
    // ถ้า dev ใส่ทั้ง id และ labelledby => สร้าง headingId = `${id}-${heading}`
    // แล้วใช้ setAttribute('aria-labelledby', headingId) เพื่อ override
    dialogEl.setAttribute('aria-labelledby', `${id}-${heading}`);

    document.documentElement.style.setProperty(`--${DIALOG_PLUGIN_OVERFLOW}`, `hidden`);
    document.documentElement.style.setProperty(
      `--${DIALOG_PLUGIN_FADE_DURATION}`,
      `${fadeDuration}ms`
    );
    document.documentElement.style.setProperty(`--${DIALOG_PLUGIN_BACKDROP_COLOR}`, backdropColor);
    document.documentElement.style.setProperty(
      `--${DIALOG_PLUGIN_Fade_SCALE}`,
      `scale(${fadeScale})`
    );

    document.documentElement.style.setProperty(
      `--${DIALOG_INTERNAL_PLUGIN_MAX_HEIGHT}`,
      `${getDialogInternalPLuginMaxHeight(scroll)}`
    );

    document.documentElement.style.setProperty(
      `--${DIALOG_PLUGIN_WIDTH}`,
      `${getDialogPluginWidth(scroll)}`
    );

    document.body.appendChild(dialogEl);

    // 1.1) สร้าง child container
    const contentDiv = document.createElement('div');
    // contentDiv.classList.add(className);

    // เพิ่มการกำหนด tabIndex = -1 ให้ contentDiv เพื่อให้โฟกัสได้
    contentDiv.setAttribute('tabIndex', '-1');

    dialogEl.appendChild(contentDiv);

    // 2) render(modal) ลงใน contentDiv
    const root = createRoot(contentDiv);
    root.render(modal);

    // ======= NEW CODE: ตรวจสอบว่ามี heading element ID ตรงตามที่กำหนดหรือไม่ =======
    // ทำใน requestAnimationFrame หรือ setTimeout เพื่อให้ React render เสร็จก่อน
    requestAnimationFrame(() => {
      const headingSelector = `#${id}-${heading}`;
      const headingElement = contentDiv.querySelector(headingSelector);
      if (!headingElement) {
        console.warn(
          `[CSS-CTRL-WARN] Missing heading element in modal "${id}".\n\n` +
            `To ensure accessibility (A11y), add a heading like:\n` +
            `  <h1 id={dialogInstance.aria.heading}>Your Dialog Title</h1>\n` +
            `  // dialogInstance.aria.heading === '${headingSelector}'\n\n` +
            `This allows screen readers to announce the dialog title via aria-labelledby.`
        );
      }
    });

    // เดิม: ถ้า backdropCloseable => ผูก event click => onBackdropClick
    // ปัจจุบัน: ถ้า closeMode === 'outside-close' => ให้คลิก backdrop เพื่อปิด
    if (closeMode === 'outside-close') {
      dialogEl.addEventListener('click', onBackdropClick);
    }

    // ผูก keydown สำหรับ trapFocus เสมอ
    dialogEl.addEventListener('keydown', trapFocus);

    // ถ้าเป็น outside-close => ผูก ESC
    if (closeMode === 'outside-close') {
      dialogEl.addEventListener('keydown', handleEscKey);
    }

    // 3) เก็บอ้างอิง
    storage.dialog.dialogItems.dialog = dialogEl;
    storage.dialog.dialogItems.root = root;
    storage.dialog.dialogItems.state = { open: true };

    callEvent('show');
    (dialogEl as HTMLDialogElement).showModal();
    callEvent('didShow');

    // กำหนดโฟกัสเริ่มต้นใน dialog (focus ที่องค์ประกอบแรกที่โฟกัสได้ หรือ dialogEl เองเป็น fallback)
    requestAnimationFrame(() => {
      const focusableElements = dialogEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else {
        // เดิมคือ dialogEl.focus();
        // contentDiv.setAttribute('tabIndex','-1'); // ได้ถูกกำหนดไว้แล้วด้านบน
        // เราเปลี่ยนมา focus ที่ contentDiv แทน
        // ถ้าต้องการคงโค้ดเดิมไว้ให้ดู สามารถคอมเมนต์ได้ดังนี้:
        // dialogEl.focus(); // (commented out เพื่อไม่ลบ logic เดิม)
        contentDiv.focus();
      }
    });
  }

  function closeDialog() {
    callEvent('willClose');
    if (!storage.dialog.dialogItems.dialog) return;

    const dialogEl = storage.dialog.dialogItems.dialog;

    // ลบ listener ถ้ามี
    if (closeMode === 'outside-close') {
      dialogEl.removeEventListener('click', onBackdropClick);
      dialogEl.removeEventListener('keydown', handleEscKey);
    }

    dialogEl.removeEventListener('keydown', trapFocus);

    dialogEl.classList.add('dialogPluginFadeOutClass');
    requestAnimationFrame(() => {
      dialogEl.addEventListener(
        'animationend',
        () => {
          dialogEl.classList.remove('dialogPluginFadeOutClass');
          dialogEl.close();
          storage.dialog.dialogItems.state = { open: false };
          callEvent('closed');

          // unmount react
          if (storage.dialog.dialogItems.root) {
            storage.dialog.dialogItems.root.unmount?.();
            storage.dialog.dialogItems.root = null;
          }

          // เอา <dialog> ออกจาก DOM
          if (dialogEl.parentNode) {
            dialogEl.parentNode.removeChild(dialogEl);
          }
          storage.dialog.dialogItems.dialog = null;

          // restore focus
          const prevFocus = storage.dialog.dialogItems.previousActiveElement;
          if (prevFocus && typeof prevFocus.focus === 'function') {
            prevFocus.focus();
          }

          callEvent('didClosed');
        },
        { once: true }
      );
    });
  }

  function close() {
    closeDialog();
  }

  function events(e: DialogEvents) {
    storage.dialog._events = {
      willShow: e.willShow,
      show: e.show,
      didShow: e.didShow,
      willClose: e.willClose,
      closed: e.closed,
      didClosed: e.didClosed,
    };
  }

  // ===== Return API =====

  // นำ headingId (ซึ่งเป็นตัวเต็มของ id + heading) ใส่ใน output
  // เพื่อให้ dev สามารถใช้เป็น id ใน React component

  return {
    action: {
      show,
      close,
      getState,
    },
    events,
    // ส่งออก aria.heading ให้ใช้งานได้
    aria: {
      heading: `${id}-${heading}`,
      describe: `${id}-${describe}`,
    },
  };
}
