<!-- 1. @bind Runtime + Store Class in Externsion -->

-- theme.class`.. สร้าง global class name พร้อมใช้กับ @bind ได้ทุกที่`

- generate css to ctrl.theme.ts
- vscode extension
- @bind suggestion .class นั้น
- runtime
- เอา class มาใช้ได้โดยจะต้องมีการเช็คว่า class นั้นมีอยู่ภายใน css`` หรือไม่ ถ้ามีอยู่ก็คืน scope_class ถ้าไม่ ก็คืน class name ไปเฉยๆ

**how**
ให้ vscode extension จะจัดเก็บ theme.class ไว้เป็น object เอาไว้เช็คกับ @bind bindName .localClass .globalClass <-- ถ้า runtime ไม่สามารถหาเจอได้ว่า ภายในมี class .globalClass อยู่ก็ให้ return string "globalClass" ที่ไม่มี scope ออกไป

เมื่อ vscode extension เช็คแล้วว่า .globalClass มีอยู่ก็ให้ทำต่อ แต่ถ้าไม่มี .globalClass ก็ให้ throw error บอกว่า ไม่มี class นี้ให้ใช้งาน

---

<!-- 3. plugin css generation -->

```css

export const appcss = css<{ modal: [] }>`
  @scope app

  .box {

    option-active( ... ) generate เป็น --> .app_box.listboxPlugin-active {...css...}
    option-selected( ... ) generate เป็น --> .app_box.listboxPlugin-selected[aria-selected="true"] {...css...}
    option-unselected( ... ) generate เป็น --> .app_box.listboxPlugin-unselected[aria-selected="false"] {...css...}
    option-disabled( ... ) generate เป็น --> .app_box.listboxPlugin-disabled[aria-disabled="true"] {...css...}

    @query :option-active { generate เป็น --> .app_box .listboxPlugin-active {...css...}
    }

    @query :option-selected { generate เป็น --> .app_box .listboxPlugin-selected[aria-selected="true"] {...css...}
    }

    @query &:option-unselected { generate เป็น --> .app_box.listboxPlugin-unselected[aria-selected="false"] {...css...}
    }

    @query &:option-disabled { generate เป็น --> .app_box.listboxPlugin-disabled [aria-disabled="true"] {...css...}
    }

    /* เพิ่ม accordion */
    accordion-active( ... ) generate เป็น --> .app_box.accordionPlugin-active {...css...}
    accordion-expanded( ... ) generate เป็น --> .app_box.accordionPlugin-expanded[aria-expanded="true"] {...css...}
    accordion-collapsed( ... ) generate เป็น --> .app_box.accordionPlugin-collapsed[aria-expanded="false"] {...css...}
    accordion-disabled( ... ) generate เป็น --> .app_box.accordionPlugin-disabled[aria-disabled="true"] {...css...}

    @query :accordion-active { generate เป็น --> .app_box .accordionPlugin-active {...css...}
    }

    @query :accordion-expanded { generate เป็น --> .app_box .accordionPlugin-expanded[aria-expanded="true"] {...css...}
    }

    @query &:accordion-collapsed { generate เป็น --> .app_box.accordionPlugin-collapsed[aria-expanded="false"] {...css...}
    }

    @query &:accordion-disabled { generate เป็น --> .app_box.accordionPlugin-disabled[aria-disabled="true"] {...css...}
    }


    /* เพิ่ม container อื่นๆ (ใช้ใน query ไม่ได้)*/
    drawer-container()  generate เป็น --> .drawerPluginContainer:has(.app_box) {...}
    dialog-container()  generate เป็น --> .dialogPluginContainer:has(.app_box) {...}
    snackbar-container() generate เป็น --> .snackbarPluginContainer:has(.app_box) {...}
    popover-container() generate เป็น --> .popoverPluginContainer:has(.app_box) {...}
  }
`;
```

**more work**

- fix plugin : add doesn't exist classes
- suggestion psudo-function() and these psudo in @query

---

<!-- last work -->

## separate to @css-ctrl

- @css-ctrl/css
- @css-ctrl/theme
- @css-ctrl/plugin

<!-- Radar todo -->
<!-- 1. <parent และ >sibling -->

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

**more work**

- suggestion <parent || >sibling provider คือ พิมพ์ <จะมี "parent ขึ้นอัตโนมัติเป็น ghost text" (suggestion ได้ในเฉพาะภายใต้ class เท่านั้น)
- suggestion >sibling || >sibling provider คือ พิมพ์ <จะมี "sibling ขึ้นอัตโนมัติเป็น ghost text" (suggestion ได้ในเฉพาะภายใต้ class เท่านั้น)
- throw error เมื่อใช้ <parent || >sibling ใน @query
- throw error เมื่อใช้ <parent || >sibling ใน psudo-function()
- สามารถใช้ <parent || >sibling ใน ใน @const ได้ มันจะแปลงให้เองเหมือนพวก $variable

---
