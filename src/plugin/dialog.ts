// src/plugin/dialog.ts
import { createRoot } from 'react-dom/client';

const DIALOG_PLUGIN_FADE_DURATION = 'dialogPluginFadeDuration';
const DIALOG_PLUGIN_BACKDROP_COLOR = 'dialogPluginBackdropColor';
const DIALOG_PLUGIN_FADE_SCALE = 'dialogPluginFadeScale';
const DIALOG_PLUGIN_SCROLL_BODY_PADDING = 'dialogPluginScrollBodyPadding';

const DIALOG_PLUGIN_OVERFLOW = 'dialogPluginOverflow';
const getDialogInternalPluginMaxHeight = (scroll: 'body' | 'modal') =>
  scroll === 'body' ? 'fit-content' : '100%';
const getAlignItems = (scroll: 'body' | 'modal') => (scroll === 'body' ? 'baseline' : 'center');
const DIALOG_INTERNAL_PLUGIN_MAX_HEIGHT = 'dialogInternalPluginMaxHeight';
const DIALOG_INTERNAL_PLUGIN_ALIGN_ITEMS = 'dialogInternalPluginAlignItems';
const DIALOG_PLUGIN_WIDTH = 'dialogPluginWidth';

const getDialogPluginWidth = (scroll: 'body' | 'modal') =>
  scroll === 'body' ? '100%' : 'fit-content';

interface DialogCallbackInfo {
  open: boolean;
}

interface DialogEvents {
  willShow?: (info: DialogCallbackInfo) => void;
  show?: (info: DialogCallbackInfo) => void;
  didShow?: (info: DialogCallbackInfo) => void;
  willClose?: (info: DialogCallbackInfo) => void;
  closed?: (info: DialogCallbackInfo) => void;
  didClosed?: (info: DialogCallbackInfo) => void;
}

interface DialogItems {
  state?: { open: boolean };
  dialog?: HTMLDivElement | null;
  root?: any;
  modal?: any;
  previousActiveElement?: HTMLElement | null;
  previousBodyOverflow?: string;
}

interface DialogState {
  dialogItems: DialogItems;
  _events: DialogEvents;
}

interface DialogStorage extends Record<string, unknown> {
  dialog: DialogState;
}

interface DialogPluginOptions {
  id: string;
  modal: any;
  heading: string;
  fadeDuration?: number;
  fadeScale?: number;
  close?: 'outside-close' | 'close-action';
  scroll?: 'body' | 'modal';
  backdropColor?: string;
  describe?: string;
  offset?: string;
}

export function dialog(options: DialogPluginOptions) {
  const storage: DialogStorage = {
    dialog: {
      dialogItems: {},
      _events: {},
    },
  };

  const {
    modal,
    fadeDuration = 300,
    scroll = 'body',
    backdropColor = '#00000080',
    fadeScale = 0.9,
    describe,
    heading,
    close: closeMode = 'close-action',
    id,
    offset = '3em',
  } = options as DialogPluginOptions;

  function getState(): { open: boolean } {
    return storage.dialog.dialogItems.state || { open: false };
  }

  function callEvent(name: keyof DialogEvents) {
    const cb = storage.dialog._events[name];
    if (cb) {
      cb(getState());
    }
  }

  function onOverlayClick(e: MouseEvent) {
    if (closeMode !== 'outside-close') return;
    if (e.target === storage.dialog.dialogItems.dialog) {
      closeDialog();
    }
  }

  function trapFocus(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      const dialogEl = storage.dialog.dialogItems.dialog;
      if (!dialogEl) return;
      const focusableElements = Array.from(
        dialogEl.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ) as HTMLElement[];
      if (!focusableElements.length) return;
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  function handleEscKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (closeMode === 'outside-close') {
        closeDialog();
      }
    }
  }

  function show() {
    callEvent('willShow');
    if (storage.dialog.dialogItems.dialog) {
      throw new Error('[dialog plugin] already open');
    }
    storage.dialog.dialogItems.previousActiveElement = document.activeElement as HTMLElement;

    storage.dialog.dialogItems.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialogEl = document.createElement('div');
    dialogEl.classList.add('dialogPluginOverlay');
    dialogEl.style.setProperty(`--${DIALOG_PLUGIN_OVERFLOW}`, 'hidden');
    dialogEl.style.setProperty(`--${DIALOG_PLUGIN_FADE_DURATION}`, `${fadeDuration}ms`);
    dialogEl.style.setProperty(`--${DIALOG_PLUGIN_BACKDROP_COLOR}`, backdropColor);
    dialogEl.style.setProperty(`--${DIALOG_PLUGIN_FADE_SCALE}`, `scale(${fadeScale})`);
    dialogEl.style.setProperty(
      `--${DIALOG_INTERNAL_PLUGIN_MAX_HEIGHT}`,
      `${getDialogInternalPluginMaxHeight(scroll)}`
    );
    dialogEl.style.setProperty(
      `--${DIALOG_INTERNAL_PLUGIN_ALIGN_ITEMS}`,
      `${getAlignItems(scroll)}`
    );
    dialogEl.style.setProperty(`--${DIALOG_PLUGIN_SCROLL_BODY_PADDING}`, offset);

    dialogEl.style.setProperty(`--${DIALOG_PLUGIN_WIDTH}`, `${getDialogPluginWidth(scroll)}`);

    if (scroll === 'body') {
      dialogEl.classList.add('dialogPluginScrollBody');
    } else {
      dialogEl.classList.add('dialogPluginScrollModal');
    }

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('dialogPluginContent', 'dialogPluginContainer');
    contentDiv.role = 'dialog';
    contentDiv.tabIndex = -1;
    contentDiv.setAttribute('aria-modal', 'true');
    if (describe) {
      contentDiv.setAttribute('aria-describedby', `${id}-${describe}`);
    }
    contentDiv.setAttribute('aria-labelledby', `${id}-${heading}`);
    dialogEl.appendChild(contentDiv);

    document.body.appendChild(dialogEl);
    const root = createRoot(contentDiv);
    root.render(modal);

    requestAnimationFrame(() => {
      const headingSelector = `#${id}-${heading}`;
      const headingElement = contentDiv.querySelector(headingSelector);
      if (!headingElement) {
        console.warn(
          `[CSS-CTRL-WARN] Missing heading element in modal "${id}".\n\n` +
            `To ensure accessibility (A11y), add a heading like:\n` +
            `  <h1 id={dialogInstance.aria.heading.id}>Your Dialog Title</h1>\n\n` +
            `This allows screen readers to announce the dialog title via aria-labelledby.`
        );
      }
    });

    if (closeMode === 'outside-close') {
      dialogEl.addEventListener('click', onOverlayClick);
      dialogEl.addEventListener('keydown', handleEscKey);
    }
    dialogEl.addEventListener('keydown', trapFocus);

    storage.dialog.dialogItems.dialog = dialogEl;
    storage.dialog.dialogItems.root = root;
    storage.dialog.dialogItems.state = { open: true };

    callEvent('show');
    dialogEl.classList.add('dialogPluginOpen');
    callEvent('didShow');

    requestAnimationFrame(() => {
      const focusableElements = contentDiv.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else {
        contentDiv.focus();
      }
    });

    requestAnimationFrame(() => {
      dialogEl.scrollTo({
        top: 0,
      });
    });
  }

  function closeDialog() {
    callEvent('willClose');
    if (!storage.dialog.dialogItems.dialog) return;
    const dialogEl = storage.dialog.dialogItems.dialog;

    // ตรงนี้ ให้เอา document.body.style.overflow กลับออกก่อน
    // document.body.style.overflow = storage.dialog.dialogItems.previousBodyOverflow || '';

    if (closeMode === 'outside-close') {
      dialogEl.removeEventListener('click', onOverlayClick);
      dialogEl.removeEventListener('keydown', handleEscKey);
    }
    dialogEl.removeEventListener('keydown', trapFocus);

    dialogEl.classList.remove('dialogPluginOpen');
    dialogEl.classList.add('dialogPluginFadeOutClass');

    requestAnimationFrame(() => {
      dialogEl.addEventListener(
        'animationend',
        () => {
          // เมื่อ animation fadeout จบ ค่อยคืนค่า scroll ของ body
          document.body.style.overflow = storage.dialog.dialogItems.previousBodyOverflow || '';

          dialogEl.classList.remove('dialogPluginFadeOutClass');
          storage.dialog.dialogItems.state = { open: false };
          callEvent('closed');
          if (storage.dialog.dialogItems.root) {
            storage.dialog.dialogItems.root.unmount?.();
            storage.dialog.dialogItems.root = null;
          }
          if (dialogEl.parentNode) {
            dialogEl.parentNode.removeChild(dialogEl);
          }
          storage.dialog.dialogItems.dialog = null;
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

  return {
    action: {
      show,
      close,
      getState,
    },
    events,
    aria: {
      heading: {
        id: `${id}-${heading}`,
      },
      describe: {
        id: `${id}-${describe}`,
      },
    },
  };
}
