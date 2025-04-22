// tabs-improved.ts
// Production-ready code (ไม่มีการข้ามบรรทัดหรือข้าม logic)
// -------------------------------------------------------------
//
// Tabs Plugin (Uncontrolled mode) + JavaScript Event Delegation + ARIA + Keyboard Navigation
// ปรับปรุงเพิ่มเติม:
//   1) รองรับ multiple mode แบบ toggle (กดซ้ำเพื่อปิด tab)
//   2) แก้ปัญหา defaultActive + disabled (ข้าม tab ที่ disabled ไม่ให้เป็น active)
//   3) เก็บ lastFocusKey เพื่อให้ next()/prev() ทำงานถูกต้องใน multiple mode
//   4) ชี้แจง animationDuration ใช้เป็น reference ยังไม่มีการ animate ภายใน plugin
//   5) closeTab ใน multiple mode ยัง remove ออกจาก itemsMap เช่นเดิม (เหมือน antd closable)
//
// ยังใช้โครงสร้างเหมือน plugin อื่น (accordion, dialog, etc.):
//   const tabsA = tabs({ controls: 'myTab', multiple: true });
//   tabsA.container({ ref: containerEl, data: [...] });
//   tabsA.events({ ... });
//   tabsA.actions.select('tab2'); // หรือ toggle('tab2');
//   ...
//
// Dev จะ render DOM เอง โดย map data =>
//     <div {...tabsA.aria.trigger(item.key)}>...</div>
//     <div {...tabsA.aria.panel(item.key)}>...</div>
//
// จุดสำคัญ:
//   - ถ้า multiple=true => plugin จะ auto toggle tab เดิมถ้าถูกคลิกซ้ำ
//   - ถ้า defaultActive = true แต่ disabled => ไม่ให้ set active
//   - รักษา lastFocusKey สำหรับ keyboard nav ใน multiple mode
//   - closeTab => ลบออกจาก itemsMap + activeSet (ถ้าอยู่)
//   - animationDuration => Dev ใช้เป็น ref ถ้าจะ animate เอง

// -------------------------------------------------------------
// ประกาศ interface ต่าง ๆ
// -------------------------------------------------------------

/** Options หลักที่ใช้ตอนสร้าง instance ของ tabs(...) */
export interface TabsPluginOptions {
  /** ใช้เป็น prefix/identifier สำหรับ aria-controls, aria-labelledby, etc. */
  controls: string;
  /** orientation ของ tab: horizontal (default) หรือ vertical */
  orientation?: 'horizontal' | 'vertical';
  /** โหมด activate tab อัตโนมัติเมื่อ focus (auto) หรือ manual (กด Enter/Space) */
  activation?: 'auto' | 'manual';
  /** เปิด/ปิด keyboard navigation */
  keyboard?: boolean;
  /** อนุญาตให้เปิดหลาย tab พร้อมกันได้หรือไม่ (default=false) */
  multiple?: boolean;
  /** อนุญาตให้ tab closable (เช่นปุ่ม x ปิด tab) หรือไม่ (default=false) */
  closeable?: boolean;
  /** render panel เฉพาะเมื่อ tab ถูกเปิดครั้งแรก (ช่วย performance) */
  lazyRender?: boolean;
  /** ระยะเวลา animation (ms) ถ้าจะใช้ animate (plugin ไม่ได้ใช้ภายใน) */
  animationDuration?: number;
}

/** โครงสร้างของ item ใน tab */
export interface TabItem {
  /** unique key ของ tab */
  key: string;
  /** label หรือ title ของ tab (อาจเป็น string หรือ ReactNode ก็ได้) */
  label?: any;
  /** content ของ tab panel (อาจเป็น ReactNode) */
  content?: any;
  /** ถ้าอยากให้ tab นี้เปิดตั้งแต่แรก */
  defaultActive?: boolean;
  /** ถ้า tab นี้ไม่ให้กด => disabled */
  disabled?: boolean;
  /** ถ้าต้องการให้ปิด tab ได้ (เฉพาะเมื่อ closeable=true) */
  closable?: boolean;
}

/** ข้อมูลที่ส่งเข้า event callbacks */
export interface TabEventInfo {
  /** key ของ tab ที่เกี่ยวข้อง (ถ้ากด select tab) */
  key: string;
  /** previousKey ถ้ามี (เปลี่ยนจาก tab เก่า) */
  previousKey?: string | null;
  /** target DOM ที่เกี่ยวข้อง (เช่น heading หรือ panel) */
  target?: {
    trigger?: HTMLElement;
    panel?: HTMLElement;
  };
}

/** Events หลักใน lifecycle */
export interface TabsPluginEvents {
  willChangeTab?: (info: TabEventInfo) => void;
  changeTab?: (info: TabEventInfo) => void;
  didChangeTab?: (info: TabEventInfo) => void;

  /** กรณี dev คลิก tab เดิมซ้ำ => reSelect */
  reSelect?: (info: TabEventInfo) => void;

  /** ถ้ารองรับ closable tab => event เหล่านี้ */
  willCloseTab?: (info: TabEventInfo) => void;
  closeTab?: (info: TabEventInfo) => void;
  didCloseTab?: (info: TabEventInfo) => void;
}

// -------------------------------------------------------------
// ประกาศโครงสร้างภายใน (storage) ของ plugin
// -------------------------------------------------------------
interface TabsStorage {
  /** เก็บข้อมูล tab ทั้งหมด (key => TabItem) */
  itemsMap: Map<string, TabItem>;
  /** ถ้า multiple=false => activeKey (string) แต่ถ้า multiple=true => activeSet (Set<string>) */
  activeKey: string | null;
  activeSet: Set<string>;
  /** lazyRender => เก็บ tab ไหนเคยเปิดแล้วบ้าง */
  loadedSet: Set<string>;
  /** options ที่รับมา */
  options: TabsPluginOptions;
  /** events callback */
  _events: TabsPluginEvents;
  /** DOM หลัก (role="tablist") */
  containerEl?: HTMLElement | null;
  /** orientation = 'horizontal'|'vertical' */
  orientation: 'horizontal' | 'vertical';
  /** activation = 'auto'|'manual' */
  activation: 'auto' | 'manual';
  /** keyboard enabled? */
  keyboard: boolean;
  /**
   * เก็บ key ของ tab ที่โฟกัสล่าสุด (สำหรับ multiple mode)
   * ใช้ใน next()/prev() -> ถ้า multiple => เอาค่า lastFocusKey เป็น reference
   */
  lastFocusKey: string | null;
}

// -------------------------------------------------------------
// ฟังก์ชันหลัก tabs(...)
// -------------------------------------------------------------
export function tabs(options: TabsPluginOptions) {
  // กำหนด default
  const {
    controls,
    orientation = 'horizontal',
    activation = 'auto',
    keyboard = true,
    multiple = false,
    closeable = false,
    lazyRender = false,
    animationDuration = 0, // plugin ไม่ได้ใช้จริง, Dev อาจนำไป animate เอง
  } = options;

  // สร้าง storage ภายใน
  const storage: { tabs: TabsStorage } = {
    tabs: {
      itemsMap: new Map<string, TabItem>(),
      activeKey: null,
      activeSet: new Set<string>(),
      loadedSet: new Set<string>(),
      options,
      _events: {},
      containerEl: null,
      orientation,
      activation,
      keyboard,
      lastFocusKey: null,
    },
  };

  // -------------------------------------------------------------
  // Helper: เรียก event callbacks
  // -------------------------------------------------------------
  function callEvent<K extends keyof TabsPluginEvents>(evtName: K, info: TabEventInfo) {
    const cb = storage.tabs._events[evtName];
    if (cb) {
      cb(info);
    }
  }

  // -------------------------------------------------------------
  // Helper: build DOM ref for trigger/panel
  // -------------------------------------------------------------
  function getTriggerEl(key: string): HTMLElement | null {
    const containerEl = storage.tabs.containerEl;
    if (!containerEl) return null;
    return containerEl.querySelector<HTMLElement>(`[data-tab-trigger="${key}"]`);
  }
  function getPanelEl(key: string): HTMLElement | null {
    const containerEl = storage.tabs.containerEl;
    if (!containerEl) return null;
    return containerEl.querySelector<HTMLElement>(`[data-tab-panel="${key}"]`);
  }

  // -------------------------------------------------------------
  // Helper: อัปเดต aria-* ของ tab trigger และ tab panel
  // -------------------------------------------------------------
  function updateAriaForItem(key: string) {
    const tabsState = storage.tabs;
    const item = tabsState.itemsMap.get(key);
    if (!item) return;
    const triggerEl = getTriggerEl(key);
    const panelEl = getPanelEl(key);
    const isActive = isTabActive(key);
    const isDisabled = !!item.disabled;

    // update trigger
    if (triggerEl) {
      triggerEl.setAttribute('role', 'tab');
      triggerEl.setAttribute('aria-controls', `${controls}-panel-${key}`);
      triggerEl.setAttribute('aria-selected', isActive ? 'true' : 'false');
      triggerEl.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
      if (isActive && !isDisabled) {
        triggerEl.setAttribute('tabindex', '0');
      } else {
        triggerEl.setAttribute('tabindex', '-1');
      }
      triggerEl.id = `${controls}-tab-${key}`;
    }
    // update panel
    if (panelEl) {
      panelEl.setAttribute('role', 'tabpanel');
      panelEl.setAttribute('aria-labelledby', `${controls}-tab-${key}`);
      panelEl.id = `${controls}-panel-${key}`;
      if (isActive) {
        panelEl.removeAttribute('hidden');
        panelEl.setAttribute('aria-hidden', 'false');
      } else {
        panelEl.setAttribute('hidden', 'true');
        panelEl.setAttribute('aria-hidden', 'true');
      }
    }
  }

  function updateAriaAll() {
    storage.tabs.itemsMap.forEach((_, key) => {
      updateAriaForItem(key);
    });
  }

  // -------------------------------------------------------------
  // Helper: check ว่า tab นั้น active หรือไม่
  // -------------------------------------------------------------
  function isTabActive(key: string): boolean {
    if (!multiple) {
      return storage.tabs.activeKey === key;
    }
    return storage.tabs.activeSet.has(key);
  }

  // -------------------------------------------------------------
  // container(...) => ผูกองค์ประกอบหลัก
  // -------------------------------------------------------------
  function container(params: { ref: HTMLElement | null; data?: TabItem[] }) {
    const { ref, data } = params;
    let containerEl: HTMLElement | null = null;
    if (ref instanceof HTMLElement) {
      containerEl = ref;
    }
    if (!containerEl) {
      throw new Error('[tabs] container: invalid ref or element.');
    }
    storage.tabs.containerEl = containerEl;
    containerEl.setAttribute('role', 'tablist');
    if (orientation === 'horizontal') {
      containerEl.setAttribute('aria-orientation', 'horizontal');
    } else {
      containerEl.setAttribute('aria-orientation', 'vertical');
    }

    // ถ้ามี data => initial itemsMap
    if (data && data.length) {
      data.forEach((item) => {
        storage.tabs.itemsMap.set(item.key, { ...item });
      });
      if (!multiple) {
        // single => หาคนแรกที่ defaultActive && !disabled
        const firstActive = data.find((x) => x.defaultActive && !x.disabled);
        if (firstActive) {
          storage.tabs.activeKey = firstActive.key;
          if (lazyRender) {
            storage.tabs.loadedSet.add(firstActive.key);
          }
        } else {
          storage.tabs.activeKey = null;
        }
      } else {
        // multiple => ใส่ใน activeSet ถ้า defaultActive && !disabled
        data.forEach((x) => {
          if (x.defaultActive && !x.disabled) {
            storage.tabs.activeSet.add(x.key);
            if (lazyRender) {
              storage.tabs.loadedSet.add(x.key);
            }
          }
        });
      }
    }

    // เซ็ต aria-* ครั้งแรก
    storage.tabs.itemsMap.forEach((_, key) => {
      updateAriaForItem(key);
    });

    // Event listeners
    containerEl.addEventListener('click', onClickTabTrigger);
    if (keyboard) {
      containerEl.addEventListener('keydown', onKeydownTabTrigger);
    }
  }

  // -------------------------------------------------------------
  // onClickTabTrigger => ถ้าเป็น tab trigger => select/toggle
  // -------------------------------------------------------------
  function onClickTabTrigger(evt: MouseEvent) {
    const containerEl = storage.tabs.containerEl;
    if (!containerEl) return;
    const trigger = (evt.target as HTMLElement).closest<HTMLElement>('[data-tab-trigger]');
    if (!trigger || !containerEl.contains(trigger)) return;
    const key = trigger.getAttribute('data-tab-trigger');
    if (!key) return;
    const item = storage.tabs.itemsMap.get(key);
    if (!item) return;
    if (item.disabled) {
      return; // disabled => ignore
    }
    doSelectTab(key, true);
  }

  // -------------------------------------------------------------
  // onKeydownTabTrigger => handle arrow/horizontal/vertical
  // -------------------------------------------------------------
  function onKeydownTabTrigger(evt: KeyboardEvent) {
    const containerEl = storage.tabs.containerEl;
    if (!containerEl) return;
    const trigger = evt.target as HTMLElement;
    if (!trigger.hasAttribute('data-tab-trigger')) return;

    const key = trigger.getAttribute('data-tab-trigger');
    if (!key) return;

    // เก็บ lastFocusKey (ใช้สำหรับ multiple mode)
    storage.tabs.lastFocusKey = key;

    const orientation = storage.tabs.orientation;
    const activation = storage.tabs.activation;
    const items = getAllTabTriggers();
    const idx = items.indexOf(trigger);
    if (idx < 0) return;

    switch (evt.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        if (orientation === 'horizontal' && evt.key === 'ArrowLeft') {
          moveFocus(items, idx, -1);
          evt.preventDefault();
        } else if (orientation === 'vertical' && evt.key === 'ArrowUp') {
          moveFocus(items, idx, -1);
          evt.preventDefault();
        }
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        if (orientation === 'horizontal' && evt.key === 'ArrowRight') {
          moveFocus(items, idx, +1);
          evt.preventDefault();
        } else if (orientation === 'vertical' && evt.key === 'ArrowDown') {
          moveFocus(items, idx, +1);
          evt.preventDefault();
        }
        break;
      case 'Home':
        moveFocus(items, idx, 'home');
        evt.preventDefault();
        break;
      case 'End':
        moveFocus(items, idx, 'end');
        evt.preventDefault();
        break;
      case 'Enter':
      case ' ':
        if (activation === 'manual') {
          doSelectTab(key, true);
        }
        evt.preventDefault();
        break;
      default:
        break;
    }
  }

  // -------------------------------------------------------------
  // moveFocus => handle arrow nav
  // -------------------------------------------------------------
  function moveFocus(items: HTMLElement[], currentIdx: number, direction: number | 'home' | 'end') {
    if (direction === 'home') {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!isTriggerDisabled(it)) {
          it.focus();
          if (storage.tabs.activation === 'auto') {
            const key = it.getAttribute('data-tab-trigger') || '';
            doSelectTab(key, false);
          }
          storage.tabs.lastFocusKey = it.getAttribute('data-tab-trigger');
          break;
        }
      }
      return;
    }
    if (direction === 'end') {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (!isTriggerDisabled(it)) {
          it.focus();
          if (storage.tabs.activation === 'auto') {
            const key = it.getAttribute('data-tab-trigger') || '';
            doSelectTab(key, false);
          }
          storage.tabs.lastFocusKey = it.getAttribute('data-tab-trigger');
          break;
        }
      }
      return;
    }
    // direction = +1 or -1
    const len = items.length;
    let newIdx = currentIdx;
    let loopCount = 0;
    while (true) {
      newIdx = (newIdx + direction + len) % len;
      if (!isTriggerDisabled(items[newIdx])) {
        break;
      }
      loopCount++;
      if (loopCount > len) {
        return;
      }
    }
    items[newIdx].focus();
    if (storage.tabs.activation === 'auto') {
      const key = items[newIdx].getAttribute('data-tab-trigger') || '';
      doSelectTab(key, false);
    }
    storage.tabs.lastFocusKey = items[newIdx].getAttribute('data-tab-trigger');
  }

  function isTriggerDisabled(el: HTMLElement): boolean {
    return el.getAttribute('aria-disabled') === 'true';
  }

  function getAllTabTriggers(): HTMLElement[] {
    const containerEl = storage.tabs.containerEl;
    if (!containerEl) return [];
    return Array.from(containerEl.querySelectorAll<HTMLElement>('[data-tab-trigger]'));
  }

  // -------------------------------------------------------------
  // Core: Select/Toggle tab
  // -------------------------------------------------------------
  function doSelectTab(key: string, isUserClick: boolean) {
    const item = storage.tabs.itemsMap.get(key);
    if (!item) return;
    if (item.disabled) return;

    const wasActive = isTabActive(key);

    // multiple=true => toggle
    if (multiple) {
      if (wasActive) {
        // ถ้าเคย active => ปิด (toggle off)
        // แทนที่จะเรียก reSelect
        storage.tabs.activeSet.delete(key);
        updateAriaAll();
        // เรียก event reSelect เพื่อบอกว่าถูกคลิก tab เดิม
        callEvent('reSelect', { key });
        return;
      } else {
        // ยังไม่ active => open
        callEvent('willChangeTab', { key });
        storage.tabs.activeSet.add(key);
        if (lazyRender) {
          storage.tabs.loadedSet.add(key);
        }
        updateAriaAll();
        callEvent('changeTab', { key });
        callEvent('didChangeTab', { key });
        return;
      }
    } else {
      // single mode
      if (wasActive) {
        // ถ้า active แล้ว => reSelect
        callEvent('reSelect', { key });
        return;
      }
      const oldKey = storage.tabs.activeKey;
      callEvent('willChangeTab', { key, previousKey: oldKey });
      storage.tabs.activeKey = key;
      if (lazyRender) {
        storage.tabs.loadedSet.add(key);
      }
      updateAriaAll();
      callEvent('changeTab', { key, previousKey: oldKey });
      callEvent('didChangeTab', { key, previousKey: oldKey });
    }
  }

  // -------------------------------------------------------------
  // Actions: select(key)
  // -------------------------------------------------------------
  function select(key: string) {
    doSelectTab(key, false);
  }

  // -------------------------------------------------------------
  // Actions: next(), prev()
  // -------------------------------------------------------------
  function next() {
    const triggers = getAllTabTriggers();
    let idx = -1;

    // ถ้า multiple => ใช้ lastFocusKey
    if (multiple) {
      const lKey = storage.tabs.lastFocusKey;
      if (lKey) {
        idx = triggers.findIndex((el) => el.getAttribute('data-tab-trigger') === lKey);
      }
      if (idx < 0) {
        // ถ้าไม่เคย focus => idx=0
        idx = 0;
      }
    } else {
      // single mode => ใช้ activeKey
      const currentKey = storage.tabs.activeKey;
      if (currentKey) {
        idx = triggers.findIndex((el) => el.getAttribute('data-tab-trigger') === currentKey);
      }
      if (idx < 0) {
        idx = 0;
      }
    }
    moveFocus(triggers, idx, +1);
  }

  function prev() {
    const triggers = getAllTabTriggers();
    let idx = -1;

    if (multiple) {
      const lKey = storage.tabs.lastFocusKey;
      if (lKey) {
        idx = triggers.findIndex((el) => el.getAttribute('data-tab-trigger') === lKey);
      }
      if (idx < 0) {
        idx = 0;
      }
    } else {
      const currentKey = storage.tabs.activeKey;
      if (currentKey) {
        idx = triggers.findIndex((el) => el.getAttribute('data-tab-trigger') === currentKey);
      }
      if (idx < 0) {
        idx = 0;
      }
    }
    moveFocus(triggers, idx, -1);
  }

  // -------------------------------------------------------------
  // Actions: disable(key), enable(key)
  // -------------------------------------------------------------
  function disable(key: string) {
    const item = storage.tabs.itemsMap.get(key);
    if (!item) return;
    if (item.disabled) return;
    // ถ้า tab นี้ active อยู่ => ต้อง unselect ด้วย?
    // single => ถ้าเป็น activeKey => set activeKey=null
    // multiple => ถ้าใน activeSet => remove
    if (!multiple) {
      if (storage.tabs.activeKey === key) {
        storage.tabs.activeKey = null;
      }
    } else {
      if (storage.tabs.activeSet.has(key)) {
        storage.tabs.activeSet.delete(key);
      }
    }
    item.disabled = true;
    updateAriaAll();
  }

  function enable(key: string) {
    const item = storage.tabs.itemsMap.get(key);
    if (!item) return;
    if (!item.disabled) return;
    item.disabled = false;
    updateAriaAll();
  }

  // -------------------------------------------------------------
  // Actions: closeTab(key) => ถ้า closeable=true
  // -------------------------------------------------------------
  function closeTab(key: string) {
    if (!closeable) {
      console.warn('[tabs] closeTab called but closeable=false');
      return;
    }
    const item = storage.tabs.itemsMap.get(key);
    if (!item) return;
    callEvent('willCloseTab', { key });
    // ถ้า tab นี้กำลัง active => ต้องหา tab อื่น (single mode)
    if (!multiple) {
      if (storage.tabs.activeKey === key) {
        const triggers = getAllTabTriggers();
        let newActiveKey: string | null = null;
        const idx = triggers.findIndex((el) => el.getAttribute('data-tab-trigger') === key);
        if (idx >= 0) {
          // ลอง tab ถัดไป
          for (let i = idx + 1; i < triggers.length; i++) {
            const ck = triggers[i].getAttribute('data-tab-trigger');
            if (ck && storage.tabs.itemsMap.has(ck)) {
              const candidateItem = storage.tabs.itemsMap.get(ck);
              if (candidateItem && !candidateItem.disabled) {
                newActiveKey = ck;
                break;
              }
            }
          }
          // ถ้าไม่เจอ => ลองก่อนหน้า
          if (!newActiveKey) {
            for (let j = idx - 1; j >= 0; j--) {
              const ck = triggers[j].getAttribute('data-tab-trigger');
              if (ck && storage.tabs.itemsMap.has(ck)) {
                const candidateItem = storage.tabs.itemsMap.get(ck);
                if (candidateItem && !candidateItem.disabled) {
                  newActiveKey = ck;
                  break;
                }
              }
            }
          }
        }
        storage.tabs.activeKey = newActiveKey;
      }
    } else {
      // multiple => ถ้ามีอยู่ใน activeSet => remove
      if (storage.tabs.activeSet.has(key)) {
        storage.tabs.activeSet.delete(key);
      }
    }
    // remove item from itemsMap
    storage.tabs.itemsMap.delete(key);
    // ถ้าตรงกับ lastFocusKey => เคลียร์
    if (storage.tabs.lastFocusKey === key) {
      storage.tabs.lastFocusKey = null;
    }
    updateAriaAll();
    callEvent('closeTab', { key });
    callEvent('didCloseTab', { key });
  }

  // -------------------------------------------------------------
  // destroy() => cleanup event listeners
  // -------------------------------------------------------------
  function destroy() {
    const containerEl = storage.tabs.containerEl;
    if (containerEl) {
      containerEl.removeEventListener('click', onClickTabTrigger);
      containerEl.removeEventListener('keydown', onKeydownTabTrigger);
    }
    // clear all
    storage.tabs.itemsMap.clear();
    storage.tabs.activeSet.clear();
    storage.tabs.loadedSet.clear();
    storage.tabs.containerEl = null;
    storage.tabs.lastFocusKey = null;
  }

  // -------------------------------------------------------------
  // events(...): ผูก callback
  // -------------------------------------------------------------
  function events(e: TabsPluginEvents) {
    storage.tabs._events = {
      willChangeTab: e.willChangeTab,
      changeTab: e.changeTab,
      didChangeTab: e.didChangeTab,
      reSelect: e.reSelect,
      willCloseTab: e.willCloseTab,
      closeTab: e.closeTab,
      didCloseTab: e.didCloseTab,
    };
  }

  // -------------------------------------------------------------
  // aria: สำหรับ Dev ที่ต้องการกระจาย attribute เอง
  // -------------------------------------------------------------
  function ariaTrigger(key: string) {
    const item = storage.tabs.itemsMap.get(key);
    const isActive = isTabActive(key);
    const isDisabled = item ? !!item.disabled : false;
    return {
      'data-tab-trigger': key,
      role: 'tab',
      'aria-controls': `${controls}-panel-${key}`,
      'aria-selected': isActive ? 'true' : 'false',
      'aria-disabled': isDisabled ? 'true' : 'false',
      tabIndex: isActive && !isDisabled ? 0 : -1,
      id: `${controls}-tab-${key}`,
    };
  }

  function ariaPanel(key: string) {
    const isActive = isTabActive(key);
    return {
      'data-tab-panel': key,
      role: 'tabpanel',
      'aria-labelledby': `${controls}-tab-${key}`,
      id: `${controls}-panel-${key}`,
      hidden: isActive ? undefined : true,
      'aria-hidden': isActive ? 'false' : 'true',
    };
  }

  // -------------------------------------------------------------
  // คืน API ออกไป
  // -------------------------------------------------------------
  return {
    container,
    events,
    actions: {
      select,
      next,
      prev,
      disable,
      enable,
      closeTab,
      destroy,
    },
    aria: {
      trigger: ariaTrigger,
      panel: ariaPanel,
    },
  };
}
