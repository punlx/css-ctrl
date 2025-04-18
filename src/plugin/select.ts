// src/plugin/select.ts

/** โครงสร้างข้อมูลสำหรับ DataItem */
interface DataItem {
  [key: string]: any;
}

/** ตัวเลือกตั้งต้นของ select plugin */
interface SelectOptions {
  toggleable?: boolean; // เลือกซ้ำตัวเดิม => unselect
  clearPrevious?: boolean; // เลือกตัวใหม่ => เคลียร์ของเก่าทั้งหมด
}

/** โครงสร้างเก็บ item ที่ select */
interface SelectedItem {
  el: HTMLElement;
  dataItem: DataItem | null;
}

/** ข้อมูลส่งเข้า callback */
interface SelectCallbackInfo {
  value: DataItem | null;
  target: HTMLElement;
  list: Array<{ value: DataItem | null; target: HTMLElement }>;
}

/** 5 callback ใน events(...) */
interface SelectEvents {
  willSelect?: (info: SelectCallbackInfo) => void;
  select?: (info: SelectCallbackInfo) => void;
  didSelect?: (info: SelectCallbackInfo) => void;
  unSelect?: (info: SelectCallbackInfo) => void;
  reSelect?: (info: SelectCallbackInfo) => void;
}

/** ข้อมูลสำหรับ init(...) */
interface InitParams {
  ref: HTMLElement; // container <div role="listbox" class=...>
  data?: DataItem[]; // array ของ { value, display, ... }
  valueKey?: string;
}

/** interface ของ storage ที่ plugin จะใช้ */
export interface SelectStorage extends Record<string, unknown> {
  select: {
    selectedItems: SelectedItem[];
    _events: SelectEvents;
    reselectAllowed: boolean;
    unselectAllowed: boolean;
    valueKey?: string;
    containerEl?: HTMLElement;
    _selectData?: DataItem[];
  };
}

/**
 * สุดท้าย: export function select(...)
 * เดิมคืน CssCtrlPlugin, ตอนนี้เราทำเป็นฟังก์ชันตรงๆ
 */
export function select(options: SelectOptions = { clearPrevious: true, toggleable: false }) {
  // 1) สร้าง dummy storage (โค้ดเดิมสั้น ๆ ที่เคยเป็น (storage, className)=>...)
  const storage: SelectStorage = {
    select: {
      selectedItems: [],
      _events: {},
      reselectAllowed: false,
      unselectAllowed: false,
    },
  };

  const { toggleable = false, clearPrevious = true } = options;

  // 2) ฟังก์ชันภายใน = Logic เดิมๆ
  function listbox(params: InitParams) {
    const { ref, data, valueKey } = params;

    // เก็บ container + data
    storage.select.containerEl = ref;
    storage.select._selectData = data;

    // =========== จุดสำคัญ: เช็ค role="option" ===========
    if (data) {
      const el = ref.querySelector(`[data-value]`) as HTMLElement | null;
      if (!el) {
        throw new Error(
          `[CSS-CTRL-ERR] Missing [data-value="..."] in container with role="listbox" despite select.listbox({ data }) configuration.`
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
    const el = ref.querySelector(`[role="option"]`);
    if (!el) {
      throw new Error(
        `[CSS-CTRL-ERR] Each item within a container assigned role="listbox" must include role="option".`
      );
    }

    // ====== end check =====

    // ผูก event click
    ref.onclick = handleContainerClick;
  }

  function events(ev: SelectEvents) {
    storage.select._events = {
      willSelect: ev.willSelect,
      select: ev.select,
      didSelect: ev.didSelect,
      unSelect: ev.unSelect,
      reSelect: ev.reSelect,
    };
  }

  function handleContainerClick(evt: MouseEvent) {
    const el = (evt.target as HTMLElement).closest('[role="option"]') as HTMLElement | null;
    if (!el) return;
    if (el.getAttribute('aria-disabled') === 'true') {
      // ถ้าเป็น disabled => ข้ามเลย ไม่ทำงานอะไร
      return;
    }
    // call willSelect
    callEvent('willSelect', el);
    // ทำลอจิก select / unselect
    doSelectLogic(el);
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

  function findDataItem(el: HTMLElement): DataItem | null {
    const data = storage.select._selectData || [];
    const val = el.dataset.value;
    if (!val) return null;

    if (!storage.select.valueKey) {
      throw new Error(
        `[CSS-CTRL-ERR] No valueKey specified, can't parse data item for data-value="${val}".`
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
      `[CSS-CTRL-ERR] No matched data item for data-value="${val}" using valueKey="${storage.select.valueKey}".`
    );
  }

  function buildInfo(el: HTMLElement): SelectCallbackInfo {
    return {
      value: findDataItem(el),
      target: el,
      list: storage.select.selectedItems.map((s) => ({
        value: s.dataItem,
        target: s.el,
      })),
    };
  }

  function callEvent(name: keyof SelectEvents, el: HTMLElement) {
    const cb = storage.select._events[name];
    if (cb) {
      cb(buildInfo(el));
    }
  }

  function doSelectLogic(el: HTMLElement) {
    storage.select.reselectAllowed = false;
    storage.select.unselectAllowed = false;

    const arr = storage.select.selectedItems;
    const idx = arr.findIndex((s) => s.el === el);
    const isSelected = idx >= 0;

    if (isSelected) {
      // reSelect
      storage.select.reselectAllowed = true;
      callEvent('reSelect', el);

      if (toggleable) {
        // remove item
        el.setAttribute('aria-selected', 'false');
        arr.splice(idx, 1);

        storage.select.unselectAllowed = true;
        callEvent('unSelect', el);
      }
      return;
    }

    // ถ้าไม่เคย => clearPrevious => เคลียร์ของเก่าทั้งหมด
    if (clearPrevious && arr.length > 0) {
      for (const oldItem of [...arr]) {
        oldItem.el.setAttribute('aria-selected', 'false');
        const oldIdx = arr.findIndex((x) => x.el === oldItem.el);
        if (oldIdx >= 0) {
          arr.splice(oldIdx, 1);
        }
        storage.select.unselectAllowed = true;
        callEvent('unSelect', oldItem.el);
      }
    }

    // select ใหม่
    el.setAttribute('aria-selected', 'true');
    arr.push({ el, dataItem: findDataItem(el) });

    callEvent('select', el);
    callEvent('didSelect', el);
  }

  function selectByItem(val: string) {
    const container = storage.select.containerEl;
    if (!container) {
      throw new Error('[CSS-CTRL-ERR] selectByItem: no containerEl');
    }
    const el = container.querySelector(
      `[role="option"][data-value="${val}"]`
    ) as HTMLElement | null;
    if (!el) {
      throw new Error(`[CSS-CTRL-ERR] selectByItem: no data-value="${val}" or role="option" found`);
    }
    if (el.getAttribute('aria-disabled') === 'true') {
      return;
    }
    callEvent('willSelect', el);
    doSelectLogic(el);
  }

  function unSelectByItem(val: string) {
    const container = storage.select.containerEl;
    if (!container) {
      throw new Error(`[CSS-CTRL-ERR] unSelectByItem: no containerEl`);
    }
    const el = container.querySelector(
      `[role="option"][data-value="${val}"]`
    ) as HTMLElement | null;
    if (!el) {
      throw new Error(`[CSS-CTRL-ERR] unSelectByItem: no data-value="${val}" or role="option".`);
    }

    const arr = storage.select.selectedItems;
    const idx = arr.findIndex((it) => it.el === el);
    if (idx >= 0) {
      el.setAttribute('aria-selected', 'false');
      arr.splice(idx, 1);
    }
    callEvent('unSelect', el);
  }

  function unSelectAll() {
    const arr = storage.select.selectedItems;
    for (const it of [...arr]) {
      it.el.setAttribute('aria-selected', 'false');
      callEvent('unSelect', it.el);
    }
    arr.length = 0;
  }

  function getSelectedValues() {
    return storage.select.selectedItems.map((s) => s.dataItem).filter(Boolean) as DataItem[];
  }

  // 3) return
  return {
    listbox,
    events,
    actions: {
      selectByItem,
      unSelectByItem,
      unSelectAll,
      getSelectedValues,
    },
  };
}
