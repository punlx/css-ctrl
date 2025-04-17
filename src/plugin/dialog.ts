// src/plugin/types.ts
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
}

// เก็บทั้งหมดไว้ใน storage.dialog
export interface DialogState {
  dialogItems: DialogItems;
  _events: DialogEvents;
}

// storage.plugin?: สมมติว่ามี react
export interface PluginSet {
  react?: {
    createRoot?: (el: HTMLElement) => any;
  };
  [key: string]: any;
}

/**
 * DialogStorage: interface ของ storage ที่ใช้ใน plugin dialog
 * (extend Record<string,unknown>) => TS ยอมให้มี property อื่นด้วย
 */
export interface DialogStorage extends Record<string, unknown> {
  dialog: DialogState;
  plugin?: PluginSet;
}

/**
 * dialog plugin จะคืน API
 */
export interface DialogPluginOptions {
  modal: any;
  fadeDuration?: number;
  fadeScale?: number;
  backdropCloseable?: boolean;
  scroll?: 'body' | 'modal';
  backdropColor?: string;
  labelledby?: string;
  describedby?: string;
}

export interface DialogAPI {
  dialog: {
    action: {
      show: () => void;
      close: () => void;
      getState: () => { open: boolean };
    };
    events: (e: DialogEvents) => void;
  };
}

/**
 * สุดท้าย CssCtrlPlugin<T>
 * สมมติว่า = (storage: DialogStorage, className: string) => T
 */
export type CssCtrlPlugin<T> = (storage: DialogStorage, className: string) => T;

// src/plugin/dialog.ts

export function dialog(options: DialogPluginOptions): CssCtrlPlugin<DialogAPI> {
  const {
    modal,
    backdropCloseable = false,
    fadeDuration = 300,
    scroll = 'body',
    backdropColor = '#00000080',
    fadeScale = 0.9,
    describedby,
    labelledby,
  } = options;

  return (storage: DialogStorage, className: string) => {
    // ถ้าไม่มี storage.dialog => สร้าง
    if (!storage.dialog) {
      storage.dialog = {
        dialogItems: {},
        _events: {},
      };
    }
    // หากไม่มี dialogItems => สร้าง
    if (!storage.dialog.dialogItems) {
      storage.dialog.dialogItems = {};
    }
    // หากไม่มี _events => สร้าง
    if (!storage.dialog._events) {
      storage.dialog._events = {};
    }

    // =========== Utility ============

    function getState(): { open: boolean } {
      return storage.dialog.dialogItems.state || { open: false };
    }

    function callEvent(name: keyof DialogEvents) {
      const cb = storage.dialog._events[name];
      if (cb) {
        cb(getState());
      }
    }

    // Listener: ถ้าคลิกบน backdrop => close
    function onBackdropClick(e: MouseEvent) {
      // ถ้า user คลิกบนตัว dialogEl เอง (ไม่ใช่ลูกภายใน)
      if (e.target === e.currentTarget) {
        close();
      }
    }

    // =========== Action ============

    function show() {
      callEvent('willShow');

      // ถ้ามี dialog อยู่แล้ว => error
      if (storage.dialog.dialogItems.dialog) {
        throw new Error(`[dialog plugin] already open`);
      }

      // 1) สร้าง <dialog>
      const dialogEl = document.createElement('dialog');

      // set attribute สำหรับ dialog
      dialogEl.role = 'dialog';
      dialogEl.ariaModal = 'true';

      if (describedby) {
        dialogEl.setAttribute('aria-describedby', describedby);
      }

      if (labelledby) {
        dialogEl.setAttribute('aria-labelledby', labelledby);
      }

      document.documentElement.style.setProperty(`--${DIALOG_PLUGIN_OVERFLOW}`, `hidden`);
      document.documentElement.style.setProperty(
        `--${DIALOG_PLUGIN_FADE_DURATION}`,
        `${fadeDuration}ms`
      );
      document.documentElement.style.setProperty(
        `--${DIALOG_PLUGIN_BACKDROP_COLOR}`,
        backdropColor
      );
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

      dialogEl.appendChild(contentDiv);

      if (!storage.plugin?.react?.createRoot) {
        throw new Error(
          `[CSS-CTRL-ERR] Please config theme.plugin by passing createRoot to enable dialog plugin for react.`
        );
      }
      // 2) ถ้ามี react => render(modal) ลงใน contentDiv
      const root = storage.plugin.react.createRoot(contentDiv);
      root.render(modal);

      // ถ้า backdropCloseable => ผูก event click => onBackdropClick
      if (backdropCloseable) {
        dialogEl.addEventListener('click', onBackdropClick);
      }

      // 3) เก็บอ้างอิง
      storage.dialog.dialogItems.dialog = dialogEl;
      storage.dialog.dialogItems.root = root;
      storage.dialog.dialogItems.state = { open: true };

      callEvent('show');
      (dialogEl as HTMLDialogElement).showModal();
      callEvent('didShow');
    }

    function close() {
      callEvent('willClose');
      if (!storage.dialog.dialogItems.dialog) return;

      const dialogEl = storage.dialog.dialogItems.dialog;

      // ลบ listener ถ้ามี
      if (backdropCloseable) {
        dialogEl.removeEventListener('click', onBackdropClick);
      }

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

            callEvent('didClosed');
          },
          { once: true }
        );
      });
    }

    // =========== events(...) ============

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

    // =========== Return ============

    return {
      dialog: {
        action: {
          show,
          close,
          getState,
        },
        events,
      },
    };
  };
}
