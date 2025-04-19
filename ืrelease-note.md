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

---

```css

export const amodalcss = css<{ modal: [] }>`
  @scope app

  .box {

    option-active( ... ) <-- .app_box.listboxPlugin-optionActive {css}
    option-selected( ... ) <-- .app_box[aria-selected="true"] {css}
    option-unselected( ... ) <-- .app_box[aria-selected="false"] {css}
    option-disabled( ... ) <-- .app_box[aria-disabled="true"] {css}

    @query :option-active { <-- .app_box .listboxPlugin-optionActive {css}
    }

    @query :option-selected { <-- .app_box [aria-selected="true"] {css}
    }

    @query &:option-unselected { <-- .app_box [aria-selected="false"] {css}
    }

    @query &:option-disabled { <-- .app_box [aria-disabled="true"] {css}
    }

  }
`;

```

---

เพิิ่ม
willFocus
focused
didFocused

willLoad
loaded
didLoaded

เพิ่ม listbox.actions.searchItem("data value", "substring-match" | "startsWith-match" | "fuzzy-search")
