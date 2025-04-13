// src/plugin/select.ts

import { CssCtrlPlugin } from './types';

// ====== 1) Type definitions เฉพาะ plugin นี้ =====
interface DataItem {
  val: string;
  [key: string]: any;
}

interface SelectOptions {
  toggleable?: boolean;
  clearPrevious?: boolean;
}

// Callback Info
interface SelectCallbackInfo {
  value: DataItem | null;
  list: DataItem[];
}

// Callback signature
type SelectCallback = (info: SelectCallbackInfo, el: HTMLElement) => void;

interface SelectObject {
  target: HTMLElement | EventTarget;
  data?: DataItem[];
  selectable?: boolean | ((el: HTMLElement) => boolean);

  willSelect?: SelectCallback;
  select?: SelectCallback;
  reSelect?: SelectCallback;
  unSelect?: SelectCallback;
  didSelect?: SelectCallback;
}

// ====== 2) Plugin Function =====
export function select(
  options: SelectOptions = { clearPrevious: true, toggleable: false }
): CssCtrlPlugin<{
  select: (so: SelectObject) => void;
}> {
  const { toggleable = false, clearPrevious = true } = options;

  // plugin function
  return (storage, className) => {
    console.log('select.ts:47 |className| : ', className);
    // ถ้ายังไม่มี selectedItems => สร้าง
    if (!storage.selectedItems) {
      storage.selectedItems = [] as Array<{ el: HTMLElement; dataItem: DataItem | null }>;
    }

    return {
      select(so: SelectObject) {
        const {
          target,
          data,
          selectable = true,
          willSelect,
          select,
          reSelect,
          unSelect,
          didSelect,
        } = so;

        // หา [role="option"]
        const el = (target as HTMLElement).closest('[role="option"]') as HTMLElement | null;
        if (!el) return;
        const currentTarget = el.closest('[role="listbox"]') as HTMLElement | null;
        if (!currentTarget)
          throw new Error('[CSS-CTRL-ERR] select plugin: must be used within role="listbox"');
        if (!currentTarget.classList.contains(className)) {
          throw new Error(`[CSS-CTRL-ERR] select plugin: must be within "${className}" container`);
        }

        if (el.getAttribute('aria-disabled') === 'true') return;

        // หา dataItem
        let dataItem: DataItem | null = null;
        const val = el.dataset.value;
        if (data && val !== undefined) {
          dataItem = data.find((d) => String(d.val) === String(val)) || null;
        }

        // helper => สร้าง { data, list }
        const buildInfo = (): SelectCallbackInfo => {
          const all = (
            storage.selectedItems as Array<{ el: HTMLElement; dataItem: DataItem | null }>
          )
            .map((s) => s.dataItem)
            .filter(Boolean) as DataItem[];
          return {
            value: dataItem,
            list: all,
          };
        };

        willSelect?.(buildInfo(), el);

        // check exists
        const arr = storage.selectedItems as Array<{ el: HTMLElement; dataItem: DataItem | null }>;
        const existingIndex = arr.findIndex((s) => s.el === el);
        const isSelected = existingIndex >= 0;

        if (isSelected) {
          // reSelect
          reSelect?.(buildInfo(), el);

          if (!toggleable) return;

          // toggle off
          el.setAttribute('aria-selected', 'false');
          arr.splice(existingIndex, 1);
          unSelect?.(buildInfo(), el);
          return;
        }

        // check selectable
        const allowed = typeof selectable === 'function' ? selectable(el) : selectable !== false;
        if (!allowed) return;

        // single => unselect old
        if (clearPrevious && arr.length > 0) {
          for (const s of arr) {
            s.el.setAttribute('aria-selected', 'false');
            unSelect?.({ value: s.dataItem, list: [] }, s.el);
          }
          arr.length = 0;
        }

        // select new
        el.setAttribute('aria-selected', 'true');
        arr.push({ el, dataItem });

        select?.(buildInfo(), el);
        didSelect?.(buildInfo(), el);
      },
    };
  };
}
