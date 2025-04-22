// tabs-improved-v2.ts
// Production-ready code (ไม่มีการข้ามบรรทัดหรือข้าม logic)
// -------------------------------------------------------------
//
// Tabs Plugin (Uncontrolled mode) + JavaScript Event Delegation + ARIA + Keyboard Navigation
// ปรับปรุงเพิ่มเติมจากเดิม:
//   1) เมื่อ multiple=true => คลิก tab เดิมซ้ำ => ปิด (toggle off) และ dispatch event "toggleOff" แทน "reSelect"
//   2) ถ้า single mode และ user คลิก tab เดิมซ้ำ => dispatch event "reSelect" (ไม่ปิด)
//   3) แก้ไข logic closeTab() ใน single mode => ถ้าหา tab ใหม่ให้เปิดได้ => focus() ให้อัตโนมัติ
//   4) นอกนั้นคง behavior เดิม เช่น defaultActive+disabled, lastFocusKey, lazyRender, animationDuration=ref ฯลฯ
//
// จุดสำคัญ:
//   - multiple mode => toggle off => fire "toggleOff({key})"
//   - single mode => reSelect => ถ้า user คลิก tab เดิมซ้ำ
//   - closeTab ใน single mode => ถ้าเจอแท็บถัดไป => auto focus
//   - animationDuration => dev เอาไปใช้เอง (plugin ไม่ได้ animate อัตโนมัติ)
//
// ตัวอย่างใช้งาน:
//   const tabsA = tabs({ controls: 'myTab', multiple: true });
//   tabsA.container({ ref: containerEl, data: [...] });
//   tabsA.events({ toggleOff(e){...}, reSelect(e){...} });
//   ...
//
// Dev จะ render DOM เอง โดย map data =>
//     <div {...tabsA.aria.trigger(item.key)}>...</div>
//     <div {...tabsA.aria.panel(item.key)}>...</div>
//
// -------------------------------------------------------------
// ประกาศ interface ต่าง ๆ
// -------------------------------------------------------------

/** Options หลักที่ใช้ตอนสร้าง instance ของ tabs(...) */
export interface TabsPluginOptions {
  controls: string;
  orientation?: 'horizontal' | 'vertical';
  activation?: 'auto' | 'manual';
  keyboard?: boolean;
  multiple?: boolean;
  closeable?: boolean;
  lazyRender?: boolean;
  animationDuration?: number; // Plugin ไม่ได้ใช้งานตรง ๆ, Dev animate เอง
}

/** โครงสร้างของ item ใน tab */
export interface TabItem {
  key: string;
  label?: any;
  content?: any;
  defaultActive?: boolean;
  disabled?: boolean;
  closable?: boolean;
}

/** ข้อมูลที่ส่งเข้า event callbacks */
export interface TabEventInfo {
  key: string;
  previousKey?: string | null;
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

  /** Single Mode: user คลิก tab เดิมซ้ำ => reSelect */
  reSelect?: (info: TabEventInfo) => void;
  /** Multiple Mode: tab เดิมซ้ำ => toggle off => fire toggleOff */
  toggleOff?: (info: TabEventInfo) => void;

  willCloseTab?: (info: TabEventInfo) => void;
  closeTab?: (info: TabEventInfo) => void;
  didCloseTab?: (info: TabEventInfo) => void;
}

// -------------------------------------------------------------
// ประกาศโครงสร้างภายใน (storage) ของ plugin
// -------------------------------------------------------------
interface TabsStorage {
  itemsMap: Map<string, TabItem>;
  activeKey: string | null; // single
  activeSet: Set<string>; // multiple
  loadedSet: Set<string>; // lazyRender => จำว่าเคยเปิด tab ไหน
  options: TabsPluginOptions;
  _events: TabsPluginEvents;
  containerEl?: HTMLElement | null;
  orientation: 'horizontal' | 'vertical';
  activation: 'auto' | 'manual';
  keyboard: boolean;
  lastFocusKey: string | null; // multiple mode => ใช้ใน next/prev
}

// -------------------------------------------------------------
// ฟังก์ชันหลัก tabs(...)
// -------------------------------------------------------------
export function tabs(options: TabsPluginOptions) {
  const {
    controls,
    orientation = 'horizontal',
    activation = 'auto',
    keyboard = true,
    multiple = false,
    closeable = false,
    lazyRender = false,
    animationDuration = 0, // plugin ไม่ใช้จริง
  } = options;

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
    const item = storage.tabs.itemsMap.get(key);
    if (!item) return;
    const triggerEl = getTriggerEl(key);
    const panelEl = getPanelEl(key);
    const isActive = isTabActive(key);
    const isDisabled = !!item.disabled;

    if (triggerEl) {
      triggerEl.setAttribute('role', 'tab');
      triggerEl.setAttribute('aria-controls', `${controls}-panel-${key}`);
      triggerEl.setAttribute('aria-selected', isActive ? 'true' : 'false');
      triggerEl.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
      triggerEl.id = `${controls}-tab-${key}`;
      if (isActive && !isDisabled) {
        triggerEl.setAttribute('tabindex', '0');
      } else {
        triggerEl.setAttribute('tabindex', '-1');
      }
    }

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
  // Helper: isTabActive
  // -------------------------------------------------------------
  function isTabActive(key: string): boolean {
    if (!multiple) {
      return storage.tabs.activeKey === key;
    }
    return storage.tabs.activeSet.has(key);
  }

  // -------------------------------------------------------------
  // container(...)
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
    containerEl.setAttribute('aria-orientation', orientation);

    if (data && data.length) {
      data.forEach((item) => {
        storage.tabs.itemsMap.set(item.key, { ...item });
      });
      if (!multiple) {
        // single => หา defaultActive && !disabled ตัวแรก
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

    // update aria
    storage.tabs.itemsMap.forEach((_, k) => {
      updateAriaForItem(k);
    });

    containerEl.addEventListener('click', onClickTabTrigger);
    if (keyboard) {
      containerEl.addEventListener('keydown', onKeydownTabTrigger);
    }
  }

  // -------------------------------------------------------------
  // onClickTabTrigger
  // -------------------------------------------------------------
  function onClickTabTrigger(evt: MouseEvent) {
    const containerEl = storage.tabs.containerEl;
    if (!containerEl) return;
    const trigger = (evt.target as HTMLElement).closest<HTMLElement>('[data-tab-trigger]');
    if (!trigger || !containerEl.contains(trigger)) return;
    const key = trigger.getAttribute('data-tab-trigger');
    if (!key) return;
    const item = storage.tabs.itemsMap.get(key);
    if (!item || item.disabled) return;
    doSelectTab(key, true);
  }

  // -------------------------------------------------------------
  // onKeydownTabTrigger => arrow nav, etc.
  // -------------------------------------------------------------
  function onKeydownTabTrigger(evt: KeyboardEvent) {
    const containerEl = storage.tabs.containerEl;
    if (!containerEl) return;
    const trigger = evt.target as HTMLElement;
    if (!trigger.hasAttribute('data-tab-trigger')) return;

    const key = trigger.getAttribute('data-tab-trigger') || '';
    storage.tabs.lastFocusKey = key; // เก็บไว้สำหรับ multiple => next/prev

    const items = getAllTabTriggers();
    const idx = items.indexOf(trigger);
    if (idx < 0) return;

    if (orientation === 'horizontal') {
      if (evt.key === 'ArrowLeft') {
        moveFocus(items, idx, -1);
        evt.preventDefault();
      } else if (evt.key === 'ArrowRight') {
        moveFocus(items, idx, +1);
        evt.preventDefault();
      }
    } else {
      // vertical
      if (evt.key === 'ArrowUp') {
        moveFocus(items, idx, -1);
        evt.preventDefault();
      } else if (evt.key === 'ArrowDown') {
        moveFocus(items, idx, +1);
        evt.preventDefault();
      }
    }

    switch (evt.key) {
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
  // moveFocus
  // -------------------------------------------------------------
  function moveFocus(items: HTMLElement[], currentIdx: number, dir: number | 'home' | 'end') {
    if (dir === 'home') {
      for (let i = 0; i < items.length; i++) {
        if (!isTriggerDisabled(items[i])) {
          items[i].focus();
          if (activation === 'auto') {
            const k = items[i].getAttribute('data-tab-trigger') || '';
            doSelectTab(k, false);
          }
          storage.tabs.lastFocusKey = items[i].getAttribute('data-tab-trigger');
          return;
        }
      }
      return;
    }
    if (dir === 'end') {
      for (let i = items.length - 1; i >= 0; i--) {
        if (!isTriggerDisabled(items[i])) {
          items[i].focus();
          if (activation === 'auto') {
            const k = items[i].getAttribute('data-tab-trigger') || '';
            doSelectTab(k, false);
          }
          storage.tabs.lastFocusKey = items[i].getAttribute('data-tab-trigger');
          return;
        }
      }
      return;
    }
    const len = items.length;
    let newIdx = currentIdx;
    let loopCount = 0;
    while (true) {
      newIdx = (newIdx + (dir as number) + len) % len;
      if (!isTriggerDisabled(items[newIdx])) {
        break;
      }
      loopCount++;
      if (loopCount > len) {
        return;
      }
    }
    items[newIdx].focus();
    if (activation === 'auto') {
      const k = items[newIdx].getAttribute('data-tab-trigger') || '';
      doSelectTab(k, false);
    }
    storage.tabs.lastFocusKey = items[newIdx].getAttribute('data-tab-trigger');
  }

  // -------------------------------------------------------------
  // isTriggerDisabled
  // -------------------------------------------------------------
  function isTriggerDisabled(el: HTMLElement) {
    return el.getAttribute('aria-disabled') === 'true';
  }

  // -------------------------------------------------------------
  // getAllTabTriggers
  // -------------------------------------------------------------
  function getAllTabTriggers() {
    const containerEl = storage.tabs.containerEl;
    if (!containerEl) return [];
    return Array.from(containerEl.querySelectorAll<HTMLElement>('[data-tab-trigger]'));
  }

  // -------------------------------------------------------------
  // doSelectTab => (multiple => toggleOff vs single => reSelect)
  // -------------------------------------------------------------
  function doSelectTab(key: string, isUserClick: boolean) {
    const item = storage.tabs.itemsMap.get(key);
    if (!item || item.disabled) return;

    const wasActive = isTabActive(key);

    if (multiple) {
      if (wasActive) {
        // toggle off => remove from activeSet
        storage.tabs.activeSet.delete(key);
        updateAriaAll();
        // dispatch 'toggleOff' event
        callEvent('toggleOff', { key });
      } else {
        // open new
        callEvent('willChangeTab', { key });
        storage.tabs.activeSet.add(key);
        if (lazyRender) {
          storage.tabs.loadedSet.add(key);
        }
        updateAriaAll();
        callEvent('changeTab', { key });
        callEvent('didChangeTab', { key });
      }
    } else {
      // single mode
      if (wasActive) {
        // reSelect
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
  // Actions
  // -------------------------------------------------------------
  function select(key: string) {
    doSelectTab(key, false);
  }

  function next() {
    const triggers = getAllTabTriggers();
    if (!triggers.length) return;
    let idx = -1;
    if (multiple) {
      const lKey = storage.tabs.lastFocusKey;
      if (lKey) {
        idx = triggers.findIndex((el) => el.getAttribute('data-tab-trigger') === lKey);
      }
      if (idx < 0) idx = 0;
    } else {
      const currentKey = storage.tabs.activeKey;
      if (currentKey) {
        idx = triggers.findIndex((el) => el.getAttribute('data-tab-trigger') === currentKey);
      }
      if (idx < 0) idx = 0;
    }
    moveFocus(triggers, idx, +1);
  }

  function prev() {
    const triggers = getAllTabTriggers();
    if (!triggers.length) return;
    let idx = -1;
    if (multiple) {
      const lKey = storage.tabs.lastFocusKey;
      if (lKey) {
        idx = triggers.findIndex((el) => el.getAttribute('data-tab-trigger') === lKey);
      }
      if (idx < 0) idx = 0;
    } else {
      const currentKey = storage.tabs.activeKey;
      if (currentKey) {
        idx = triggers.findIndex((el) => el.getAttribute('data-tab-trigger') === currentKey);
      }
      if (idx < 0) idx = 0;
    }
    moveFocus(triggers, idx, -1);
  }

  function disable(key: string) {
    const item = storage.tabs.itemsMap.get(key);
    if (!item || item.disabled) return;
    // unselect if active
    if (!multiple) {
      if (storage.tabs.activeKey === key) {
        storage.tabs.activeKey = null;
      }
    } else {
      storage.tabs.activeSet.delete(key);
    }
    item.disabled = true;
    updateAriaAll();
  }

  function enable(key: string) {
    const item = storage.tabs.itemsMap.get(key);
    if (!item || !item.disabled) return;
    item.disabled = false;
    updateAriaAll();
  }

  function closeTab(key: string) {
    if (!closeable) {
      console.warn('[tabs] closeTab called but closeable=false');
      return;
    }
    const item = storage.tabs.itemsMap.get(key);
    if (!item) return;
    callEvent('willCloseTab', { key });
    if (!multiple) {
      // single => ถ้าเป็น tab active => หา tab ถัดไป
      if (storage.tabs.activeKey === key) {
        const triggers = getAllTabTriggers();
        let newActiveKey: string | null = null;
        const idx = triggers.findIndex((t) => t.getAttribute('data-tab-trigger') === key);
        if (idx >= 0) {
          // ลอง tab ถัดไป
          for (let i = idx + 1; i < triggers.length; i++) {
            const ckey = triggers[i].getAttribute('data-tab-trigger');
            if (ckey && storage.tabs.itemsMap.has(ckey)) {
              const cItem = storage.tabs.itemsMap.get(ckey);
              if (cItem && !cItem.disabled) {
                newActiveKey = ckey;
                break;
              }
            }
          }
          // ถ้าไม่เจอ => ลองก่อนหน้า
          if (!newActiveKey) {
            for (let j = idx - 1; j >= 0; j--) {
              const ckey = triggers[j].getAttribute('data-tab-trigger');
              if (ckey && storage.tabs.itemsMap.has(ckey)) {
                const cItem = storage.tabs.itemsMap.get(ckey);
                if (cItem && !cItem.disabled) {
                  newActiveKey = ckey;
                  break;
                }
              }
            }
          }
        }
        storage.tabs.activeKey = newActiveKey || null;
        // focus newActiveKey
        if (newActiveKey) {
          const newTrigger = getTriggerEl(newActiveKey);
          newTrigger?.focus();
        }
      }
    } else {
      // multiple => remove if in activeSet
      storage.tabs.activeSet.delete(key);
    }
    storage.tabs.itemsMap.delete(key);
    if (storage.tabs.lastFocusKey === key) {
      storage.tabs.lastFocusKey = null;
    }
    updateAriaAll();
    callEvent('closeTab', { key });
    callEvent('didCloseTab', { key });
  }

  function destroy() {
    const containerEl = storage.tabs.containerEl;
    if (containerEl) {
      containerEl.removeEventListener('click', onClickTabTrigger);
      containerEl.removeEventListener('keydown', onKeydownTabTrigger);
    }
    storage.tabs.itemsMap.clear();
    storage.tabs.activeSet.clear();
    storage.tabs.loadedSet.clear();
    storage.tabs.containerEl = null;
    storage.tabs.lastFocusKey = null;
  }

  function events(e: TabsPluginEvents) {
    storage.tabs._events = {
      willChangeTab: e.willChangeTab,
      changeTab: e.changeTab,
      didChangeTab: e.didChangeTab,
      reSelect: e.reSelect,
      toggleOff: e.toggleOff, // <-- New event for multiple mode
      willCloseTab: e.willCloseTab,
      closeTab: e.closeTab,
      didCloseTab: e.didCloseTab,
    };
  }

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
