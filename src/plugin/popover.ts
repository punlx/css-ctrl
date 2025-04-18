// popover.ts

import { CssCtrlPlugin } from './dialogPlugin';

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

// registry เก็บ popover API => เอาไว้ closeAll
const popoverRegistry: PopoverAPI[] = [];

// ฟังก์ชันโฟกัส trap
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

  // anchor/transform origin
  anchorOrigin?: {
    vertical: 'top' | 'center' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
  transformOrigin?: {
    vertical: 'top' | 'center' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };

  // offset
  offsetX?: number;
  offsetY?: number;

  // flip => ถ้าวางแล้วหลุดจอ => พยายาม flip
  flip?: boolean;

  // reposition on scroll/resize
  repositionOnScroll?: boolean;
  repositionOnResize?: boolean;

  // ใช้ position absolute/fixed
  strategy?: 'absolute' | 'fixed';
}

// ======================
// ฟังก์ชันคำนวณ anchor/transform
// ======================
function computeAnchorAndTransform(
  triggerRect: DOMRect,
  popRect: DOMRect,
  anchorOrigin: PopoverProperty['anchorOrigin'],
  transformOrigin: PopoverProperty['transformOrigin'],
  offsetX: number,
  offsetY: number
) {
  const aoV = anchorOrigin?.vertical || 'bottom';
  const aoH = anchorOrigin?.horizontal || 'left';

  const toV = transformOrigin?.vertical || 'top';
  const toH = transformOrigin?.horizontal || 'left';

  // 1) anchor point
  let xA = 0;
  let yA = 0;

  if (aoV === 'top') {
    yA = triggerRect.top;
  } else if (aoV === 'center') {
    yA = (triggerRect.top + triggerRect.bottom) / 2;
  } else {
    // 'bottom'
    yA = triggerRect.bottom;
  }

  if (aoH === 'left') {
    xA = triggerRect.left;
  } else if (aoH === 'center') {
    xA = (triggerRect.left + triggerRect.right) / 2;
  } else {
    // 'right'
    xA = triggerRect.right;
  }

  // 2) transform point
  const w = popRect.width;
  const h = popRect.height;

  let xT = 0;
  let yT = 0;

  if (toV === 'top') {
    yT = 0;
  } else if (toV === 'center') {
    yT = h / 2;
  } else {
    // 'bottom'
    yT = h;
  }

  if (toH === 'left') {
    xT = 0;
  } else if (toH === 'center') {
    xT = w / 2;
  } else {
    // 'right'
    xT = w;
  }

  // 3) position = anchor - transform + offset
  let left = xA - xT + offsetX;
  let top = yA - yT + offsetY;

  return { left, top };
}

// ======================
// ฟังก์ชัน flipCenter: ถ้า anchor/transform horizontal='center' แต่ล้น => โปรโมตเป็น 'left' หรือ 'right'
// ======================
function flipCenterHorizontal(
  anchor: PopoverProperty['anchorOrigin'],
  transform: PopoverProperty['transformOrigin'],
  rect: DOMRect
) {
  // shallow copy
  const a = { ...anchor };
  const t = { ...transform };

  // ถ้า rect.left < 0 => แสดงว่าล้นซ้าย => ให้ popover ไปทาง left
  //   => anchorOrigin.horizontal='left', transformOrigin.horizontal='left'
  // ถ้า rect.right > window.innerWidth => => anchorOrigin.horizontal='right', transformOrigin.horizontal='right'
  // เลือกอันที่เหลือพื้นที่มากกว่า หรือใช้ตรรกะง่าย ๆ
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

function flipCenterVertical(
  anchor: PopoverProperty['anchorOrigin'],
  transform: PopoverProperty['transformOrigin'],
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
// - ถ้าวางครั้งแรกแล้วล้น
// - ถ้า anchor/transform horizontal/vertical = 'center' => โปรโมต 'left'/'right' หรือ 'top'/'bottom'
// - ลอง flip top<->bottom, left<->right ถ้ายังล้นอีก
// ======================
function positionPopoverAutoFlip(
  triggerEl: HTMLElement,
  containerEl: HTMLElement,
  anchorOrigin: PopoverProperty['anchorOrigin'],
  transformOrigin: PopoverProperty['transformOrigin'],
  offsetX: number,
  offsetY: number,
  flip: boolean,
  strategy: PopoverProperty['strategy']
) {
  containerEl.style.position = strategy || 'absolute';

  function doPosition(
    aOri: PopoverProperty['anchorOrigin'],
    tOri: PopoverProperty['transformOrigin']
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
  if (!flip) return; // ถ้าไม่ flip => จบ

  if (!isOutOfViewport(rect)) return; // ไม่หลุด => จบ

  // 2) ถ้าหลุด => flip center horizontal/vertical ก่อน
  let { anchorOrigin: a2, transformOrigin: t2 } = flipCenterHorizontal(
    anchorOrigin,
    transformOrigin,
    rect
  );
  ({ anchorOrigin: a2, transformOrigin: t2 } = flipCenterVertical(a2, t2, rect));
  rect = doPosition(a2, t2);

  if (!isOutOfViewport(rect)) return; // สำเร็จ => จบ

  // 3) ถ้ายังหลุด => flip top/bottom, left/right แบบเดิม (เหมือน code เก่าก่อน)
  //   หรือจะ implement ต่อได้ เช่น
  rect = doFlipStandard(a2, t2);

  // doFlipStandard = logic เดิมที่ flip top <-> bottom, left <-> right
  // ตัวอย่างสั้น ๆ:
  function doFlipStandard(
    aOri: PopoverProperty['anchorOrigin'],
    tOri: PopoverProperty['transformOrigin']
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

  // ได้ rect ใหม่ => ไม่ทำอะไรต่อ ถ้ายังหลุด => user อาจต้องปรับ
}

// ======================
// ตัว plugin หลัก
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
  } = options;

  return (storage: Record<string, any>) => {
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
            container.setAttribute('role', 'dialog');
            container.setAttribute('aria-modal', 'false');
            container.tabIndex = -1;
            container.classList.add('popoverPlugin');
            document.body.appendChild(container);
          }

          popoverState.containerEl = container;

          if (!storage.plugin?.react?.createPortal) {
            throw new Error(
              `[CSS-CTRL-ERR] theme.plugin({ react: { createPortal } }) must be set before using popover.`
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
              throw new Error(`[popover] containerEl not found. Did you call .panel(...)?`);
            }

            popoverState._events?.willShow?.({ open: true });
            popoverState.triggerEl = e?.currentTarget || e?.target || null;

            // เปิด popover
            container.hidden = false;
            container.classList.remove('popoverPluginFadeOutClass');
            container.classList.add('popoverPluginFadeInClass');

            // outside-click
            if (close === 'outside-click') {
              setTimeout(() => {
                popoverState.outsideClickHandler = (evt: MouseEvent) => {
                  if (!container.contains(evt.target as Node)) {
                    api.popover.actions.close(evt);
                  }
                };
                document.addEventListener('click', popoverState.outsideClickHandler);
              }, 0);
            }

            // ESC
            popoverState.keydownHandler = (evt: KeyboardEvent) => {
              if (evt.key === 'Escape') {
                api.popover.actions.close(evt);
              }
            };
            document.addEventListener('keydown', popoverState.keydownHandler);

            // focus trap
            if (trapFocus) {
              popoverState.focusTrapCleanup = enableFocusTrap(container);
            }

            // ถ้าต้อง repositionOnScroll/resize
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

            // วางตำแหน่ง + flip
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

            // ถอน listener
            if (popoverState.outsideClickHandler) {
              document.removeEventListener('click', popoverState.outsideClickHandler);
              popoverState.outsideClickHandler = undefined;
            }
            if (popoverState.keydownHandler) {
              document.removeEventListener('keydown', popoverState.keydownHandler);
              popoverState.keydownHandler = undefined;
            }

            // focus trap
            if (popoverState.focusTrapCleanup) {
              popoverState.focusTrapCleanup();
              popoverState.focusTrapCleanup = undefined;
            }

            // scroll/resize
            if (popoverState.scrollHandler) {
              window.removeEventListener('scroll', popoverState.scrollHandler, true);
              popoverState.scrollHandler = undefined;
            }
            if (popoverState.resizeHandler) {
              window.removeEventListener('resize', popoverState.resizeHandler);
              popoverState.resizeHandler = undefined;
            }

            // fadeOut
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
