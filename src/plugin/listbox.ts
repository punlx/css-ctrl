// src/plugin/listbox.ts

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

/** ตัวเลือกตั้งต้นของ listbox plugin
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

/** 5 callback ใน events(...) + Lazy Load 3 ตัวที่เหลือ (ตัด firstLoad ออก)
 * เพิ่ม <T> เพื่อให้แต่ละ event รับ/ส่งเป็น T[]
 */
interface SelectEvents<T> {
  willSelect?: (info: SelectCallbackInfo<T>) => void;
  select?: (info: SelectCallbackInfo<T>) => void;
  didSelect?: (info: SelectCallbackInfo<T>) => void;
  unSelect?: (info: SelectCallbackInfo<T>) => void;
  reSelect?: (info: SelectCallbackInfo<T>) => void;

  /** ----- Event สำหรับ Lazy Load (ยกเว้น firstLoad ที่ย้ายไป container) ----- */
  /** เรียกเมื่อ scroll ถึงล่างสุดก่อน load ถัดไป */
  willLoad?: (newData: T[]) => void;
  /** เรียกหลังจากโหลดเพิ่มเสร็จ (ต่อจาก willLoad) */
  loaded?: (newData: T[]) => void;
  /** เรียกหลัง loaded อีกที (จะเรียกซ้ำข้อมูลเดิม) */
  didLoaded?: (newData: T[]) => void;

  /** ----- Event สำหรับ Search ----- */
  /** เรียกก่อนจะเริ่ม filter (คืนค่า data ชุดเดิม หรือข้อมูลที่จะใช้ค้นหา) */
  willSearch?: (newData: T[]) => void;
  /** เรียกเมื่อได้ผลลัพธ์ filter แล้ว (matched items) */
  searched?: (newData: T[]) => void;
  /** เรียกหลัง searched อีกที (ถ้าต้องการทำงานต่อ) */
  didSearched?: (newData: T[]) => void;

  /** ----- Event สำหรับ Focus ----- */
  willFocus?: (info: SelectCallbackInfo<T>) => void;
  focused?: (info: SelectCallbackInfo<T>) => void;
  didFocus?: (info: SelectCallbackInfo<T>) => void;
}

/** ข้อมูลสำหรับ init(...)
 * เพิ่ม <T> เพื่อ data?: T[], และเพิ่ม onFirstLoad สำหรับ callback ของการโหลดรอบแรก
 */
interface InitParams<T> {
  ref: HTMLElement;
  data?: T[];

  /** callback สำหรับกรณีโหลดชุดแรก (แทน firstLoad ใน events) */
  init?: (newData: T[]) => void;
}

/** interface ของ storage ที่ plugin จะใช้
 * เพิ่ม <T> เพื่อรองรับ selectedItems: SelectedItem<T>
 * และ _selectData?: T[], _currentLoadedData?: T[]
 */
interface SelectStorage<T> extends Record<string, unknown> {
  select: {
    selectedItems: SelectedItem<T>[];
    _events: SelectEvents<T>;
    reselectAllowed: boolean;
    unselectAllowed: boolean;
    containerEl?: HTMLElement;
    _selectData?: T[];
    /** เก็บข้อมูลที่ “โหลดแล้ว” (Lazy Load) */
    _currentLoadedData?: T[];

    /** เก็บข้อมูล item ปัจจุบันที่โฟกัสหรือ active อยู่ (สำหรับ aria-activedescendant) */
    activeItemEl?: HTMLElement | null;
    /** เก็บ index ล่าสุดที่คลิก (ใช้ใน multi-select + shiftKey) */
    lastIndexClicked: number | null;

    /** State สำหรับ Lazy Load */
    lazyState?: {
      currentIndex: number; // เก็บจำนวน item ที่ load ไปแล้ว
    };

    /** เก็บ Param ที่ส่งให้ container เพื่อเข้าถึง onFirstLoad */
    containerParams?: InitParams<T>;
  };
}

/**
 * เพิ่ม <T extends DataItem = DataItem> เพื่อให้เป็น Generic
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

  // --------------------------------------------------------------------------
  // ฟังก์ชันช่วยอัปเดต class ของ option (selected/unselected/disabled)
  // --------------------------------------------------------------------------
  function updateOptionClasses(el: HTMLElement) {
    // selected/unselected
    const isSelected = el.getAttribute('aria-selected') === 'true';
    if (isSelected) {
      el.classList.add('listboxPlugin-selected');
      el.classList.remove('listboxPlugin-unselected');
    } else {
      el.classList.remove('listboxPlugin-selected');
      el.classList.add('listboxPlugin-unselected');
    }

    // disabled
    const isDisabled = el.getAttribute('aria-disabled') === 'true';
    if (isDisabled) {
      el.classList.add('listboxPlugin-disabled');
    } else {
      el.classList.remove('listboxPlugin-disabled');
    }
  }

  // --------------------------------------------------------------------------
  // ฟังก์ชันช่วยเลื่อน scroll
  // --------------------------------------------------------------------------
  function scrollToItem(el: HTMLElement) {
    if (!autoScroll) return;
    el.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: scrollBehavior,
    });
  }

  // --------------------------------------------------------------------------
  // container(...) => สำหรับ initialize + ใส่ ref, data, onFirstLoad
  // --------------------------------------------------------------------------
  function container(params: InitParams<T>) {
    const { ref, data, init: onFirstLoad } = params;

    // เก็บ params ไว้ใน storage เพื่อจะใช้ onFirstLoad ใน doFirstLoad
    storage.select.containerParams = params;

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

    // ถ้ามี lazyLoad และมี data ให้โหลดชุดแรก
    if (lazyLoad && data && data.length) {
      doFirstLoad(data, lazyLoad.firstLoad);
      ref.onscroll = (evt) => {
        const el = evt.target as HTMLElement;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight) {
          doLoadNextChunk(data, lazyLoad.nextLoad);
        }
      };
    } else {
      // กรณีไม่มี lazyLoad หรือไม่มี data
      storage.select._currentLoadedData = data || [];
    }
  }

  // --------------------------------------------------------------------------
  // events(...) => สำหรับตั้งค่า callback (ยกเว้น firstLoad ที่ย้ายไป container)
  // --------------------------------------------------------------------------
  function events(ev: SelectEvents<T>) {
    storage.select._events = {
      willSelect: ev.willSelect,
      select: ev.select,
      didSelect: ev.didSelect,
      unSelect: ev.unSelect,
      reSelect: ev.reSelect,
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

  // --------------------------------------------------------------------------
  // destroy() => ลบ event, คืนค่า state
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // ส่วน handleContainerClick(...) => จัดการคลิกเลือก item
  // --------------------------------------------------------------------------
  function handleContainerClick(evt: MouseEvent) {
    const el = (evt.target as HTMLElement).closest('[role="option"]') as HTMLElement | null;
    if (!el) return;
    if (el.getAttribute('aria-disabled') === 'true') {
      return;
    }

    // -- สำหรับโหมด single-then-multi --
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

    // -- สำหรับโหมด multi --
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

    // -- โหมด single หรืออื่น ๆ --
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

  // --------------------------------------------------------------------------
  // callSelectEvent(...) และ callFocusEvent(...)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // extractValueByPath(...) => ดึงค่าจาก object ตาม path
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // findDataItem(...) => หา data item จาก id (ใช้ structure เทียบ)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // buildInfo(...) => สร้างโครงสร้าง SelectCallbackInfo
  // --------------------------------------------------------------------------
  function buildInfo(el: HTMLElement) {
    const selectedArray = storage.select.selectedItems
      .map((s) => s.dataItem)
      .filter(Boolean) as T[];

    // สร้าง keyMap { [value:string]: T } จาก structure
    const keyMap: { [value: string]: T } = {};
    for (const item of selectedArray) {
      if (!structure) continue;
      const extracted = extractValueByPath(item, structure);
      const k = String(extracted);
      keyMap[k] = item; // เก็บตัวท้ายที่เจอ
    }

    return {
      value: findDataItem(el),
      target: el,
      list: storage.select.selectedItems.map((s) => ({
        value: s.dataItem,
        target: s.el,
      })),
      listValue: selectedArray,
      keyValue: keyMap,
    };
  }

  // --------------------------------------------------------------------------
  // getAllOptionElements, getIndexOf, isDisabled
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // doSingleSelectLogic(...) => สำหรับการเลือกแบบ single (clear ของเก่า)
  // --------------------------------------------------------------------------
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
        updateOptionClasses(oldItem.el);
        callSelectEvent('unSelect', oldItem.el);
      }
      arr.length = 0;
      storage.select.unselectAllowed = true;
    }

    el.setAttribute('aria-selected', 'true');
    updateOptionClasses(el);
    arr.push({ el, dataItem: findDataItem(el) });
    callSelectEvent('select', el);
    callSelectEvent('didSelect', el);
  }

  // --------------------------------------------------------------------------
  // doToggleItemWithoutUnselectOthers(...)
  // --------------------------------------------------------------------------
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
        updateOptionClasses(el);
        arr.splice(idx, 1);
        storage.select.unselectAllowed = true;
        callSelectEvent('unSelect', el);
      }
      return;
    }
    el.setAttribute('aria-selected', 'true');
    updateOptionClasses(el);
    arr.push({ el, dataItem: findDataItem(el) });
    callSelectEvent('select', el);
    callSelectEvent('didSelect', el);
  }

  // --------------------------------------------------------------------------
  // doToggleItem(...)
  // --------------------------------------------------------------------------
  function doToggleItem(el: HTMLElement) {
    storage.select.reselectAllowed = false;
    storage.select.unselectAllowed = false;
    const arr = storage.select.selectedItems;
    const idx = arr.findIndex((s) => s.el === el);
    if (idx >= 0) {
      el.setAttribute('aria-selected', 'false');
      updateOptionClasses(el);
      arr.splice(idx, 1);
      storage.select.unselectAllowed = true;
      callSelectEvent('unSelect', el);
      return;
    }
    el.setAttribute('aria-selected', 'true');
    updateOptionClasses(el);
    arr.push({ el, dataItem: findDataItem(el) });
    callSelectEvent('select', el);
    callSelectEvent('didSelect', el);
  }

  // --------------------------------------------------------------------------
  // doSelectRange(...) => shift + click (multi select แบบ range)
  // --------------------------------------------------------------------------
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
      updateOptionClasses(oldItem.el);
      callSelectEvent('unSelect', oldItem.el);
    }
    arr.length = 0;
    for (let i = start; i <= end; i++) {
      const itemEl = all[i];
      if (!itemEl) continue;
      if (isDisabled(itemEl)) continue;
      itemEl.setAttribute('aria-selected', 'true');
      updateOptionClasses(itemEl);
      arr.push({ el: itemEl, dataItem: findDataItem(itemEl) });
      callSelectEvent('select', itemEl);
      callSelectEvent('didSelect', itemEl);
    }
    callSelectEvent('willSelect', el);
    storage.select.lastIndexClicked = newIndex;
  }

  // --------------------------------------------------------------------------
  // selectByItem(...) => เลือก item จาก value string
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // unSelectByItem(...)
  // --------------------------------------------------------------------------
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
      updateOptionClasses(el);
      arr.splice(idx, 1);
      callSelectEvent('unSelect', el);
    }
  }

  // --------------------------------------------------------------------------
  // unSelectAll(...)
  // --------------------------------------------------------------------------
  function unSelectAll() {
    const arr = storage.select.selectedItems;
    for (const it of [...arr]) {
      it.el.setAttribute('aria-selected', 'false');
      updateOptionClasses(it.el);
      callSelectEvent('unSelect', it.el);
    }
    arr.length = 0;
  }

  // --------------------------------------------------------------------------
  // getValues() => คืนค่า data ที่ถูกเลือกทั้งหมด (array)
  // --------------------------------------------------------------------------
  function getValues(): T[] {
    return storage.select.selectedItems.map((s) => s.dataItem).filter((x): x is T => !!x);
  }

  // --------------------------------------------------------------------------
  // updateAriaActiveDescendant(...) => ใส่/เคลียร์ aria-activedescendant
  // --------------------------------------------------------------------------
  function updateAriaActiveDescendant() {
    const container = storage.select.containerEl;
    if (!container) return;
    const items = getAllOptionElements();
    items.forEach((it) => {
      it.classList.remove('listboxPlugin-active');
    });
    const active = storage.select.activeItemEl;
    if (active) {
      container.setAttribute('aria-activedescendant', active.id);
      active.classList.add('listboxPlugin-active');
    } else {
      container.removeAttribute('aria-activedescendant');
    }
  }

  // --------------------------------------------------------------------------
  // handleKeyDown(...) => จัดการ keyboard event
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // moveFocus(direction: 1 | -1) => เลื่อน focus ขึ้น/ลง
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // moveFocusTo(index: number)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // moveFocusToLast()
  // --------------------------------------------------------------------------
  function moveFocusToLast() {
    const items = getAllOptionElements();
    if (!items.length) return;
    moveFocusTo(items.length - 1);
  }

  // --------------------------------------------------------------------------
  // focusItem(val: string) => focus item ใด ๆ (ไม่ select)
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // doFirstLoad(...) => โหลดรอบแรก
  // (ย้ายการเรียก callback มาเรียก onFirstLoad จาก containerParams)
  // --------------------------------------------------------------------------
  function doFirstLoad(fullData: T[], loadCount?: number) {
    const count = loadCount || fullData.length;
    const newData = fullData.slice(0, count);

    // เรียก callback ที่กำหนดใน containerParams (ถ้ามี)
    const onFirstLoad = storage.select.containerParams?.init;
    if (onFirstLoad) {
      onFirstLoad(newData);
    }

    if (storage.select.lazyState) {
      storage.select.lazyState.currentIndex = newData.length;
    }
    storage.select._currentLoadedData = newData;
  }

  // --------------------------------------------------------------------------
  // doLoadNextChunk(...) => load chunk ถัดไปเมื่อ scroll สุด
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // callLazyEvent(...) => เรียก event lazyLoad (จะไม่มี firstLoad แล้ว)
  // --------------------------------------------------------------------------
  function callLazyEvent(name: 'willLoad' | 'loaded' | 'didLoaded', data: T[]) {
    const cb = storage.select._events[name];
    if (cb) {
      cb(data);
    }
  }

  // --------------------------------------------------------------------------
  // callSearchEvent(...) => สำหรับ event ค้นหา (willSearch, searched, didSearched)
  // --------------------------------------------------------------------------
  function callSearchEvent(name: 'willSearch' | 'searched' | 'didSearched', data: T[]) {
    const cb = storage.select._events[name];
    if (cb) {
      cb(data);
    }
  }

  // --------------------------------------------------------------------------
  // searchItem(...) => ค้นหาจาก _currentLoadedData (แทน _selectData)
  // --------------------------------------------------------------------------
  function searchItem(query: string, matchMode: 'substring' | 'startsWith') {
    const loadedData = storage.select._currentLoadedData || [];
    callSearchEvent('willSearch', loadedData);

    const keyword = query.trim().toLowerCase();
    let filtered = loadedData;
    if (keyword) {
      filtered = loadedData.filter((item) => {
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

  // --------------------------------------------------------------------------
  // Return ค่าออกเป็น object API
  // --------------------------------------------------------------------------
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
