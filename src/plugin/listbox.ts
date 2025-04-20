// src/plugin/select.ts

/** โครงสร้างข้อมูลสำหรับ DataItem */
interface DataItem {
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

  /**
   * โครงสร้าง path สำหรับเจาะข้อมูลใน item (เดิมคือ valueKey)
   * เช่น 'valueKey.val.$'
   */
  structure?: string;
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
  /** เพิ่ม listValue สำหรับคืนค่ารายการทั้งหมดที่ถูก select */
  listValue: T[];
  /** เพิ่ม keyValue สำหรับ map key -> T (เปลี่ยนไม่เป็น array แล้ว) */
  keyValue: {
    [value: string]: T;
  };
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

  /** ----- Event ใหม่สำหรับ Search ----- */
  /** เรียกก่อนจะเริ่ม filter (คืนค่า data ชุดเดิม หรือข้อมูลที่จะใช้ค้นหา) */
  willSearch?: (newData: T[]) => void;
  /** เรียกเมื่อได้ผลลัพธ์ filter แล้ว (matched items) */
  searched?: (newData: T[]) => void;
  /** เรียกหลัง searched อีกที (ถ้าต้องการทำงานต่อ) */
  didSearched?: (newData: T[]) => void;

  /** ----- Event ใหม่สำหรับ Focus ----- */
  willFocus?: (info: SelectCallbackInfo<T>) => void;
  focused?: (info: SelectCallbackInfo<T>) => void;
  didFocus?: (info: SelectCallbackInfo<T>) => void;
}

/** ข้อมูลสำหรับ init(...)
 * เพิ่ม <T> เพื่อ data?: T[]
 * (ในที่นี้ ไม่ต้องมี valueKey อีกต่อไป)
 */
interface InitParams<T> {
  ref: HTMLElement;
  data?: T[];
}

/** interface ของ storage ที่ plugin จะใช้
 * เพิ่ม <T> เพื่อรองรับ selectedItems: SelectedItem<T>
 * และ _selectData?: T[]
 */
interface SelectStorage<T> extends Record<string, unknown> {
  select: {
    selectedItems: SelectedItem<T>[];
    _events: SelectEvents<T>;
    reselectAllowed: boolean;
    unselectAllowed: boolean;
    containerEl?: HTMLElement;
    _selectData?: T[];
    /** ----- เพิ่ม _currentLoadedData สำหรับเก็บข้อมูลที่ “โหลดแล้ว” ----- */
    _currentLoadedData?: T[];

    /** เก็บข้อมูล item ปัจจุบันที่โฟกัสหรือ active อยู่ (สำหรับ aria-activedescendant) */
    activeItemEl?: HTMLElement | null;
    /** เก็บ index ล่าสุดที่คลิก (ใช้ใน multi-select + shiftKey) */
    lastIndexClicked: number | null;

    /** ----- State สำหรับ Lazy Load ----- */
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
 * - เพิ่ม structure (แทน valueKey เดิม) ใช้ในการ extract ค่าจาก item
 */
export function listbox<T extends DataItem = DataItem>(options: SelectOptions<T>) {
  const {
    id = '',
    toggleable = false,
    type = 'single-select',
    autoScroll = true,
    scrollBehavior = 'auto',
    lazyLoad,
    structure,
  } = options;

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

  const storage: SelectStorage<T> = {
    select: {
      selectedItems: [],
      _events: {},
      reselectAllowed: false,
      unselectAllowed: false,
      activeItemEl: null,
      lastIndexClicked: null,
      lazyState: {
        currentIndex: 0,
      },
      _currentLoadedData: [],
    },
  };

  function scrollToItem(el: HTMLElement) {
    if (!autoScroll) return;
    el.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: scrollBehavior,
    });
  }

  function container(params: InitParams<T>) {
    const { ref, data } = params;
    ref.role = 'listbox';
    ref.id = id;
    ref.tabIndex = 0;

    ref.ariaMultiSelectable = selectMode === 'multi' ? 'true' : 'false';

    storage.select.containerEl = ref;
    storage.select._selectData = data;

    if (data) {
      if (!structure) {
        throw new Error(
          `[CSS-CTRL-ERR] select.listbox({ structure }) is required when using select.listbox({ data }) in a container with role="listbox".`
        );
      }
    }

    ref.onclick = handleContainerClick;
    ref.onkeydown = handleKeyDown;

    if (lazyLoad && data && data.length) {
      doFirstLoad(data, lazyLoad.firstLoad);
      ref.onscroll = (evt) => {
        const el = evt.target as HTMLElement;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight) {
          doLoadNextChunk(data, lazyLoad.nextLoad);
        }
      };
    } else {
      storage.select._currentLoadedData = data || [];
    }
  }

  function events(ev: SelectEvents<T>) {
    storage.select._events = {
      willSelect: ev.willSelect,
      select: ev.select,
      didSelect: ev.didSelect,
      unSelect: ev.unSelect,
      reSelect: ev.reSelect,
      firstLoad: ev.firstLoad,
      willLoad: ev.willLoad,
      loaded: ev.loaded,
      didLoaded: ev.didLoaded,
      willSearch: ev.willSearch,
      searched: ev.searched,
      didSearched: ev.didSearched,
      willFocus: ev.willFocus,
      focused: ev.focused,
      didFocus: ev.didFocus,
    };
  }

  function destroy() {
    const ref = storage.select.containerEl;
    if (!ref) return;
    ref.onclick = null;
    ref.onkeydown = null;
    ref.onscroll = null;
    storage.select.activeItemEl = null;
    storage.select.selectedItems = [];
    storage.select.lastIndexClicked = null;
    storage.select.containerEl = undefined;
  }

  function handleContainerClick(evt: MouseEvent) {
    const el = (evt.target as HTMLElement).closest('[role="option"]') as HTMLElement | null;
    if (!el) return;
    if (el.getAttribute('aria-disabled') === 'true') {
      return;
    }

    if (type === 'single-then-multi') {
      if (evt.shiftKey) {
        doSelectRange(el);
        callFocusEvent('willFocus', el);
        storage.select.activeItemEl = el;
        callFocusEvent('focused', el);
        updateAriaActiveDescendant();
        scrollToItem(el);
        callFocusEvent('didFocus', el);
        storage.select.lastIndexClicked = getIndexOf(el);
        storage.select.containerEl?.focus();
        return;
      } else if (evt.ctrlKey || evt.metaKey) {
        doToggleItem(el);
        callFocusEvent('willFocus', el);
        storage.select.activeItemEl = el;
        callFocusEvent('focused', el);
        updateAriaActiveDescendant();
        scrollToItem(el);
        callFocusEvent('didFocus', el);
        storage.select.lastIndexClicked = getIndexOf(el);
        storage.select.containerEl?.focus();
        return;
      } else {
        callSelectEvent('willSelect', el);
        doSingleSelectLogic(el);
        callFocusEvent('willFocus', el);
        storage.select.activeItemEl = el;
        callFocusEvent('focused', el);
        updateAriaActiveDescendant();
        scrollToItem(el);
        callFocusEvent('didFocus', el);
        storage.select.lastIndexClicked = getIndexOf(el);
        storage.select.containerEl?.focus();
        return;
      }
    }

    if (selectMode === 'multi') {
      if (evt.shiftKey) {
        doSelectRange(el);
        callFocusEvent('willFocus', el);
        storage.select.activeItemEl = el;
        callFocusEvent('focused', el);
        updateAriaActiveDescendant();
        scrollToItem(el);
        callFocusEvent('didFocus', el);
        storage.select.containerEl?.focus();
        return;
      }
      if (evt.ctrlKey || evt.metaKey) {
        doToggleItem(el);
        callFocusEvent('willFocus', el);
        storage.select.activeItemEl = el;
        callFocusEvent('focused', el);
        updateAriaActiveDescendant();
        scrollToItem(el);
        callFocusEvent('didFocus', el);
        storage.select.lastIndexClicked = getIndexOf(el);
        storage.select.containerEl?.focus();
        return;
      }
    }

    callSelectEvent('willSelect', el);
    if (selectMode === 'single') {
      doSingleSelectLogic(el);
    } else {
      doToggleItemWithoutUnselectOthers(el);
    }
    callFocusEvent('willFocus', el);
    storage.select.activeItemEl = el;
    callFocusEvent('focused', el);
    updateAriaActiveDescendant();
    scrollToItem(el);
    callFocusEvent('didFocus', el);
    storage.select.lastIndexClicked = getIndexOf(el);
    storage.select.containerEl?.focus();
  }

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

  function callFocusEvent(name: 'willFocus' | 'focused' | 'didFocus', el: HTMLElement) {
    const cb = storage.select._events[name];
    if (cb) {
      const info = buildInfo(el);
      cb(info);
    }
  }

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
    const val = el.id.slice(id.length + 1);
    if (!val) return null;
    if (!structure) {
      throw new Error(
        `[CSS-CTRL-ERR] No structure specified, can't parse data item for value "${val}".`
      );
    }
    for (const item of data) {
      const extracted = extractValueByPath(item, structure);
      if (extracted === undefined || extracted === null) {
        continue;
      }
      if (String(extracted) === val) {
        return item;
      }
    }
    throw new Error(
      `[CSS-CTRL-ERR] No matched data item for value "${val}" using structure="${structure}".`
    );
  }

  function buildInfo(el: HTMLElement) {
    const selectedArray = storage.select.selectedItems
      .map((s) => s.dataItem)
      .filter(Boolean) as T[];

    // keyValue: { [value: string]: T }
    // ถ้าพบ key เดิมซ้ำกันหลายตัว เราจะเก็บตัวสุดท้ายไว้แทน
    const keyMap: { [value: string]: T } = {};
    for (const item of selectedArray) {
      if (!structure) continue;
      const extracted = extractValueByPath(item, structure);
      const k = String(extracted);
      // เก็บตัวสุดท้ายที่เจอ
      keyMap[k] = item;
    }

    return {
      value: findDataItem(el),
      target: el,
      list: storage.select.selectedItems.map((s) => ({
        value: s.dataItem,
        target: s.el,
      })),
      listValue: selectedArray,
      keyValue: keyMap, // <-- ไม่เป็น array แล้ว
    };
  }

  function getAllOptionElements(): HTMLElement[] {
    const container = storage.select.containerEl;
    if (!container) return [];
    return Array.from(container.querySelectorAll('[role="option"]')) as HTMLElement[];
  }

  function getIndexOf(el: HTMLElement): number {
    const all = getAllOptionElements();
    return all.indexOf(el);
  }

  function isDisabled(el: HTMLElement): boolean {
    return el.getAttribute('aria-disabled') === 'true';
  }

  function doSingleSelectLogic(el: HTMLElement) {
    storage.select.reselectAllowed = false;
    storage.select.unselectAllowed = false;
    const arr = storage.select.selectedItems;
    const idx = arr.findIndex((s) => s.el === el);

    if (idx >= 0) {
      storage.select.reselectAllowed = true;
      callSelectEvent('reSelect', el);
    }

    if (arr.length > 0) {
      for (const oldItem of [...arr]) {
        oldItem.el.setAttribute('aria-selected', 'false');
        callSelectEvent('unSelect', oldItem.el);
      }
      arr.length = 0;
      storage.select.unselectAllowed = true;
    }

    el.setAttribute('aria-selected', 'true');
    arr.push({ el, dataItem: findDataItem(el) });
    callSelectEvent('select', el);
    callSelectEvent('didSelect', el);
  }

  function doToggleItemWithoutUnselectOthers(el: HTMLElement) {
    storage.select.reselectAllowed = false;
    storage.select.unselectAllowed = false;
    const arr = storage.select.selectedItems;
    const idx = arr.findIndex((s) => s.el === el);
    if (idx >= 0) {
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
    el.setAttribute('aria-selected', 'true');
    arr.push({ el, dataItem: findDataItem(el) });
    callSelectEvent('select', el);
    callSelectEvent('didSelect', el);
  }

  function doToggleItem(el: HTMLElement) {
    storage.select.reselectAllowed = false;
    storage.select.unselectAllowed = false;
    const arr = storage.select.selectedItems;
    const idx = arr.findIndex((s) => s.el === el);
    if (idx >= 0) {
      el.setAttribute('aria-selected', 'false');
      arr.splice(idx, 1);
      storage.select.unselectAllowed = true;
      callSelectEvent('unSelect', el);
      return;
    }
    el.setAttribute('aria-selected', 'true');
    arr.push({ el, dataItem: findDataItem(el) });
    callSelectEvent('select', el);
    callSelectEvent('didSelect', el);
  }

  function doSelectRange(el: HTMLElement) {
    const arr = storage.select.selectedItems;
    const all = getAllOptionElements();
    const newIndex = getIndexOf(el);

    if (storage.select.lastIndexClicked == null || storage.select.lastIndexClicked < 0) {
      callSelectEvent('willSelect', el);
      doToggleItemWithoutUnselectOthers(el);
      storage.select.lastIndexClicked = newIndex;
      return;
    }

    const oldIndex = storage.select.lastIndexClicked;
    let start = Math.min(oldIndex, newIndex);
    let end = Math.max(oldIndex, newIndex);
    for (const oldItem of [...arr]) {
      oldItem.el.setAttribute('aria-selected', 'false');
      callSelectEvent('unSelect', oldItem.el);
    }
    arr.length = 0;
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

    callFocusEvent('willFocus', el);
    storage.select.activeItemEl = el;
    callFocusEvent('focused', el);
    updateAriaActiveDescendant();
    scrollToItem(el);
    callFocusEvent('didFocus', el);

    storage.select.lastIndexClicked = getIndexOf(el);
    container.focus();
  }

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

  function unSelectAll() {
    const arr = storage.select.selectedItems;
    for (const it of [...arr]) {
      it.el.setAttribute('aria-selected', 'false');
      callSelectEvent('unSelect', it.el);
    }
    arr.length = 0;
  }

  function getValues(): T[] {
    return storage.select.selectedItems.map((s) => s.dataItem).filter((x): x is T => !!x);
  }

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
          return;
        }
      }
    }

    callFocusEvent('willFocus', items[idx]);
    storage.select.activeItemEl = items[idx];
    callFocusEvent('focused', items[idx]);
    updateAriaActiveDescendant();
    scrollToItem(items[idx]);
    callFocusEvent('didFocus', items[idx]);

    storage.select.lastIndexClicked = idx;
  }

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

    callFocusEvent('willFocus', items[index]);
    storage.select.activeItemEl = items[index];
    callFocusEvent('focused', items[index]);
    updateAriaActiveDescendant();
    scrollToItem(items[index]);
    callFocusEvent('didFocus', items[index]);

    storage.select.lastIndexClicked = index;
  }

  function moveFocusToLast() {
    const items = getAllOptionElements();
    if (!items.length) return;
    moveFocusTo(items.length - 1);
  }

  function focusItem(val: string) {
    const container = storage.select.containerEl;
    if (!container) return;
    const el = container.querySelector(`[role="option"][id="${id}-${val}"]`) as HTMLElement | null;
    if (!el) return;
    if (isDisabled(el)) return;

    callFocusEvent('willFocus', el);
    storage.select.activeItemEl = el;
    callFocusEvent('focused', el);
    updateAriaActiveDescendant();
    scrollToItem(el);
    callFocusEvent('didFocus', el);

    storage.select.lastIndexClicked = getIndexOf(el);
    container.focus();
  }

  function doFirstLoad(fullData: T[], loadCount?: number) {
    const count = loadCount || fullData.length;
    const newData = fullData.slice(0, count);
    callLazyEvent('firstLoad', newData);
    if (storage.select.lazyState) {
      storage.select.lazyState.currentIndex = newData.length;
    }
    storage.select._currentLoadedData = newData;
  }

  function doLoadNextChunk(fullData: T[], loadCount?: number) {
    if (!storage.select.lazyState) return;
    const start = storage.select.lazyState.currentIndex;
    if (start >= fullData.length) {
      return;
    }
    const count = loadCount || fullData.length - start;
    const end = start + count;
    const newData = fullData.slice(start, end);

    callLazyEvent('willLoad', newData);
    storage.select.lazyState.currentIndex = end;
    callLazyEvent('loaded', newData);
    callLazyEvent('didLoaded', newData);

    storage.select._currentLoadedData = [...(storage.select._currentLoadedData || []), ...newData];
  }

  function callLazyEvent(name: 'firstLoad' | 'willLoad' | 'loaded' | 'didLoaded', data: T[]) {
    const cb = storage.select._events[name];
    if (cb) {
      cb(data);
    }
  }

  function callSearchEvent(name: 'willSearch' | 'searched' | 'didSearched', data: T[]) {
    const cb = storage.select._events[name];
    if (cb) {
      cb(data);
    }
  }

  function searchItem(query: string, matchMode: 'substring' | 'startsWith') {
    const fullData = storage.select._selectData || [];
    callSearchEvent('willSearch', fullData);

    const keyword = query.trim().toLowerCase();
    let filtered = fullData;
    if (keyword) {
      filtered = fullData.filter((item) => {
        const text = (item.display || '').toString().toLowerCase();
        if (matchMode === 'startsWith') {
          return text.startsWith(keyword);
        }
        return text.includes(keyword);
      });
    }

    callSearchEvent('searched', filtered);
    callSearchEvent('didSearched', filtered);

    return filtered;
  }

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
      searchItem,
    },
    aria: {
      option: (item: T) => {
        if (!structure) {
          throw new Error(`[CSS-CTRL-ERR] No structure specified, can't generate id from item.`);
        }
        const extracted = extractValueByPath(item, structure);
        const itemVal = extracted == null ? '' : String(extracted);

        const finalId = `${id}-${itemVal}`;

        return {
          id: finalId,
          role: 'option',
        };
      },
    },
  };
}
