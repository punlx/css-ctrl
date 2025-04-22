// accordion.ts
// Accordion Plugin แบบ Uncontrolled Mode + JavaScript Animate
// Production-ready code (ไม่มีการข้ามบรรทัดหรือข้าม logic)
// -------------------------------------------------------------

/** ตัวเลือกหลักในการสร้าง Accordion Plugin */
export interface AccordionPluginOptions {
  /** ระบุว่า plugin นี้ชื่อ/controls อะไร (คล้าย id) ใช้สำหรับเชื่อมโยง aria-controls ฯลฯ */
  controls: string;
  /** เปิดหลาย panel พร้อมกันได้หรือไม่ (default=false = เปิดได้ทีละอัน) */
  multiple?: boolean;
  /** panel ที่เปิดอยู่สามารถกดซ้ำแล้วปิดได้หรือไม่ (default=true) */
  collapsible?: boolean;
  /** ระยะเวลาทรานสิชัน (ms) ถ้าต้องการใช้กับ CSS Transition. (แต่เราจะนำมาใช้ใน JS animation) */
  animationDuration?: number;
  /** ชื่อ role ของ container (เช่น 'region', หรือไม่กำหนดก็ได้) */
  containerRole?: string;
  /** ชื่อ label สำหรับ container (ถ้าต้องการในเชิง A11y) */
  ariaLabel?: string;
  /** อื่น ๆ สามารถขยายเพิ่มเติมได้ */
}

/** ข้อมูลของแต่ละ item ใน accordion (ใช้ตอน container({ data }) เพื่อ initial) */
export interface AccordionItem {
  /** key ของ item (unique ภายใน accordion) */
  key: string;
  /** ค่าเริ่มต้นว่าเปิดหรือไม่ */
  defaultOpen?: boolean;
  /** ค่าเริ่มต้นว่า disabled หรือไม่ */
  defaultDisabled?: boolean;
  /** (optional) heading (ถ้า plugin อยาก render เอง, แต่กรณีนี้ dev จะ render markup เองได้) */
  heading?: string;
  /** (optional) content (ถ้า plugin อยาก render เอง, แต่กรณีนี้ dev จะ render markup เองได้) */
  content?: string;
  /** อื่น ๆ ... ตามต้องการ */
}

/** โครงสร้างข้อมูลที่ส่งไปใน event ต่าง ๆ ของ Accordion */
export interface AccordionEventInfo {
  /** key ของ item ที่เกิดเหตุ เช่น 'panel1' */
  key: string;
  /** data = snapshot items ปัจจุบันทั้งหมด หลังปรับแล้ว */
  data: AccordionItem[];
  /** target = DOM ที่เกี่ยวข้อง */
  target?: {
    heading?: HTMLElement;
    panel?: HTMLElement;
  };
}

/** กำหนด callback events สำหรับ lifecycle การ open/close/disable/enable */
export interface AccordionEvents {
  willOpen?: (info: AccordionEventInfo) => void;
  open?: (info: AccordionEventInfo) => void;
  didOpen?: (info: AccordionEventInfo) => void;

  willClose?: (info: AccordionEventInfo) => void;
  close?: (info: AccordionEventInfo) => void;
  didClose?: (info: AccordionEventInfo) => void;

  willDisable?: (info: AccordionEventInfo) => void;
  disable?: (info: AccordionEventInfo) => void;
  didDisable?: (info: AccordionEventInfo) => void;

  willEnable?: (info: AccordionEventInfo) => void;
  enable?: (info: AccordionEventInfo) => void;
  didEnable?: (info: AccordionEventInfo) => void;

  /** ถ้าต้องการ event เดียวเมื่อมีการเปลี่ยนแปลงใด ๆ สามารถเพิ่มได้เช่น change?(info) {...} */
}

/** interface สำหรับ container(...) */
interface AccordionContainerParams {
  /** ref หรือ element จริงที่เป็น container */
  ref: HTMLElement | null;
  /** data สำหรับ initial (optional) */
  data?: AccordionItem[];
}

/** โครงสร้างภายในของ state plugin */
interface AccordionStorage {
  itemsMap: Map<string, AccordionItem>; // key -> item (ต้นฉบับ)
  openSet: Set<string>; // เก็บ key ใดกำลังเปิด
  disabledSet: Set<string>; // เก็บ key ใด disabled
  _events: AccordionEvents;
  containerEl?: HTMLElement | null;
}

/** ฟังก์ชันช่วย animate height ด้วย requestAnimationFrame */
function animateHeight(params: {
  el: HTMLElement;
  from: number;
  to: number;
  duration: number;
  callback?: () => void;
}) {
  const { el, from, to, duration, callback } = params;
  let startTime: number | null = null;

  function step(timestamp: number) {
    if (startTime === null) {
      startTime = timestamp;
    }
    const elapsed = timestamp - startTime;
    let progress = elapsed / duration;
    if (progress > 1) progress = 1;

    const currentHeight = from + (to - from) * progress;
    el.style.height = currentHeight + 'px';

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      if (callback) callback();
    }
  }

  requestAnimationFrame(step);
}

/** ประกาศฟังก์ชันหลัก accordion(...) */
export function accordion(options: AccordionPluginOptions) {
  // กำหนด default ของ multiple=false, collapsible=true
  const {
    controls,
    multiple = false,
    collapsible = true,
    animationDuration = 300,
    containerRole,
    ariaLabel,
  } = options;

  // สร้าง storage ภายใน
  const storage: { accordion: AccordionStorage } = {
    accordion: {
      itemsMap: new Map(),
      openSet: new Set(),
      disabledSet: new Set(),
      _events: {},
      containerEl: null,
    },
  };

  // -------------------------------------------------------------
  // Helper: เรียก event ต่าง ๆ
  // -------------------------------------------------------------
  function callEvent<K extends keyof AccordionEvents>(evtName: K, info: AccordionEventInfo) {
    const cb = storage.accordion._events[evtName];
    if (cb) {
      cb(info);
    }
  }

  // -------------------------------------------------------------
  // Helper: สร้าง snapshot data (ให้ dev ถ้าอยากรู้สถานะล่าสุด)
  // -------------------------------------------------------------
  function buildDataSnapshot(): AccordionItem[] {
    // สร้าง array จาก itemsMap
    const arr: AccordionItem[] = [];
    storage.accordion.itemsMap.forEach((item) => {
      // clone หรือ shallow copy
      arr.push({ ...item });
    });
    // sort ตามลำดับ insertion หรือแล้วแต่ต้องการ
    return arr;
  }

  // -------------------------------------------------------------
  // Helper: update aria attributes ใน DOM (heading + panel)
  // -------------------------------------------------------------
  function setAriaForItem(key: string) {
    const containerEl = storage.accordion.containerEl;
    if (!containerEl) return;
    const headingEl = containerEl.querySelector<HTMLElement>(`[data-accordion-heading="${key}"]`);
    const panelEl = containerEl.querySelector<HTMLElement>(`[data-accordion-panel="${key}"]`);
    const isOpen = storage.accordion.openSet.has(key);
    const isDisabled = storage.accordion.disabledSet.has(key);
    // heading
    if (headingEl) {
      headingEl.setAttribute('role', 'button');
      headingEl.setAttribute('tabindex', isDisabled ? '-1' : '0');
      headingEl.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
      headingEl.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      headingEl.setAttribute('aria-controls', `${controls}-panel-${key}`);
      headingEl.id = `${controls}-heading-${key}`;
    }
    // panel
    if (panelEl) {
      panelEl.setAttribute('role', 'region');
      panelEl.setAttribute('aria-labelledby', `${controls}-heading-${key}`);
      panelEl.id = `${controls}-panel-${key}`;

      // แต่ยังคงสั่ง aria-hidden ให้ถูกต้อง (สำหรับ Screen Reader)
      panelEl.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    }
  }

  // -------------------------------------------------------------
  // container(...) => ผูกองค์ประกอบหลัก
  // -------------------------------------------------------------
  function container(params: AccordionContainerParams) {
    const { ref, data } = params;
    let containerEl: HTMLElement | null = null;
    if (ref instanceof HTMLElement) {
      containerEl = ref;
    }
    if (!containerEl) {
      throw new Error('[accordion] container: invalid ref or element.');
    }
    storage.accordion.containerEl = containerEl;
    if (containerRole) {
      containerEl.setAttribute('role', containerRole);
    }
    if (ariaLabel) {
      containerEl.setAttribute('aria-label', ariaLabel);
    }
    // ถ้ามี data => initial
    if (data && data.length) {
      data.forEach((item) => {
        storage.accordion.itemsMap.set(item.key, { ...item });
        if (item.defaultOpen) {
          storage.accordion.openSet.add(item.key);
        }
        if (item.defaultDisabled) {
          storage.accordion.disabledSet.add(item.key);
        }
      });
    }
    // เซ็ต aria-* ครั้งแรก
    storage.accordion.itemsMap.forEach((_, key) => {
      setAriaForItem(key);
    });

    // -----------------------------------------------
    // [* เพิ่มเติม *]: ซ่อน panel ที่ไม่ได้เปิดตั้งแต่แรก
    // -----------------------------------------------
    storage.accordion.itemsMap.forEach((_, key) => {
      const isOpen = storage.accordion.openSet.has(key);
      const containerNode = storage.accordion.containerEl;
      if (!containerNode) return;
      const panelEl = containerNode.querySelector<HTMLElement>(`[data-accordion-panel="${key}"]`);
      if (!panelEl) return;
      if (!isOpen) {
        // ถ้าไม่ได้เปิด => ซ่อน + ตั้ง height=0 ไว้ก่อน
        panelEl.setAttribute('hidden', 'true');
        panelEl.style.height = '0px';
      } else {
        // ถ้าเปิด => แสดง + height:auto
        panelEl.removeAttribute('hidden');
        panelEl.style.height = 'auto';
      }
    });
    // -----------------------------------------------

    // ผูก event listener (click, keydown)
    containerEl.addEventListener('click', onClickHeading);
    containerEl.addEventListener('keydown', onKeydownHeading);
  }

  // -------------------------------------------------------------
  // Event Delegation: click heading => toggle
  // -------------------------------------------------------------
  function onClickHeading(evt: MouseEvent) {
    const containerEl = storage.accordion.containerEl;
    if (!containerEl) return;
    const heading = (evt.target as HTMLElement).closest<HTMLElement>('[data-accordion-heading]');
    if (!heading || !containerEl.contains(heading)) return;
    const key = heading.getAttribute('data-accordion-heading');
    if (!key) return;
    if (storage.accordion.disabledSet.has(key)) {
      return; // disabled => ignore
    }
    toggle(key);
  }

  // -------------------------------------------------------------
  // Keyboard => Enter / Space => toggle
  // -------------------------------------------------------------
  function onKeydownHeading(evt: KeyboardEvent) {
    if (evt.key === 'Enter' || evt.key === ' ') {
      onClickHeading(evt as unknown as MouseEvent);
      evt.preventDefault();
    }
    // (ถ้าต้องการ arrow up/down หรือ home/end ก็ทำเพิ่มได้)
  }

  // -------------------------------------------------------------
  // actions: open(key)
  // -------------------------------------------------------------
  function open(key: string) {
    if (!storage.accordion.itemsMap.has(key)) {
      return;
    }
    if (storage.accordion.disabledSet.has(key)) {
      return; // ไม่ทำอะไรถ้า disabled
    }
    // ถ้า multiple=false => close อื่นก่อน
    if (!options.multiple) {
      storage.accordion.openSet.forEach((k) => {
        if (k !== key) {
          close(k); // เรียกปิดทีละอัน
        }
      });
    }
    if (!collapsible && storage.accordion.openSet.has(key)) {
      // กรณี collapsible=false แล้วเปิดอยู่ => ห้ามปิด => ไม่มีผล
      return;
    }
    if (!storage.accordion.openSet.has(key)) {
      const beforeData = buildDataSnapshot();
      callEvent('willOpen', { key, data: beforeData });
      storage.accordion.openSet.add(key);
      setAriaForItem(key);

      const containerEl = storage.accordion.containerEl;
      if (!containerEl) return;
      const panelEl = containerEl.querySelector<HTMLElement>(`[data-accordion-panel="${key}"]`);
      if (panelEl) {
        // เตรียมให้วัด scrollHeight ได้
        panelEl.removeAttribute('hidden'); // ปลดซ่อนก่อน (ถ้ามี)
        panelEl.style.overflow = 'hidden';
        // เริ่มจากสูง 0 (หรือจะเริ่มจากค่าที่มีอยู่ก็ได้ ถ้ามีกรณีพิเศษ)
        panelEl.style.height = '0px';

        // เรียก open event
        const afterData = buildDataSnapshot();
        callEvent('open', { key, data: afterData });

        // animate จาก 0 -> scrollHeight
        const targetHeight = panelEl.scrollHeight;
        animateHeight({
          el: panelEl,
          from: 0,
          to: targetHeight,
          duration: animationDuration,
          callback: () => {
            // แอนิเมชันเสร็จ
            panelEl.style.height = 'auto';
            panelEl.style.overflow = '';
            // เรียก didOpen หลัง animation
            callEvent('didOpen', { key, data: buildDataSnapshot() });
          },
        });
      }
    }
  }

  // -------------------------------------------------------------
  // actions: close(key)
  // -------------------------------------------------------------
  function close(key: string) {
    if (!storage.accordion.itemsMap.has(key)) {
      return;
    }
    if (storage.accordion.disabledSet.has(key)) {
      return;
    }
    if (storage.accordion.openSet.has(key)) {
      const beforeData = buildDataSnapshot();
      callEvent('willClose', { key, data: beforeData });
      storage.accordion.openSet.delete(key);
      setAriaForItem(key);

      const containerEl = storage.accordion.containerEl;
      if (!containerEl) return;
      const panelEl = containerEl.querySelector<HTMLElement>(`[data-accordion-panel="${key}"]`);
      if (panelEl) {
        // อ่านความสูงปัจจุบัน (เผื่อมี animation ค้าง)
        const currentHeight = panelEl.scrollHeight;
        panelEl.style.overflow = 'hidden';

        // เรียก close event ตรงนี้ก่อน animate
        const afterData = buildDataSnapshot();
        callEvent('close', { key, data: afterData });

        // animate จาก currentHeight -> 0
        animateHeight({
          el: panelEl,
          from: currentHeight,
          to: 0,
          duration: animationDuration,
          callback: () => {
            // แอนิเมชันเสร็จ
            panelEl.style.height = '';
            panelEl.style.overflow = '';
            panelEl.setAttribute('hidden', 'true'); // ซ่อน panel จริง ๆ
            // เรียก didClose หลัง animation
            callEvent('didClose', { key, data: buildDataSnapshot() });
          },
        });
      }
    }
  }

  // -------------------------------------------------------------
  // actions: toggle(key)
  // -------------------------------------------------------------
  function toggle(key: string) {
    if (!storage.accordion.openSet.has(key)) {
      open(key);
    } else {
      if (!collapsible) {
        // ถ้า collapsible=false => ไม่ให้ปิด
        return;
      }
      close(key);
    }
  }

  // -------------------------------------------------------------
  // actions: disable(key)
  // -------------------------------------------------------------
  function disable(key: string) {
    if (!storage.accordion.itemsMap.has(key)) {
      return;
    }
    if (storage.accordion.disabledSet.has(key)) {
      return; // already disabled
    }
    const beforeData = buildDataSnapshot();
    callEvent('willDisable', { key, data: beforeData });
    // ปิด panel ก่อน (ถ้ากำลังเปิดอยู่)
    if (storage.accordion.openSet.has(key)) {
      close(key);
    }
    storage.accordion.disabledSet.add(key);
    setAriaForItem(key);
    const afterData = buildDataSnapshot();
    callEvent('disable', { key, data: afterData });
    callEvent('didDisable', { key, data: afterData });
  }

  // -------------------------------------------------------------
  // actions: enable(key)
  // -------------------------------------------------------------
  function enable(key: string) {
    if (!storage.accordion.itemsMap.has(key)) {
      return;
    }
    if (!storage.accordion.disabledSet.has(key)) {
      return; // not disabled
    }
    const beforeData = buildDataSnapshot();
    callEvent('willEnable', { key, data: beforeData });
    storage.accordion.disabledSet.delete(key);
    setAriaForItem(key);
    const afterData = buildDataSnapshot();
    callEvent('enable', { key, data: afterData });
    callEvent('didEnable', { key, data: afterData });
  }

  // -------------------------------------------------------------
  // actions: openAll() / closeAll()
  // -------------------------------------------------------------
  function openAll() {
    // multiple=true => openAll มีความหมาย, ถ้า multiple=false => เปิดได้แค่ทีละ 1
    if (!multiple) {
      console.warn('[accordion] openAll() called but multiple=false => only 1 can open.');
    }
    const items = Array.from(storage.accordion.itemsMap.keys());
    items.forEach((k) => {
      if (!storage.accordion.disabledSet.has(k)) {
        open(k);
      }
    });
  }

  function closeAll() {
    const items = Array.from(storage.accordion.itemsMap.keys());
    items.forEach((k) => {
      if (!storage.accordion.disabledSet.has(k)) {
        close(k);
      }
    });
  }

  // -------------------------------------------------------------
  // actions: getData() => คืน array items พร้อมสถานะ (open/disabled)
  // -------------------------------------------------------------
  function getData(): AccordionItem[] {
    // สร้าง snapshot + ใส่ open/disabled ถ้าต้องการ
    const snapshot = buildDataSnapshot();
    snapshot.forEach((item) => {
      const isOpen = storage.accordion.openSet.has(item.key);
      const isDisabled = storage.accordion.disabledSet.has(item.key);
      (item as any).currentOpen = isOpen;
      (item as any).currentDisabled = isDisabled;
    });
    return snapshot;
  }

  // -------------------------------------------------------------
  // actions: destroy() => cleanup event listeners
  // -------------------------------------------------------------
  function destroy() {
    const containerEl = storage.accordion.containerEl;
    if (containerEl) {
      containerEl.removeEventListener('click', onClickHeading);
      containerEl.removeEventListener('keydown', onKeydownHeading);
    }
    // clear sets, map, etc.
    storage.accordion.itemsMap.clear();
    storage.accordion.openSet.clear();
    storage.accordion.disabledSet.clear();
    storage.accordion.containerEl = null;
  }

  // -------------------------------------------------------------
  // events(...)
  // -------------------------------------------------------------
  function events(e: AccordionEvents) {
    storage.accordion._events = {
      willOpen: e.willOpen,
      open: e.open,
      didOpen: e.didOpen,
      willClose: e.willClose,
      close: e.close,
      didClose: e.didClose,
      willDisable: e.willDisable,
      disable: e.disable,
      didDisable: e.didDisable,
      willEnable: e.willEnable,
      enable: e.enable,
      didEnable: e.didEnable,
    };
  }

  // -------------------------------------------------------------
  // aria: สำหรับ Dev ที่ต้องการผูก attribute เอง
  // -------------------------------------------------------------
  /** ให้ dev ใส่ {...accordionA.aria.trigger(key)} บน heading element */
  function ariaTrigger(key: string) {
    const isOpen = storage.accordion.openSet.has(key);
    const isDisabled = storage.accordion.disabledSet.has(key);
    return {
      // บังคับให้ dev ใส่ data-accordion-heading เพื่อ plugin ใช้ query
      'data-accordion-heading': key,
      role: 'button',
      tabIndex: isDisabled ? -1 : 0,
      'aria-disabled': isDisabled ? 'true' : 'false',
      'aria-expanded': isOpen ? 'true' : 'false',
      'aria-controls': `${controls}-panel-${key}`,
      id: `${controls}-heading-${key}`,
    };
  }

  /** ให้ dev ใส่ {...accordionA.aria.panel(key)} บน panel element */
  function ariaPanel(key: string) {
    const isOpen = storage.accordion.openSet.has(key);
    return {
      'data-accordion-panel': key,
      role: 'region',
      'aria-labelledby': `${controls}-heading-${key}`,
      id: `${controls}-panel-${key}`,
      // ไม่เซ็ต hidden ตรงนี้ เพื่อให้ animation ทำงาน
      // hidden: isOpen ? undefined : true,
      'aria-hidden': isOpen ? 'false' : 'true',
    };
  }

  // -------------------------------------------------------------
  // คืน API ออกไป
  // -------------------------------------------------------------
  return {
    container,
    events,
    actions: {
      open,
      close,
      toggle,
      disable,
      enable,
      openAll,
      closeAll,
      getData,
      destroy,
    },
    aria: {
      trigger: ariaTrigger,
      panel: ariaPanel,
    },
  };
}
