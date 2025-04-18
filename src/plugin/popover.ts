import { CssCtrlPlugin } from './dialog';

export interface PopoverEvents {
  willShow?: (info: { open: boolean }) => void;
  show?: (info: { open: boolean }) => void;
  didShow?: (info: { open: boolean }) => void;
  willClose?: (info: { open: boolean }) => void;
  closed?: (info: { open: boolean }) => void;
  didClosed?: (info: { open: boolean }) => void;
}

interface PopoverState {
  open: boolean;
  containerEl?: HTMLElement;
  triggerEl?: HTMLElement | null;

  outsideClickHandler?: (evt: MouseEvent) => void;
  keydownHandler?: (evt: KeyboardEvent) => void;

  focusTrapCleanup?: () => void;
  scrollHandler?: () => void;
  resizeHandler?: () => void;

  _events?: PopoverEvents;
}

interface PopoverAPI {
  popover: {
    panel(jsx: any): any;
    events(handlers: PopoverEvents): void;
    actions: {
      show(e: any): void;
      close(e: any): void;
      closeAll(): void;
    };
    id: string;
  };
}

// เก็บ Popover API => สำหรับ closeAll
const popoverRegistry: PopoverAPI[] = [];

// ======================
// Trap focus
// ======================
function enableFocusTrap(el: HTMLElement): () => void {
  const handler = (evt: KeyboardEvent) => {
    if (evt.key === 'Tab') {
      const focusable = el.querySelectorAll<HTMLElement>(
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
  document.addEventListener('keydown', handler);
  return () => {
    document.removeEventListener('keydown', handler);
  };
}

// ======================
// ประกาศ Options
// ======================
export interface PopoverProperty {
  id: string;
  close?: 'outside-click' | 'close-action';
  trapFocus?: boolean;
  initialFocus?: string;

  // อนุญาต vertical,horizontal = undefined ได้
  anchorOrigin?: {
    vertical?: 'top' | 'center' | 'bottom' | undefined;
    horizontal?: 'left' | 'center' | 'right' | undefined;
  };
  transformOrigin?: {
    vertical?: 'top' | 'center' | 'bottom' | undefined;
    horizontal?: 'left' | 'center' | 'right' | undefined;
  };

  offsetX?: number;
  offsetY?: number;
  flip?: boolean;
  repositionOnScroll?: boolean;
  repositionOnResize?: boolean;
  strategy?: 'absolute' | 'fixed';

  // ARIA
  role?: string;
  ariaLabel?: string;
  ariaLabelledby?: string;
  ariaDescribedby?: string;
  toggleAriaExpanded?: boolean;
}

// ======================
// Compute anchor/transform
// ======================
function computeAnchorAndTransform(
  triggerRect: DOMRect,
  popRect: DOMRect,
  anchorOrigin: {
    vertical?: 'top' | 'center' | 'bottom' | undefined;
    horizontal?: 'left' | 'center' | 'right' | undefined;
  },
  transformOrigin: {
    vertical?: 'top' | 'center' | 'bottom' | undefined;
    horizontal?: 'left' | 'center' | 'right' | undefined;
  },
  offsetX: number,
  offsetY: number
) {
  // กำหนด default
  const aoV = anchorOrigin.vertical ?? 'bottom';
  const aoH = anchorOrigin.horizontal ?? 'left';

  const toV = transformOrigin.vertical ?? 'top';
  const toH = transformOrigin.horizontal ?? 'left';

  // 1) anchor point
  let yA = 0;
  if (aoV === 'top') {
    yA = triggerRect.top;
  } else if (aoV === 'center') {
    yA = (triggerRect.top + triggerRect.bottom) / 2;
  } else {
    // bottom
    yA = triggerRect.bottom;
  }

  let xA = 0;
  if (aoH === 'left') {
    xA = triggerRect.left;
  } else if (aoH === 'center') {
    xA = (triggerRect.left + triggerRect.right) / 2;
  } else {
    xA = triggerRect.right;
  }

  // 2) transform point
  const w = popRect.width;
  const h = popRect.height;

  const tv = toV === 'top' ? 0 : toV === 'center' ? h / 2 : h;
  const th = toH === 'left' ? 0 : toH === 'center' ? w / 2 : w;

  // 3) position
  const left = xA - th + offsetX;
  const top = yA - tv + offsetY;

  return { left, top };
}

// ======================
// flipCenterHorizontal
// ======================
function flipCenterHorizontal(
  anchor: { vertical?: 'top' | 'center' | 'bottom'; horizontal?: 'left' | 'center' | 'right' },
  transform: { vertical?: 'top' | 'center' | 'bottom'; horizontal?: 'left' | 'center' | 'right' },
  rect: DOMRect
) {
  const a = { ...anchor };
  const t = { ...transform };

  if (rect.left < 0 && a.horizontal === 'center') {
    a.horizontal = 'left';
    if (t.horizontal === 'center') {
      t.horizontal = 'left';
    }
  } else if (rect.right > window.innerWidth && a.horizontal === 'center') {
    a.horizontal = 'right';
    if (t.horizontal === 'center') {
      t.horizontal = 'right';
    }
  }
  return { anchorOrigin: a, transformOrigin: t };
}

// flipCenterVertical
function flipCenterVertical(
  anchor: { vertical?: 'top' | 'center' | 'bottom'; horizontal?: 'left' | 'center' | 'right' },
  transform: { vertical?: 'top' | 'center' | 'bottom'; horizontal?: 'left' | 'center' | 'right' },
  rect: DOMRect
) {
  const a = { ...anchor };
  const t = { ...transform };

  if (rect.top < 0 && a.vertical === 'center') {
    a.vertical = 'top';
    if (t.vertical === 'center') {
      t.vertical = 'top';
    }
  } else if (rect.bottom > window.innerHeight && a.vertical === 'center') {
    a.vertical = 'bottom';
    if (t.vertical === 'center') {
      t.vertical = 'bottom';
    }
  }
  return { anchorOrigin: a, transformOrigin: t };
}

function isOutOfViewport(r: DOMRect) {
  return r.left < 0 || r.right > window.innerWidth || r.top < 0 || r.bottom > window.innerHeight;
}

// ======================
// positionPopoverAutoFlip
// ======================
function positionPopoverAutoFlip(
  triggerEl: HTMLElement,
  containerEl: HTMLElement,
  anchorOrigin: {
    vertical?: 'top' | 'center' | 'bottom';
    horizontal?: 'left' | 'center' | 'right';
  },
  transformOrigin: {
    vertical?: 'top' | 'center' | 'bottom';
    horizontal?: 'left' | 'center' | 'right';
  },
  offsetX: number,
  offsetY: number,
  flip: boolean | undefined,
  strategy: 'absolute' | 'fixed' | undefined
) {
  containerEl.style.position = strategy || 'absolute';

  // ตัวฟังก์ชันนี้ return void - flip logic
  function doPosition(
    aOri: { vertical?: 'top' | 'center' | 'bottom'; horizontal?: 'left' | 'center' | 'right' },
    tOri: { vertical?: 'top' | 'center' | 'bottom'; horizontal?: 'left' | 'center' | 'right' }
  ) {
    const triggerRect = triggerEl.getBoundingClientRect();
    const popRect = containerEl.getBoundingClientRect();
    const scrollX = strategy === 'fixed' ? 0 : window.scrollX;
    const scrollY = strategy === 'fixed' ? 0 : window.scrollY;

    const { left, top } = computeAnchorAndTransform(
      triggerRect,
      popRect,
      aOri,
      tOri,
      offsetX,
      offsetY
    );
    containerEl.style.left = `${left + scrollX}px`;
    containerEl.style.top = `${top + scrollY}px`;

    return containerEl.getBoundingClientRect();
  }

  // 1) วางครั้งแรก
  let rect = doPosition(anchorOrigin, transformOrigin);
  if (!flip) return;

  if (!isOutOfViewport(rect)) return;

  // 2) flip center horizontal/vertical
  let { anchorOrigin: a2, transformOrigin: t2 } = flipCenterHorizontal(
    anchorOrigin,
    transformOrigin,
    rect
  );
  ({ anchorOrigin: a2, transformOrigin: t2 } = flipCenterVertical(a2, t2, rect));
  rect = doPosition(a2, t2);
  if (!isOutOfViewport(rect)) return;

  // 3) flip standard top<->bottom / left<->right
  rect = doFlipStandard(a2, t2);

  function doFlipStandard(
    aOri: { vertical?: 'top' | 'center' | 'bottom'; horizontal?: 'left' | 'center' | 'right' },
    tOri: { vertical?: 'top' | 'center' | 'bottom'; horizontal?: 'left' | 'center' | 'right' }
  ) {
    const aTmp = { ...aOri };
    const tTmp = { ...tOri };

    // flip vertical
    if (rect.bottom > window.innerHeight && aTmp.vertical === 'bottom') {
      aTmp.vertical = 'top';
      if (tTmp.vertical === 'top') {
        tTmp.vertical = 'bottom';
      }
    } else if (rect.top < 0 && aTmp.vertical === 'top') {
      aTmp.vertical = 'bottom';
      if (tTmp.vertical === 'bottom') {
        tTmp.vertical = 'top';
      }
    }

    // flip horizontal
    if (rect.right > window.innerWidth && aTmp.horizontal === 'right') {
      aTmp.horizontal = 'left';
      if (tTmp.horizontal === 'left') {
        tTmp.horizontal = 'right';
      }
    } else if (rect.left < 0 && aTmp.horizontal === 'left') {
      aTmp.horizontal = 'right';
      if (tTmp.horizontal === 'right') {
        tTmp.horizontal = 'left';
      }
    }

    return doPosition(aTmp, tTmp);
  }
}

// ======================
// ส่วนหลัก: popover(...)
// ======================
export function popover(options: PopoverProperty): CssCtrlPlugin<PopoverAPI> {
  const {
    id,
    close = 'close-action',
    trapFocus = true,
    initialFocus,

    anchorOrigin = { vertical: 'bottom', horizontal: 'left' },
    transformOrigin = { vertical: 'top', horizontal: 'left' },
    offsetX = 0,
    offsetY = 0,
    flip = true,
    repositionOnScroll = true,
    repositionOnResize = true,
    strategy = 'absolute',

    // ARIA
    role = 'dialog',
    ariaLabel,
    ariaLabelledby,
    ariaDescribedby,
    toggleAriaExpanded = true,
  } = options;

  // เนื้อหา
  return (storage: Record<string, any>) => {
    // popoverState
    if (!storage.popover) {
      storage.popover = {} as PopoverState;
    }
    const popoverState = storage.popover as PopoverState;

    if (!popoverState._events) {
      popoverState._events = {};
    }

    popoverState.open = false;

    const api: PopoverAPI = {
      popover: {
        panel(jsx: any) {
          let container = document.getElementById(id);
          if (!container) {
            container = document.createElement('div');
            container.id = id;
            container.setAttribute('hidden', '');
            container.setAttribute('role', role);
            container.setAttribute('aria-modal', 'false');
            if (ariaLabel) {
              container.setAttribute('aria-label', ariaLabel);
            }
            if (ariaLabelledby) {
              container.setAttribute('aria-labelledby', ariaLabelledby);
            }
            if (ariaDescribedby) {
              container.setAttribute('aria-describedby', ariaDescribedby);
            }

            container.tabIndex = -1;
            container.classList.add('popoverPlugin');
            document.body.appendChild(container);
          }

          popoverState.containerEl = container;

          if (!storage.plugin?.react?.createPortal) {
            throw new Error(
              `[CSS-CTRL-ERR] theme.plugin({ react: {createPortal} }) must be set before using popover.`
            );
          }
          return storage.plugin.react.createPortal(jsx, container);
        },

        events(handlers: PopoverEvents) {
          popoverState._events = {
            willShow: handlers.willShow,
            show: handlers.show,
            didShow: handlers.didShow,
            willClose: handlers.willClose,
            closed: handlers.closed,
            didClosed: handlers.didClosed,
          };
        },

        actions: {
          show(e: any) {
            if (popoverState.open) return;
            popoverState.open = true;

            const container = popoverState.containerEl;
            if (!container) {
              throw new Error(`[popover] containerEl not found.`);
            }

            popoverState._events?.willShow?.({ open: true });

            popoverState.triggerEl = e?.currentTarget || e?.target || null;

            container.hidden = false;
            container.classList.remove('popoverPluginFadeOutClass');
            container.classList.add('popoverPluginFadeInClass');

            if (toggleAriaExpanded && popoverState.triggerEl instanceof HTMLElement) {
              popoverState.triggerEl.setAttribute('aria-expanded', 'true');
              popoverState.triggerEl.setAttribute(
                'aria-haspopup',
                role === 'dialog' ? 'dialog' : 'menu'
              );
              popoverState.triggerEl.setAttribute('aria-controls', container.id);
            }

            if (close === 'outside-click') {
              setTimeout(() => {
                popoverState.outsideClickHandler = (evt: MouseEvent) => {
                  if (!container?.contains(evt.target as Node)) {
                    api.popover.actions.close(evt);
                  }
                };
                document.addEventListener('click', popoverState.outsideClickHandler);
              }, 0);
            }

            popoverState.keydownHandler = (evt: KeyboardEvent) => {
              if (evt.key === 'Escape') {
                api.popover.actions.close(evt);
              }
            };
            document.addEventListener('keydown', popoverState.keydownHandler);

            if (trapFocus) {
              popoverState.focusTrapCleanup = enableFocusTrap(container);
            }

            if (popoverState.triggerEl instanceof HTMLElement) {
              const reposition = () => {
                positionPopoverAutoFlip(
                  popoverState.triggerEl!,
                  container,
                  anchorOrigin,
                  transformOrigin,
                  offsetX,
                  offsetY,
                  flip,
                  strategy
                );
              };
              if (repositionOnScroll) {
                popoverState.scrollHandler = reposition;
                window.addEventListener('scroll', popoverState.scrollHandler, true);
              }
              if (repositionOnResize) {
                popoverState.resizeHandler = reposition;
                window.addEventListener('resize', popoverState.resizeHandler);
              }
            }

            requestAnimationFrame(() => {
              if (popoverState.triggerEl instanceof HTMLElement) {
                positionPopoverAutoFlip(
                  popoverState.triggerEl,
                  container,
                  anchorOrigin,
                  transformOrigin,
                  offsetX,
                  offsetY,
                  flip,
                  strategy
                );
              }

              if (initialFocus) {
                const el = container.querySelector<HTMLElement>(initialFocus);
                if (el) el.focus();
                else container.focus();
              } else {
                container.focus();
              }

              popoverState._events?.show?.({ open: true });
              requestAnimationFrame(() => {
                popoverState._events?.didShow?.({ open: true });
              });
            });
          },

          close(e: any) {
            if (!popoverState.open) return;
            popoverState.open = false;

            const container = popoverState.containerEl;
            if (!container) return;

            popoverState._events?.willClose?.({ open: false });

            if (toggleAriaExpanded && popoverState.triggerEl instanceof HTMLElement) {
              popoverState.triggerEl.setAttribute('aria-expanded', 'false');
            }

            if (popoverState.outsideClickHandler) {
              document.removeEventListener('click', popoverState.outsideClickHandler);
              popoverState.outsideClickHandler = undefined;
            }
            if (popoverState.keydownHandler) {
              document.removeEventListener('keydown', popoverState.keydownHandler);
              popoverState.keydownHandler = undefined;
            }

            if (popoverState.focusTrapCleanup) {
              popoverState.focusTrapCleanup();
              popoverState.focusTrapCleanup = undefined;
            }

            if (popoverState.scrollHandler) {
              window.removeEventListener('scroll', popoverState.scrollHandler, true);
              popoverState.scrollHandler = undefined;
            }
            if (popoverState.resizeHandler) {
              window.removeEventListener('resize', popoverState.resizeHandler);
              popoverState.resizeHandler = undefined;
            }

            container.classList.remove('popoverPluginFadeInClass');
            container.classList.add('popoverPluginFadeOutClass');
            container.addEventListener(
              'animationend',
              () => {
                container.hidden = true;
                container.classList.remove('popoverPluginFadeOutClass');

                if (popoverState.triggerEl instanceof HTMLElement) {
                  popoverState.triggerEl.focus();
                }
                popoverState._events?.closed?.({ open: false });
                popoverState._events?.didClosed?.({ open: false });
              },
              { once: true }
            );
          },

          closeAll() {
            popoverRegistry.forEach((apiItem) => {
              apiItem.popover.actions.close(null);
            });
          },
        },

        id,
      },
    };

    if (!popoverRegistry.includes(api)) {
      popoverRegistry.push(api);
    }
    return api;
  };
}
