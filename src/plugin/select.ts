// src/plugin/select.ts

import { CssCtrlPlugin } from './types'; // สมมติว่า CssCtrlPlugin<T> = (storage: SelectStorage, className: string) => T

/** โครงสร้างข้อมูลสำหรับ DataItem */
interface DataItem {
  value: string;
  display?: string;
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
  element: HTMLElement; // container <div role="listbox" class=...>
  data: DataItem[]; // array ของ { value, display, ... }
}

/** interface ของ storage ที่ plugin จะใช้ */
export interface SelectStorage extends Record<string, unknown> {
  selectedItems: SelectedItem[];
  _events: SelectEvents;
  reselectAllowed: boolean;
  unselectAllowed: boolean;

  containerEl?: HTMLElement;
  _selectData?: DataItem[];
}

/**
 * สุดท้าย: export function select(...)
 * จะคืน CssCtrlPlugin ซึ่งรับ storage: SelectStorage
 */
export function select(
  options: SelectOptions = { clearPrevious: true, toggleable: false }
): CssCtrlPlugin<{
  select: {
    init: (params: InitParams) => void;
    events: (ev: SelectEvents) => void;
    actions: {
      selectByItem: (val: string) => void;
      unSelectByItem: (val: string) => void;
      unSelectAll: () => void;
      getValues: () => DataItem[];
    };
  };
}> {
  const { toggleable = false, clearPrevious = true } = options;

  // return ฟังก์ชัน (storage: SelectStorage, className: string) => ...
  return (storage: SelectStorage, className: string) => {
    // ถ้ายังไม่มี selectedItems => สร้าง
    if (!storage.selectedItems) {
      storage.selectedItems = [];
    }
    // ถ้าไม่มี _events => สร้าง
    if (!storage._events) {
      storage._events = {};
    }

    // ตั้งค่าเริ่มต้นให้ reselectAllowed / unselectAllowed เป็น false
    storage.reselectAllowed = false;
    storage.unselectAllowed = false;

    // 1) init(...)
    function init(params: InitParams) {
      const { element, data } = params;
      // ตรวจว่า element ตรงตาม [role="listbox"] + className
      if (element.getAttribute('role') !== 'listbox' || !element.classList.contains(className)) {
        throw new Error(
          `[CSS-CTRL-ERR] init: element must be <div role="listbox" class="${className}">`
        );
        return;
      }
      // เก็บ container + data
      storage.containerEl = element;
      storage._selectData = data;
      // ผูก event click
      element.onclick = handleContainerClick;
    }

    // 2) events(...)
    function events(ev: SelectEvents) {
      storage._events = {
        willSelect: ev.willSelect,
        select: ev.select,
        didSelect: ev.didSelect,
        unSelect: ev.unSelect,
        reSelect: ev.reSelect,
      };
    }

    // handle คลิกใน container
    function handleContainerClick(evt: MouseEvent) {
      const el = (evt.target as HTMLElement).closest('[role="option"]') as HTMLElement | null;
      if (!el) return;

      // call willSelect
      callEvent('willSelect', el);
      // ทำลอจิก select / unselect
      doSelectLogic(el);
    }

    // ดึง dataItem จาก element
    function findDataItem(el: HTMLElement): DataItem | null {
      const data = storage._selectData || [];
      const val = el.dataset.value;
      if (!val) return null;
      return data.find((d) => String(d.value) === val) || null;
    }

    // สร้าง info สำหรับ callback
    function buildInfo(el: HTMLElement): SelectCallbackInfo {
      return {
        value: findDataItem(el),
        target: el,
        list: storage.selectedItems.map((s) => ({
          value: s.dataItem,
          target: s.el,
        })),
      };
    }

    // เรียก callback (willSelect, select, didSelect, unSelect, reSelect)
    function callEvent(name: keyof SelectEvents, el: HTMLElement) {
      const cb = storage._events[name];
      if (cb) {
        cb(buildInfo(el));
      }
    }

    // ลอจิก select/unselect
    function doSelectLogic(el: HTMLElement) {
      storage.reselectAllowed = false;
      storage.unselectAllowed = false;

      const arr = storage.selectedItems;
      const idx = arr.findIndex((s) => s.el === el);
      const isSelected = idx >= 0;

      if (isSelected) {
        // reSelect
        storage.reselectAllowed = true;
        callEvent('reSelect', el);

        if (toggleable) {
          // remove item
          el.setAttribute('aria-selected', 'false');
          arr.splice(idx, 1);

          storage.unselectAllowed = true;
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
          storage.unselectAllowed = true;
          callEvent('unSelect', oldItem.el);
        }
      }

      // select ใหม่
      el.setAttribute('aria-selected', 'true');
      arr.push({ el, dataItem: findDataItem(el) });

      callEvent('select', el);
      callEvent('didSelect', el);
    }

    // actions

    function selectByItem(val: string) {
      const container = storage.containerEl;
      if (!container) {
        throw new Error('[CSS-CTRL-ERR] selectByItem: no containerEl');
      }
      const el = container.querySelector(
        `[role="option"][data-value="${val}"]`
      ) as HTMLElement | null;
      if (!el) {
        throw new Error(`[CSS-CTRL-ERR] selectByItem: no data-value="${val}" found`);
      }

      callEvent('willSelect', el);
      doSelectLogic(el);
    }

    function unSelectByItem(val: string) {
      const container = storage.containerEl;
      if (!container) {
        throw new Error(`[CSS-CTRL-ERR] unSelectByItem: no containerEl`);

        return;
      }
      const el = container.querySelector(
        `[role="option"][data-value="${val}"]`
      ) as HTMLElement | null;
      if (!el) {
        throw new Error(`[CSS-CTRL-ERR] unSelectByItem: no data-value="${val}"`);
        return;
      }

      // ลบของจริง
      const arr = storage.selectedItems;
      const idx = arr.findIndex((it) => it.el === el);
      if (idx >= 0) {
        el.setAttribute('aria-selected', 'false');
        arr.splice(idx, 1);
      }
      callEvent('unSelect', el);
    }

    function unSelectAll() {
      const arr = storage.selectedItems;
      for (const it of [...arr]) {
        it.el.setAttribute('aria-selected', 'false');
        callEvent('unSelect', it.el);
      }
      arr.length = 0;
    }

    function getValues() {
      return storage.selectedItems.map((s) => s.dataItem).filter(Boolean) as DataItem[];
    }

    // return สุดท้าย
    return {
      select: {
        init,
        events,
        actions: {
          selectByItem,
          unSelectByItem,
          unSelectAll,
          getValues,
        },
      },
    };
  };
}
