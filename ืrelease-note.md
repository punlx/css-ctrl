

-- theme.class`
.. สร้าง global class name พร้อมใช้กับ @bind ได้ทุกที่

- @bind ต่อไปนี้จะไม่ถูกนำไปอยู่ข้างบนสุดของ css`` อีกต่อไป มันจะถูกใช้งานแบบนี้แทน

@bind wrap .box .highlight <-- เมื่อ format มันจะถูกนำมาอยู่ข้างบนของ class ที่มีการใช้งานมันก่อน case นี้ คือ .box
.box {
bg[red]
}
`

---

ถ้ามีการกำหนด theme.plugin({
react: {createRoot}
})

ให้ generate css แบบนั้นใน css-ctrl.theme.css ด้วย

```css
dialog:-internal-dialog-in-top-layer {
  max-width: 100%;
  max-height: var(--dialogInternalPluginMaxHeight);
}

dialog {
  position: absolute;
  display: flex;
  justify-content: center;
  width: var(--dialogPluginWidth);
  background-color: transparent;
  border-style: none;
  padding: 0;
}

dialog[open] {
  opacity: 0;
  transform: var(--dialogPluginFadeScale);
  animation: dialogPluginFadeIn var(--dialogPluginFadeDuration) ease-out forwards;
}

dialog.dialogPluginFadeOutClass {
  animation: dialogPluginFadeOut var(--dialogPluginFadeDuration) ease-in forwards;
}

@keyframes dialogPluginFadeIn {
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes dialogPluginFadeOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: var(--dialogPluginFadeScale);
  }
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #1e1e1e; /* สีพื้นหลังของ scrollbar track */
}

::-webkit-scrollbar-thumb {
  background-color: #555; /* สีของแท่ง scrollbar */
  border-radius: 4px;
  border: 2px solid #1e1e1e; /* ขอบให้เข้ากับ track */
}

::-webkit-scrollbar-thumb:hover {
  background-color: #777;
}

dialog[open]::backdrop {
  animation: dialogPluginFadeBackdropIn var(--dialogPluginFadeDuration) ease-out forwards;
}

dialog.dialogPluginFadeOutClass::backdrop {
  animation: dialogPluginFadeBackdropOut var(--dialogPluginFadeDuration) ease-in forwards;
}

@keyframes dialogPluginFadeBackdropIn {
  from {
    background-color: rgba(0, 0, 0, 0);
  }
  to {
    background-color: var(--dialogPluginBackdropColor);
  }
}

@keyframes dialogPluginFadeBackdropOut {
  from {
    background-color: var(--dialogPluginBackdropColor);
  }
  to {
    background-color: rgba(0, 0, 0, 0);
  }
}
```

---

```css
.box {
  <parent div { <-- ใช้ได้ภายใต้ .box เท่านั้นไม่สามารถใช้ได้ใน @query
  }

  -- > จะได้ div:has(.app_box) {
    ...
  }

  >sibling div { <-- ใช้ได้ภายใต้ .box เท่านั้นไม่สามารถใช้ได้ใน @query
  }

  -- > จะได้ .app_box + div {
    ...
  }
}
```

---

```css
@keyframe move {
  0%(bg[red])
  50%(bg[red])
  100%(bg[red])
}

.box {
  am[<-- suggestion move]
}
```



----
popover.ts keep


// src/plugin/popover.ts

interface PopoverProperty {
  id: string;
  close?: 'outside-click' | 'close-action';
  trapFocus?: boolean;
  fadeDuration?: number;
}

// ขยาย storage.popover เป็นรูปแบบ object
export const popover = (options: PopoverProperty) => {
  // อ่านค่าจาก options
  const {
    id,
    close = 'close-action', // default
    trapFocus = false,
    fadeDuration = 300,
  } = options;

  return (storage, className) => {
    if (!storage.popover) {
      storage.popover = {};
    }

    if (!storage.popover.containerEl) {
      storage.popover.containerEl = {};
    }

    // เพิ่มตัวแปรไว้เก็บ reference
    storage.popover.lastActiveElement = null;

    // ฟังก์ชัน helper: จัดการ focus trap
    function handleKeydown(e: KeyboardEvent) {
      if (!storage.popover.containerEl) return;
      const containerEl = storage.popover.containerEl as HTMLElement;
      // ถ้า Esc => close
      if (e.key === 'Escape') {
        e.preventDefault();
        actions.close(e);
      }
      // ถ้า Tab => trapFocus
      if (e.key === 'Tab') {
        // หา focusable elements
        const focusables = Array.from(
          containerEl.querySelectorAll(
            'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
          )
        ) as HTMLElement[];
        if (focusables.length === 0) {
          e.preventDefault();
          containerEl.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const current = document.activeElement;
        if (!e.shiftKey && current === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && current === first) {
          e.preventDefault();
          last.focus();
        }
      }
    }

    // ฟังก์ชัน helper: คลิกนอก => ปิด
    function handleDocClick(e: MouseEvent) {
      if (!storage.popover.containerEl) return;
      const containerEl = storage.popover.containerEl as HTMLElement;
      if (!containerEl.contains(e.target as Node)) {
        actions.close(e);
      }
    }

    // สร้างชุด action
    const actions = {
      show: (e: any) => {
        if (!storage.popover.containerEl) return;
        const containerEl = storage.popover.containerEl as HTMLElement;

        // บันทึก element ที่โฟกัสอยู่ก่อน
        storage.popover.lastActiveElement = document.activeElement;

        // ใส่ animation duration ลง style inline หรือ doc
        containerEl.style.setProperty('--popoverOpacity', `1`);

        // ถ้า close==='outside-click' => ผูก doc click
        if (close === 'outside-click') {
          document.addEventListener('mousedown', handleDocClick);
        }

        // ถ้า trapFocus => ผูก keydown
        if (trapFocus) {
          containerEl.addEventListener('keydown', handleKeydown);
          // initial focus
          setTimeout(() => {
            // ถ้าพบ element ที่โฟกัสได้ => โฟกัส, ไม่งั้น focus containerEl
            const focusable = containerEl.querySelector(
              'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
            ) as HTMLElement;
            if (focusable) {
              focusable.focus();
            } else {
              containerEl.focus();
            }
          }, 0);
        }
      },
      close: (e: any) => {
        console.log('popover.ts:63 |e| : ', e);
        if (!storage.popover.containerEl) return;
        const containerEl = storage.popover.containerEl as HTMLElement;

        // เอา doc click ออก
        if (close === 'outside-click') {
          document.removeEventListener('mousedown', handleDocClick);
        }
        // เอา keydown ออก
        if (trapFocus) {
          containerEl.removeEventListener('keydown', handleKeydown);
        }
        containerEl.style.setProperty('--popoverOpacity', `0`);

        // คืนโฟกัส
        if (storage.popover.lastActiveElement instanceof HTMLElement) {
          storage.popover.lastActiveElement.focus();
        }
        storage.popover.lastActiveElement = null;
      },
    };

    return {
      popover: {
        panel: (jsx: any) => {
          if (!jsx) {
            throw new Error(`ให้บอกว่า จะต้องมีการกำหนด jsx ก่อนเท่านั้น`);
          }

          // ตรวจสอบว่ามี div เดิมอยู่ใน DOM แล้วหรือยัง
          const existing = document.getElementById(id);

          const container =
            existing ??
            (() => {
              const containerEl = document.createElement('div');
              containerEl.id = id;
              containerEl.setAttribute('role', 'dialog');
              containerEl.setAttribute('aria-modal', 'false');
              containerEl.tabIndex = -1;
              containerEl.classList.add('popoverPluginFade');
              containerEl.style.setProperty('--popoverFadeDuration', `${fadeDuration}ms`);
              containerEl.style.setProperty('--popoverOpacity', `0`);

              document.body.appendChild(containerEl);
              storage.popover.containerEl = containerEl;
              return containerEl;
            })();

          return storage.plugin.react.createPortal(jsx, container);
        },
        events: () => {},
        actions,
        id,
      },
    };
  };
};
