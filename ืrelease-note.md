-- theme.class`
.. สร้าง global class name พร้อมใช้กับ @bind ได้ทุกที่

- @bind ต่อไปนี้จะไม่ถูกนำไปอยู่ข้างบนสุดของ css`` อีกต่อไป มันจะถูกใช้งานแบบนี้แทน

@bind wrap .box .highlight <-- เมื่อ format มันจะถูกนำมาอยู่ข้างบนของ class ที่มีการใช้งานมันก่อน case นี้ คือ .box
.box {
bg[red]
}
`

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

export const appcss = css<{ modal: [] }>`
  @scope app

  .box {

    /* เพิ่ม listbox */
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

    /* เพิ่ม container อื่นๆ */
    drawer-container()  <-- .drawerPluginContainer:has(.app_box) {...}
    dialog-container()  <-- .dialogPluginContainer:has(.app_box) {...}
    snackbar-container() <-- .snackbarPluginContainer:has(.app_box) {...}
    popover-container() <-- .popoverPluginContainer:has(.app_box) {...}
  }
`;

```
