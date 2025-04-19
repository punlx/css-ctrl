// src/plugin/select.ts

/** โครงสร้างข้อมูลสำหรับ DataItem */
export interface DataItem {
  [key: string]: any;
}

/** ข้อมูล config สำหรับ Lazy Load */
interface LazyLoadOptions {
  /** จำนวน item แรกที่จะ load */
  firstLoad?: number;
  /** จำนวน item ต่อ ๆ ไปที่จะ load */
  nextLoad?: number;
}

/** ตัวเลือกตั้งต้นของ select plugin
 * เพิ่ม <T extends DataItem = DataItem> เพื่อใช้เป็น Generic
 */
interface SelectOptions<T extends DataItem = DataItem> {
  id: string;
  toggleable?: boolean;
  /**
   * single-select => เลือกได้ทีละหนึ่ง (clear ของเก่า)
   * multi-select => เลือกได้หลายตัว (ไม่ clear ของเก่า)
   * single-then-multi => เริ่มแบบ single, ถ้ามี shift/ctrl => เปลี่ยนเป็น multi
   */
  type?: 'single-select' | 'multi-select' | 'single-then-multi';

  /**
   * เปิด/ปิดการเลื่อน Scroll อัตโนมัติ เมื่อ item ถูก Active หรือ Select
   * ถ้าไม่ระบุจะเป็น true (เปิด)
   */
  autoScroll?: boolean;

  /**
   * ระบุ scroll behavior เช่น 'auto' หรือ 'smooth'
   * ถ้าไม่กำหนด จะเป็น 'auto'
   */
  scrollBehavior?: ScrollBehavior;

  /**
   * ตัวเลือกสำหรับ Lazy Load
   * firstLoad => จำนวนที่จะ load รอบแรก
   * nextLoad => จำนวนที่จะ load รอบถัดไป เมื่อ scroll ถึงล่างสุด
   */
  lazyLoad?: LazyLoadOptions;
}

/** โครงสร้างเก็บ item ที่ select
 * เพิ่ม <T> เพื่อรองรับ dataItem: T
 */
interface SelectedItem<T> {
  el: HTMLElement;
  dataItem: T | null;
}

/** ข้อมูลส่งเข้า callback */
interface SelectCallbackInfo<T> {
  value: T | null;
  target: HTMLElement;
  list: Array<{ value: T | null; target: HTMLElement }>;
}

/** 5 callback ใน events(...) + Lazy Load 4 ตัว
 * เพิ่ม <T> เพื่อให้แต่ละ event รับ/ส่งเป็น T[]
 */
interface SelectEvents<T> {
  willSelect?: (info: SelectCallbackInfo<T>) => void;
  select?: (info: SelectCallbackInfo<T>) => void;
  didSelect?: (info: SelectCallbackInfo<T>) => void;
  unSelect?: (info: SelectCallbackInfo<T>) => void;
  reSelect?: (info: SelectCallbackInfo<T>) => void;

  /** ----- Event ใหม่สำหรับ Lazy Load ----- */
  /** เรียกครั้งแรกตอน mount หรือ init ส่วนของ lazyLoad */
  firstLoad?: (newData: T[]) => void;
  /** เรียกเมื่อ scroll ถึงล่างสุดก่อน load ถัดไป */
  willLoad?: (newData: T[]) => void;
  /** เรียกหลังจากโหลดเพิ่มเสร็จ (ต่อจาก willLoad) */
  loaded?: (newData: T[]) => void;
  /** เรียกหลัง loaded อีกที (จะเรียกซ้ำข้อมูลเดิม) */
  didLoaded?: (newData: T[]) => void;
}

/** ข้อมูลสำหรับ init(...)
 * เพิ่ม <T> เพื่อ data?: T[]
 */
interface InitParams<T> {
  ref: HTMLElement; // container <div role="listbox" class=...>
  data?: T[]; // array ของ { value, display, ... }
  valueKey?: string;
}

/** interface ของ storage ที่ plugin จะใช้
 * เพิ่ม <T> เพื่อรองรับ selectedItems: SelectedItem<T>
 * และ _selectData?: T[]
 */
export interface SelectStorage<T> extends Record<string, unknown> {
  select: {
    selectedItems: SelectedItem<T>[];
    _events: SelectEvents<T>;
    reselectAllowed: boolean;
    unselectAllowed: boolean;
    valueKey?: string;
    containerEl?: HTMLElement;
    _selectData?: T[];
    /** เก็บข้อมูล item ปัจจุบันที่โฟกัสหรือ active อยู่ (สำหรับ aria-activedescendant) */
    activeItemEl?: HTMLElement | null;
    /** เก็บ index ล่าสุดที่คลิก (ใช้ใน multi-select + shiftKey) */
    lastIndexClicked: number | null;

    /** ----- State สำหรับ Lazy Load ----- */
    /** เก็บค่าที่เกี่ยวกับ lazyLoad เช่น currentIndex */
    lazyState?: {
      currentIndex: number; // เก็บจำนวน item ที่ load ไปแล้ว
    };
  };
}

/**
 * สุดท้าย: export function listbox(...)
 * เพิ่ม <T extends DataItem = DataItem> เพื่อให้เป็น Generic
 * - เปลี่ยนมาใช้ type: 'single-select' | 'multi-select' | 'single-then-multi'
 * - มี destroy() สำหรับ cleanup
 * - รองรับ Home/End ใน keyboard navigation
 * - moveFocus() จะข้าม items ที่ aria-disabled="true"
 * - รองรับ shift+click / ctrl+click ในโหมด multi หรือ single-then-multi (ที่เปลี่ยนเป็น multi)
 * - มี focusItem() เรียกโฟกัส item ใดๆ โดยไม่ select
 * - เพิ่ม autoScroll + scrollBehavior เพื่อเลื่อน scrollIntoView
 * - เพิ่ม lazyLoad (firstLoad / nextLoad) + event firstLoad, willLoad, loaded, didLoaded
 */
export function listbox<T extends DataItem = DataItem>(options: SelectOptions<T>) {
  // ตั้งค่า default หากไม่ได้ส่งมา
  const {
    id = '',
    toggleable = false,
    type = 'single-select',
    autoScroll = true,
    scrollBehavior = 'auto',
    lazyLoad,
  } = options;

  // ภายในเราจะเก็บ selectMode = 'single' | 'multi'
  let selectMode: 'single' | 'multi' = 'single';
  switch (type) {
    case 'multi-select':
      selectMode = 'multi';
      break;
    case 'single-select':
      selectMode = 'single';
      break;
    case 'single-then-multi':
      selectMode = 'single';
      break;
  }

  // 1) สร้าง storage
  const storage: SelectStorage<T> = {
    select: {
      selectedItems: [],
      _events: {},
      reselectAllowed: false,
      unselectAllowed: false,
      activeItemEl: null,
      lastIndexClicked: null,
      // สำหรับ lazy load
      lazyState: {
        currentIndex: 0,
      },
    },
  };

  // ฟังก์ชันเลื่อน scroll ให้ item ที่เพิ่ง active / selected
  function scrollToItem(el: HTMLElement) {
    if (!autoScroll) return;
    el.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: scrollBehavior,
    });
  }

  // 2) ฟังก์ชันภายใน + Logic ที่เพิ่มเติม
  function container(params: InitParams<T>) {
    const { ref, data, valueKey } = params;
    ref.role = 'listbox';
    ref.id = id;
    ref.tabIndex = 0;

    // ตั้ง ariaMultiSelectable เป็น 'true' ถ้าเราอยู่ในโหมด multi
    ref.ariaMultiSelectable = selectMode === 'multi' ? 'true' : 'false';

    // เก็บ container + data
    storage.select.containerEl = ref;
    storage.select._selectData = data;

    // =========== จุดสำคัญ: เช็ค role="option" + id ===========
    if (data) {
      const elCheckId = ref.querySelector(`[id]`) as HTMLElement | null;
      if (!elCheckId) {
        console.info(
          `[CSS-CTRL-INFO] Missing [id="${id}-<value>"] in container with role="listbox" despite select.listbox({ data }) configuration.`
        );
      }
      if (!valueKey) {
        throw new Error(
          `[CSS-CTRL-ERR] select.listbox({ valueKey }) is required when using select.listbox({ data }) in a container with role="listbox".`
        );
      } else {
        storage.select.valueKey = valueKey;
      }
    }
    const elCheckRole = ref.querySelector(`[role="option"]`);
    if (!elCheckRole) {
      console.info(
        `[CSS-CTRL-INFO] Each item within a container assigned role="listbox" must include role="option".`
      );
    }

    // ผูก event click
    ref.onclick = handleContainerClick;

    // ผูก event keydown (เพื่อรองรับ keyboard navigation + aria-activedescendant)
    ref.onkeydown = handleKeyDown;

    // ---------- เริ่มส่วนของ Lazy Load ----------
    // ถ้ามี lazyLoad และมี data ให้ plugin ช่วย slice
    if (lazyLoad && data && data.length) {
      // load ก้อนแรก
      doFirstLoad(data, lazyLoad.firstLoad);

      // ผูก event scroll
      ref.onscroll = (evt) => {
        const el = evt.target as HTMLElement;
        // เช็คว่า scroll ถึงล่างสุดหรือไม่
        if (el.scrollTop + el.clientHeight >= el.scrollHeight) {
          // โหลด chunk ถัดไป
          doLoadNextChunk(data, lazyLoad.nextLoad);
        }
      };
    }
    // ---------- จบส่วนของ Lazy Load ----------
  }

  function events(ev: SelectEvents<T>) {
    storage.select._events = {
      willSelect: ev.willSelect,
      select: ev.select,
      didSelect: ev.didSelect,
      unSelect: ev.unSelect,
      reSelect: ev.reSelect,
      // lazy load
      firstLoad: ev.firstLoad,
      willLoad: ev.willLoad,
      loaded: ev.loaded,
      didLoaded: ev.didLoaded,
    };
  }

  /** Lifecycle: ถอด Event Listener เพื่อ cleanup */
  function destroy() {
    const ref = storage.select.containerEl;
    if (!ref) return;
    ref.onclick = null;
    ref.onkeydown = null;
    // ลบ onscroll ด้วย
    ref.onscroll = null;
    // เคลียร์ state
    storage.select.activeItemEl = null;
    storage.select.selectedItems = [];
    storage.select.lastIndexClicked = null;
    storage.select.containerEl = undefined;
  }

  function handleContainerClick(evt: MouseEvent) {
    const el = (evt.target as HTMLElement).closest('[role="option"]') as HTMLElement | null;
    if (!el) return;
    if (el.getAttribute('aria-disabled') === 'true') {
      // ถ้า disabled => ข้าม
      return;
    }

    // กรณี type === 'single-then-multi' แต่ยังเป็น single => ถ้าเจอ shift/ctrl => switch to multi
    if (type === 'single-then-multi' && selectMode === 'single') {
      if (evt.shiftKey || evt.ctrlKey || evt.metaKey) {
        selectMode = 'multi';
        // อัปเดต ariaMultiSelectable
        const ref = storage.select.containerEl;
        if (ref) {
          ref.ariaMultiSelectable = 'true';
        }
      }
    }

    // ถ้าเป็น multi-mode => เช็ค shiftKey / ctrlKey
    if (selectMode === 'multi') {
      if (evt.shiftKey) {
        // SHIFT+Click => select ช่วง range
        doSelectRange(el);
        storage.select.activeItemEl = el;
        updateAriaActiveDescendant();
        // scroll
        scrollToItem(el);
        storage.select.containerEl?.focus();
        return;
      }
      if (evt.ctrlKey || evt.metaKey) {
        // CTRL+Click => toggle เฉพาะตัวนี้
        doToggleItem(el);
        storage.select.activeItemEl = el;
        updateAriaActiveDescendant();
        scrollToItem(el);
        storage.select.containerEl?.focus();
        return;
      }
    }

    // ไม่เข้ากรณี shift/ctrl (หรืออยู่ในโหมด single) => logic select ปกติ
    callSelectEvent('willSelect', el);
    if (selectMode === 'single') {
      doSingleSelectLogic(el);
    } else {
      // multi แต่ไม่มี shift/ctrl => ก็ select item เดี่ยวๆ (ไม่ clear ของเก่า)
      doToggleItemWithoutUnselectOthers(el);
    }
    storage.select.activeItemEl = el;
    updateAriaActiveDescendant();
    scrollToItem(el);
    storage.select.lastIndexClicked = getIndexOf(el);
    storage.select.containerEl?.focus();
  }

  /**
   * ฟังก์ชันสำหรับเรียก event ที่เกี่ยวกับ "Selection"
   * ได้แก่ willSelect, select, didSelect, unSelect, reSelect
   * โดยจะส่งเป็น SelectCallbackInfo
   */
  function callSelectEvent(
    name: 'willSelect' | 'select' | 'didSelect' | 'unSelect' | 'reSelect',
    el: HTMLElement
  ) {
    const cb = storage.select._events[name];
    if (cb) {
      const info = buildInfo(el);
      cb(info);
    }
  }

  /** ฟังก์ชันอ่านค่าภายใน object ตาม path: a.b.c หรือ use wildcard '$' */
  function extractValueByPath(obj: any, pathStr: string): any {
    const segments = pathStr.split('.');
    let current = obj;
    for (const seg of segments) {
      if (seg === '$') {
        const keys = Object.keys(current);
        if (keys.length !== 1) {
          throw new Error(`[CSS-CTRL-ERR] wildcard "$" expects exactly 1 key, got ${keys.length}`);
        }
        const theKey = keys[0];
        current = current[theKey];
      } else {
        if (current == null) break;
        current = current[seg];
      }
      if (current === undefined || current === null) break;
    }
    return current;
  }

  function findDataItem(el: HTMLElement): T | null {
    const data = storage.select._selectData || [];
    const val = el.id.slice(id.length + 1); // +1 คือ "-"
    if (!val) return null;
    if (!storage.select.valueKey) {
      throw new Error(
        `[CSS-CTRL-ERR] No valueKey specified, can't parse data item for value "${val}".`
      );
    }
    for (const item of data) {
      const extracted = extractValueByPath(item, storage.select.valueKey);
      if (extracted === undefined || extracted === null) {
        continue;
      }
      if (String(extracted) === val) {
        return item;
      }
    }
    throw new Error(
      `[CSS-CTRL-ERR] No matched data item for value "${val}" using valueKey="${storage.select.valueKey}".`
    );
  }

  function buildInfo(el: HTMLElement) {
    return {
      value: findDataItem(el),
      target: el,
      list: storage.select.selectedItems.map((s) => ({
        value: s.dataItem,
        target: s.el,
      })),
    };
  }

  /** Return array ของ [role="option"] ทั้งหมดใน container */
  function getAllOptionElements(): HTMLElement[] {
    const container = storage.select.containerEl;
    if (!container) return [];
    return Array.from(container.querySelectorAll('[role="option"]')) as HTMLElement[];
  }

  /** ฟังก์ชันหา index ของ el ใน getAllOptionElements() */
  function getIndexOf(el: HTMLElement): number {
    const all = getAllOptionElements();
    return all.indexOf(el);
  }

  /** ตรวจว่าปุ่ม aria-disabled="true" หรือไม่ */
  function isDisabled(el: HTMLElement): boolean {
    return el.getAttribute('aria-disabled') === 'true';
  }

  /** Single Select Logic => clear เก่า + select ใหม่ */
  function doSingleSelectLogic(el: HTMLElement) {
    storage.select.reselectAllowed = false;
    storage.select.unselectAllowed = false;
    const arr = storage.select.selectedItems;
    const idx = arr.findIndex((s) => s.el === el);
    if (idx >= 0) {
      // reSelect
      storage.select.reselectAllowed = true;
      callSelectEvent('reSelect', el);
      if (toggleable) {
        el.setAttribute('aria-selected', 'false');
        arr.splice(idx, 1);
        storage.select.unselectAllowed = true;
        callSelectEvent('unSelect', el);
      }
      return;
    }
    // clear ของเก่าหมด
    if (arr.length > 0) {
      for (const oldItem of [...arr]) {
        oldItem.el.setAttribute('aria-selected', 'false');
        callSelectEvent('unSelect', oldItem.el);
      }
      arr.length = 0;
      storage.select.unselectAllowed = true;
    }
    // select ใหม่
    el.setAttribute('aria-selected', 'true');
    arr.push({ el, dataItem: findDataItem(el) });
    callSelectEvent('select', el);
    callSelectEvent('didSelect', el);
  }

  /** Multi Select => toggle โดยไม่ clear อื่นๆ (เมื่อไม่มี shift/ctrl) */
  function doToggleItemWithoutUnselectOthers(el: HTMLElement) {
    storage.select.reselectAllowed = false;
    storage.select.unselectAllowed = false;
    const arr = storage.select.selectedItems;
    const idx = arr.findIndex((s) => s.el === el);
    if (idx >= 0) {
      // reSelect
      storage.select.reselectAllowed = true;
      callSelectEvent('reSelect', el);
      if (toggleable) {
        el.setAttribute('aria-selected', 'false');
        arr.splice(idx, 1);
        storage.select.unselectAllowed = true;
        callSelectEvent('unSelect', el);
      }
      return;
    }
    // ไม่เคย select => select เพิ่ม
    el.setAttribute('aria-selected', 'true');
    arr.push({ el, dataItem: findDataItem(el) });
    callSelectEvent('select', el);
    callSelectEvent('didSelect', el);
  }

  /** toggle select/unselect โดยไม่ clear เก่า (ใช้ในกรณี ctrl+click) */
  function doToggleItem(el: HTMLElement) {
    storage.select.reselectAllowed = false;
    storage.select.unselectAllowed = false;
    const arr = storage.select.selectedItems;
    const idx = arr.findIndex((s) => s.el === el);
    if (idx >= 0) {
      // ถ้าเคยเลือก => unselect
      el.setAttribute('aria-selected', 'false');
      arr.splice(idx, 1);
      storage.select.unselectAllowed = true;
      callSelectEvent('unSelect', el);
      return;
    }
    // ถ้าไม่เคย => select
    el.setAttribute('aria-selected', 'true');
    arr.push({ el, dataItem: findDataItem(el) });
    callSelectEvent('select', el);
    callSelectEvent('didSelect', el);
  }

  /** select ช่วง range ระหว่าง lastIndexClicked กับ el ปัจจุบัน (shift+click) */
  function doSelectRange(el: HTMLElement) {
    const arr = storage.select.selectedItems;
    const all = getAllOptionElements();
    const newIndex = getIndexOf(el);

    // ยังไม่เคยมี lastIndexClicked => ทำเหมือนคลิกเดี่ยว
    if (storage.select.lastIndexClicked == null || storage.select.lastIndexClicked < 0) {
      callSelectEvent('willSelect', el);
      doToggleItemWithoutUnselectOthers(el);
      storage.select.lastIndexClicked = newIndex;
      return;
    }

    const oldIndex = storage.select.lastIndexClicked;
    let start = Math.min(oldIndex, newIndex);
    let end = Math.max(oldIndex, newIndex);
    // ลบ selection เก่าทั้งหมด (สมมติ shift = เลือก range ใหม่)
    for (const oldItem of [...arr]) {
      oldItem.el.setAttribute('aria-selected', 'false');
      callSelectEvent('unSelect', oldItem.el);
    }
    arr.length = 0;
    // select ใหม่ทุกตัวในช่วง [start, end]
    for (let i = start; i <= end; i++) {
      const itemEl = all[i];
      if (!itemEl) continue;
      if (isDisabled(itemEl)) continue;
      itemEl.setAttribute('aria-selected', 'true');
      arr.push({ el: itemEl, dataItem: findDataItem(itemEl) });
      callSelectEvent('select', itemEl);
      callSelectEvent('didSelect', itemEl);
    }
    callSelectEvent('willSelect', el);
    storage.select.lastIndexClicked = newIndex;
  }

  /** ฟังก์ชัน selectByItem(val) */
  function selectByItem(val: string) {
    const container = storage.select.containerEl;
    if (!container) {
      throw new Error('[CSS-CTRL-ERR] selectByItem: no containerEl');
    }
    const el = container.querySelector(`[role="option"][id="${id}-${val}"]`) as HTMLElement | null;
    if (!el) {
      throw new Error(`[CSS-CTRL-ERR] selectByItem: no id="${id}-${val}" or role="option" found`);
    }
    if (isDisabled(el)) {
      return;
    }
    callSelectEvent('willSelect', el);
    if (selectMode === 'single') {
      doSingleSelectLogic(el);
    } else {
      doToggleItemWithoutUnselectOthers(el);
    }
    storage.select.activeItemEl = el;
    storage.select.lastIndexClicked = getIndexOf(el);
    updateAriaActiveDescendant();
    scrollToItem(el);
    container.focus();
  }

  /** ฟังก์ชัน unSelectByItem(val: string) */
  function unSelectByItem(val: string) {
    const container = storage.select.containerEl;
    if (!container) {
      throw new Error(`[CSS-CTRL-ERR] unSelectByItem: no containerEl`);
    }
    const el = container.querySelector(`[role="option"][id="${id}-${val}"]`) as HTMLElement | null;
    if (!el) {
      throw new Error(`[CSS-CTRL-ERR] unSelectByItem: no id="${id}-${val}" or role="option".`);
    }
    const arr = storage.select.selectedItems;
    const idx = arr.findIndex((it) => it.el === el);
    if (idx >= 0) {
      el.setAttribute('aria-selected', 'false');
      arr.splice(idx, 1);
      callSelectEvent('unSelect', el);
    }
  }

  /** ฟังก์ชัน unSelectAll() */
  function unSelectAll() {
    const arr = storage.select.selectedItems;
    for (const it of [...arr]) {
      it.el.setAttribute('aria-selected', 'false');
      callSelectEvent('unSelect', it.el);
    }
    arr.length = 0;
  }

  /** คืนค่ารายการ DataItem ที่ถูก select อยู่ */
  function getValues(): T[] {
    return storage.select.selectedItems.map((s) => s.dataItem).filter((x): x is T => !!x);
  }

  /**
   * อัปเดต aria-activedescendant ให้ container
   * ชี้ไปที่ id ของ activeItemEl (ถ้ามี)
   * พร้อมจัดการเพิ่ม/ลบคลาส .listboxPlugin-optionActive ด้วย
   */
  function updateAriaActiveDescendant() {
    const container = storage.select.containerEl;
    if (!container) return;
    const items = getAllOptionElements();
    items.forEach((it) => {
      it.classList.remove('listboxPlugin-optionActive');
    });
    const active = storage.select.activeItemEl;
    if (active) {
      container.setAttribute('aria-activedescendant', active.id);
      active.classList.add('listboxPlugin-optionActive');
    } else {
      container.removeAttribute('aria-activedescendant');
    }
  }

  /** handleKeyDown: ArrowUp/Down, Home/End, Enter/Space */
  function handleKeyDown(evt: KeyboardEvent) {
    const container = storage.select.containerEl;
    if (!container) return;
    switch (evt.key) {
      case 'ArrowUp':
        moveFocus(-1);
        evt.preventDefault();
        break;
      case 'ArrowDown':
        moveFocus(1);
        evt.preventDefault();
        break;
      case 'Home':
        evt.preventDefault();
        moveFocusTo(0);
        break;
      case 'End':
        evt.preventDefault();
        moveFocusToLast();
        break;
      case ' ':
      case 'Enter':
        if (storage.select.activeItemEl) {
          callSelectEvent('willSelect', storage.select.activeItemEl);
          if (selectMode === 'single') {
            doSingleSelectLogic(storage.select.activeItemEl);
          } else {
            doToggleItemWithoutUnselectOthers(storage.select.activeItemEl);
          }
          updateAriaActiveDescendant();
          scrollToItem(storage.select.activeItemEl);
          container.focus();
        }
        evt.preventDefault();
        break;
      default:
        break;
    }
  }

  /** moveFocus(direction) => ย้าย activeItemEl ไปยัง item ถัดไป/ก่อนหน้า (ข้าม disabled) */
  function moveFocus(direction: 1 | -1) {
    const items = getAllOptionElements();
    if (!items.length) return;
    let idx = items.findIndex((it) => it === storage.select.activeItemEl);
    if (idx < 0) {
      idx = 0;
    } else {
      let loopCount = 0;
      while (true) {
        idx = (idx + direction + items.length) % items.length;
        if (!isDisabled(items[idx])) {
          break;
        }
        loopCount++;
        if (loopCount > items.length) {
          // ไม่พบตัวที่ไม่ disabled เลย
          return;
        }
      }
    }
    storage.select.activeItemEl = items[idx];
    storage.select.lastIndexClicked = idx;
    updateAriaActiveDescendant();
    scrollToItem(items[idx]);
  }

  /** moveFocusTo(index) => ไปยัง index เป้าหมาย (ข้าม disabled) */
  function moveFocusTo(index: number) {
    const items = getAllOptionElements();
    if (!items.length) return;
    if (index < 0) index = 0;
    if (index >= items.length) index = items.length - 1;
    if (isDisabled(items[index])) {
      storage.select.activeItemEl = items[index];
      moveFocus(1);
      return;
    }
    storage.select.activeItemEl = items[index];
    storage.select.lastIndexClicked = index;
    updateAriaActiveDescendant();
    scrollToItem(items[index]);
  }

  /** moveFocusToLast() => item สุดท้าย (ถ้า disabled => วนถอยหลัง) */
  function moveFocusToLast() {
    const items = getAllOptionElements();
    if (!items.length) return;
    moveFocusTo(items.length - 1);
  }

  /** เมธอด focusItem(value) => โฟกัส item โดยไม่ select */
  function focusItem(val: string) {
    const container = storage.select.containerEl;
    if (!container) return;
    const el = container.querySelector(`[role="option"][id="${id}-${val}"]`) as HTMLElement | null;
    if (!el) return;
    if (isDisabled(el)) return;
    storage.select.activeItemEl = el;
    storage.select.lastIndexClicked = getIndexOf(el);
    updateAriaActiveDescendant();
    scrollToItem(el);
    container.focus();
  }

  // ---------- ฟังก์ชันช่วยสำหรับ Lazy Load ----------
  function doFirstLoad(fullData: T[], loadCount?: number) {
    const count = loadCount || fullData.length;
    const newData = fullData.slice(0, count);
    // เรียก event firstLoad
    callLazyEvent('firstLoad', newData);
    // เก็บ currentIndex
    if (storage.select.lazyState) {
      storage.select.lazyState.currentIndex = newData.length;
    }
  }

  function doLoadNextChunk(fullData: T[], loadCount?: number) {
    if (!storage.select.lazyState) return;
    const start = storage.select.lazyState.currentIndex;
    if (start >= fullData.length) {
      return; // load ครบแล้ว
    }
    const count = loadCount || fullData.length - start;
    const end = start + count;
    const newData = fullData.slice(start, end);

    callLazyEvent('willLoad', newData);
    storage.select.lazyState.currentIndex = end;
    callLazyEvent('loaded', newData);
    callLazyEvent('didLoaded', newData);
  }

  /**
   * ฟังก์ชันสำหรับเรียก event ที่เกี่ยวกับ "Lazy Load"
   * ได้แก่ firstLoad, willLoad, loaded, didLoaded
   * โดยจะส่งเป็น T[]
   */
  function callLazyEvent(name: 'firstLoad' | 'willLoad' | 'loaded' | 'didLoaded', data: T[]) {
    const cb = storage.select._events[name];
    if (cb) {
      cb(data);
    }
  }
  // ---------- จบฟังก์ชัน Lazy Load ----------

  // 3) return object (public API)
  return {
    container,
    events,
    actions: {
      destroy,
      selectByItem,
      unSelectByItem,
      unSelectAll,
      getValues,
      focusItem,
    },
    aria: {
      id: (val: string) => {
        return `${id}-${val}`;
      },
      role: 'option',
    },
  };
}
