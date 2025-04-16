// src/plugin/types.ts

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
  fadeDuration: number;
  backdropCloseable: boolean;
  scroll: 'body' | 'dialog';
  modal: any;
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
  const { modal } = options;

  // ปลั๊กอิน: (storage: DialogStorage, className: string) => DialogAPI
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

    // =========== Action ============
    function show() {
      callEvent('willShow');

      // ถ้ามี dialog อยู่แล้ว => error
      if (storage.dialog.dialogItems.dialog) {
        throw new Error(`[dialog plugin] already open`);
      }

      // 1) สร้าง <dialog>
      const dialogEl = document.createElement('dialog');
      dialogEl.classList.add(className);
      document.body.appendChild(dialogEl);

      // 2) ถ้ามี react => render modal
      const root = storage.plugin?.react?.createRoot
        ? storage.plugin.react.createRoot(dialogEl)
        : null;
      if (root) {
        root.render(modal);
      } else {
        throw new Error(`[CSS-CTRL-ERR] 
Please config theme.plugin by passing createRoot to enable dialog plugin for react.`);
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
      dialogEl.classList.add('fade-out');

      requestAnimationFrame(() => {
        dialogEl.addEventListener(
          'animationend',
          () => {
            dialogEl.classList.remove('fade-out');
            dialogEl.close();
            storage.dialog.dialogItems.state = { open: false };
            callEvent('closed');

            // unmount react
            if (storage.dialog.dialogItems.root) {
              storage.dialog.dialogItems.root.unmount?.();
              storage.dialog.dialogItems.root = null;
            }

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
