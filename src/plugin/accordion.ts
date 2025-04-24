// accordion-improved.ts
// Accordion Plugin แบบ Uncontrolled Mode + JavaScript Animate (Improved Version)
// -------------------------------------------------------------

/** ตัวเลือกหลักในการสร้าง Accordion Plugin */
export interface AccordionPluginOptions {
  /** ระบุว่า plugin นี้ชื่อ/controls อะไร (คล้าย id) ใช้สำหรับเชื่อมโยง aria-controls ฯลฯ */
  controls: string;
  /** เปิดหลาย panel พร้อมกันได้หรือไม่ (default=false = เปิดได้ทีละอัน) */
  multiple?: boolean;
  /** panel ที่เปิดอยู่สามารถกดซ้ำแล้วปิดได้หรือไม่ (default=true) */
  collapsible?: boolean;
  /** ระยะเวลาทรานสิชัน (ms) สำหรับ animation */
  animationDuration?: number;
  /** ชื่อ role ของ container (เช่น 'region', หรือไม่กำหนดก็ได้) */
  containerRole?: string;
  /** ชื่อ label สำหรับ container (ถ้าต้องการในเชิง A11y) */
  ariaLabel?: string;
  /** อื่น ๆ ขยายเพิ่มเติมได้ */
}

/** ข้อมูลของแต่ละ item ใน accordion */
export interface AccordionItem {
  /** key ของ item (unique ภายใน accordion) */
  key: string;
  /** ค่าเริ่มต้นว่าเปิดหรือไม่ */
  defaultOpen?: boolean;
  /** ค่าเริ่มต้นว่า disabled หรือไม่ */
  defaultDisabled?: boolean;
  /** (optional) heading */
  heading?: string;
  /** (optional) content */
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
  itemsMap: Map<string, AccordionItem>;
  openSet: Set<string>;
  disabledSet: Set<string>;
  _events: AccordionEvents;
  containerEl?: HTMLElement | null;
}

/** โครงสร้างช่วยเก็บข้อมูล Animation ปัจจุบัน (เพื่อ cancel/interrupt) */
interface AnimationState {
  rafId: number | null;
  isCancelled: boolean;
}

/** ฟังก์ชันช่วย animate height ด้วย requestAnimationFrame (พร้อม cancel/interrupt ได้) */
function animateHeight(params: {
  el: HTMLElement;
  from: number;
  to: number;
  duration: number;
  animationState: AnimationState;
  callback?: () => void;
}) {
  const { el, from, to, duration, animationState, callback } = params;
  let startTime: number | null = null;

  function step(timestamp: number) {
    if (animationState.isCancelled) {
      return;
    }
    if (startTime === null) {
      startTime = timestamp;
    }
    const elapsed = timestamp - startTime;
    let progress = elapsed / duration;
    if (progress > 1) progress = 1;
    const currentHeight = from + (to - from) * progress;
    el.style.height = currentHeight + 'px';
    if (progress < 1) {
      animationState.rafId = requestAnimationFrame(step);
    } else {
      if (callback) callback();
    }
  }

  animationState.rafId = requestAnimationFrame(step);
}

/** ประกาศฟังก์ชันหลัก accordion(...) */
export function accordion(options: AccordionPluginOptions) {
  const {
    controls,
    multiple = false,
    collapsible = true,
    animationDuration = 300,
    containerRole,
    ariaLabel,
  } = options;

  /** เก็บ State ภายใน */
  const storage: { accordion: AccordionStorage } = {
    accordion: {
      itemsMap: new Map(),
      openSet: new Set(),
      disabledSet: new Set(),
      _events: {},
      containerEl: null,
    },
  };

  /** เก็บ AnimationState แยกเป็นราย panel เพื่อ cancel/interrupt ได้ */
  const animations: Map<string, AnimationState> = new Map();

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
  // Helper: สร้าง snapshot data
  // -------------------------------------------------------------
  function buildDataSnapshot(): AccordionItem[] {
    const arr: AccordionItem[] = [];
    storage.accordion.itemsMap.forEach((item) => {
      arr.push({ ...item });
    });
    return arr;
  }

  // -------------------------------------------------------------
  // Helper: อัปเดตคลาสใน heading ตาม state (expanded/collapsed/disabled/active)
  // -------------------------------------------------------------
  function updateClassesForItem(key: string) {
    const containerEl = storage.accordion.containerEl;
    if (!containerEl) return;
    const headingEl = containerEl.querySelector<HTMLElement>(`[data-accordion-heading="${key}"]`);
    if (!headingEl) return;
    const isExpanded = headingEl.getAttribute('aria-expanded') === 'true';
    const isDisabled = headingEl.getAttribute('aria-disabled') === 'true';
    const isActive = document.activeElement === headingEl;

    // expanded/collapsed
    if (isExpanded) {
      headingEl.classList.add('accordionPlugin-expanded');
      headingEl.classList.remove('accordionPlugin-collapsed');
    } else {
      headingEl.classList.remove('accordionPlugin-expanded');
      headingEl.classList.add('accordionPlugin-collapsed');
    }

    // disabled
    if (isDisabled) {
      headingEl.classList.add('accordionPlugin-disabled');
    } else {
      headingEl.classList.remove('accordionPlugin-disabled');
    }

    // active (focus)
    if (isActive) {
      headingEl.classList.add('accordionPlugin-active');
    } else {
      headingEl.classList.remove('accordionPlugin-active');
    }
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
    if (headingEl) {
      headingEl.setAttribute('role', 'button');
      headingEl.setAttribute('tabindex', isDisabled ? '-1' : '0');
      headingEl.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
      headingEl.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      headingEl.setAttribute('aria-controls', `${controls}-panel-${key}`);
      headingEl.id = `${controls}-heading-${key}`;
    }
    if (panelEl) {
      panelEl.setAttribute('role', 'region');
      panelEl.setAttribute('aria-labelledby', `${controls}-heading-${key}`);
      panelEl.id = `${controls}-panel-${key}`;
      panelEl.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    }
    // เรียกอัปเดต class ท้ายสุด
    updateClassesForItem(key);
  }

  // -------------------------------------------------------------
  // Helper: cleanup aria (เผื่อ revert DOM ตอน destroy)
  // -------------------------------------------------------------
  function cleanupAriaForItem(key: string) {
    const containerEl = storage.accordion.containerEl;
    if (!containerEl) return;
    const headingEl = containerEl.querySelector<HTMLElement>(`[data-accordion-heading="${key}"]`);
    const panelEl = containerEl.querySelector<HTMLElement>(`[data-accordion-panel="${key}"]`);
    if (headingEl) {
      headingEl.removeAttribute('role');
      headingEl.removeAttribute('tabindex');
      headingEl.removeAttribute('aria-disabled');
      headingEl.removeAttribute('aria-expanded');
      headingEl.removeAttribute('aria-controls');
      headingEl.removeAttribute('id');
      headingEl.classList.remove(
        'accordionPlugin-expanded',
        'accordionPlugin-collapsed',
        'accordionPlugin-disabled',
        'accordionPlugin-active'
      );
    }
    if (panelEl) {
      panelEl.removeAttribute('role');
      panelEl.removeAttribute('aria-labelledby');
      panelEl.removeAttribute('id');
      panelEl.removeAttribute('aria-hidden');
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
    storage.accordion.itemsMap.forEach((_, key) => {
      setAriaForItem(key);
    });
    storage.accordion.itemsMap.forEach((_, key) => {
      const isOpen = storage.accordion.openSet.has(key);
      const containerNode = storage.accordion.containerEl;
      if (!containerNode) return;
      const panelEl = containerNode.querySelector<HTMLElement>(`[data-accordion-panel="${key}"]`);
      if (!panelEl) return;
      if (!isOpen) {
        panelEl.setAttribute('hidden', 'true');
        panelEl.style.height = '0px';
      } else {
        panelEl.removeAttribute('hidden');
        panelEl.style.height = 'auto';
      }
    });
    containerEl.addEventListener('click', onClickHeading);
    containerEl.addEventListener('keydown', onKeydownHeading);
    // เพิ่ม event focusin/focusout เพื่ออัปเดต .accordionPlugin-active
    containerEl.addEventListener('focusin', onFocusInHeading);
    containerEl.addEventListener('focusout', onFocusOutHeading);
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
      return;
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
  }

  // -------------------------------------------------------------
  // จัดการ focusin => เรียก updateClassesForItem
  // -------------------------------------------------------------
  function onFocusInHeading(evt: FocusEvent) {
    const containerEl = storage.accordion.containerEl;
    if (!containerEl) return;
    const heading = (evt.target as HTMLElement).closest<HTMLElement>('[data-accordion-heading]');
    if (!heading || !containerEl.contains(heading)) return;
    const key = heading.getAttribute('data-accordion-heading');
    if (!key) return;
    updateClassesForItem(key);
  }

  // -------------------------------------------------------------
  // จัดการ focusout => เรียก updateClassesForItem
  // -------------------------------------------------------------
  function onFocusOutHeading(evt: FocusEvent) {
    const containerEl = storage.accordion.containerEl;
    if (!containerEl) return;
    const heading = (evt.target as HTMLElement).closest<HTMLElement>('[data-accordion-heading]');
    if (!heading || !containerEl.contains(heading)) return;
    const key = heading.getAttribute('data-accordion-heading');
    if (!key) return;
    updateClassesForItem(key);
  }

  // -------------------------------------------------------------
  // Cancel animation เดิม (ถ้ามี) ก่อนเริ่ม animate ใหม่
  // -------------------------------------------------------------
  function cancelAnimationIfExists(key: string) {
    const animState = animations.get(key);
    if (animState && animState.rafId !== null) {
      animState.isCancelled = true;
      cancelAnimationFrame(animState.rafId);
    }
  }

  // -------------------------------------------------------------
  // actions: open(key)
  // -------------------------------------------------------------
  function open(key: string) {
    if (!storage.accordion.itemsMap.has(key)) {
      return;
    }
    if (storage.accordion.disabledSet.has(key)) {
      return;
    }
    if (!multiple) {
      storage.accordion.openSet.forEach((k) => {
        if (k !== key) {
          close(k);
        }
      });
    }
    if (!collapsible && storage.accordion.openSet.has(key)) {
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
        cancelAnimationIfExists(key);
        const animState: AnimationState = { rafId: null, isCancelled: false };
        animations.set(key, animState);
        panelEl.removeAttribute('hidden');
        panelEl.style.overflow = 'hidden';
        let currentHeight = parseFloat(panelEl.style.height || '0');
        if (isNaN(currentHeight)) {
          currentHeight = 0;
        }
        const afterData = buildDataSnapshot();
        callEvent('open', { key, data: afterData });
        const targetHeight = panelEl.scrollHeight;
        animateHeight({
          el: panelEl,
          from: currentHeight,
          to: targetHeight,
          duration: animationDuration,
          animationState: animState,
          callback: () => {
            if (!animState.isCancelled) {
              panelEl.style.height = 'auto';
              panelEl.style.overflow = '';
              callEvent('didOpen', { key, data: buildDataSnapshot() });
            }
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
        cancelAnimationIfExists(key);
        const animState: AnimationState = { rafId: null, isCancelled: false };
        animations.set(key, animState);
        const currentHeight = panelEl.scrollHeight;
        panelEl.style.overflow = 'hidden';
        const afterData = buildDataSnapshot();
        callEvent('close', { key, data: afterData });
        animateHeight({
          el: panelEl,
          from: currentHeight,
          to: 0,
          duration: animationDuration,
          animationState: animState,
          callback: () => {
            if (!animState.isCancelled) {
              panelEl.style.height = '';
              panelEl.style.overflow = '';
              panelEl.setAttribute('hidden', 'true');
              callEvent('didClose', { key, data: buildDataSnapshot() });
            }
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
      return;
    }
    const beforeData = buildDataSnapshot();
    callEvent('willDisable', { key, data: beforeData });
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
      return;
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
  // actions: getData() => คืน array items พร้อมสถานะ
  // -------------------------------------------------------------
  function getData(): AccordionItem[] {
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
  // actions: destroy() => cleanup event listeners + revert DOM
  // -------------------------------------------------------------
  function destroy() {
    const containerEl = storage.accordion.containerEl;
    if (containerEl) {
      containerEl.removeEventListener('click', onClickHeading);
      containerEl.removeEventListener('keydown', onKeydownHeading);
      containerEl.removeEventListener('focusin', onFocusInHeading);
      containerEl.removeEventListener('focusout', onFocusOutHeading);
      storage.accordion.itemsMap.forEach((_, key) => {
        cleanupAriaForItem(key);
        const panelEl = containerEl.querySelector<HTMLElement>(`[data-accordion-panel="${key}"]`);
        if (panelEl) {
          panelEl.removeAttribute('hidden');
          panelEl.style.height = '';
          panelEl.style.overflow = '';
        }
      });
      containerEl.removeAttribute('role');
      containerEl.removeAttribute('aria-label');
    }
    animations.forEach((anim, key) => {
      if (anim.rafId !== null) {
        anim.isCancelled = true;
        cancelAnimationFrame(anim.rafId);
      }
    });
    animations.clear();
    storage.accordion.itemsMap.clear();
    storage.accordion.openSet.clear();
    storage.accordion.disabledSet.clear();
    storage.accordion.containerEl = null;
  }

  // -------------------------------------------------------------
  // actions: addItem(...) / removeItem(...)
  // -------------------------------------------------------------
  function addItem(item: AccordionItem) {
    if (storage.accordion.itemsMap.has(item.key)) {
      console.warn(`[accordion] addItem failed: key "${item.key}" already exists.`);
      return;
    }
    storage.accordion.itemsMap.set(item.key, { ...item });
    if (item.defaultOpen) {
      storage.accordion.openSet.add(item.key);
    }
    if (item.defaultDisabled) {
      storage.accordion.disabledSet.add(item.key);
    }
    setAriaForItem(item.key);
    const containerEl = storage.accordion.containerEl;
    if (containerEl) {
      const panelEl = containerEl.querySelector<HTMLElement>(
        `[data-accordion-panel="${item.key}"]`
      );
      if (panelEl) {
        if (!item.defaultOpen) {
          panelEl.setAttribute('hidden', 'true');
          panelEl.style.height = '0px';
        } else {
          panelEl.removeAttribute('hidden');
          panelEl.style.height = 'auto';
        }
      }
    }
  }

  function removeItem(key: string) {
    if (!storage.accordion.itemsMap.has(key)) {
      console.warn(`[accordion] removeItem failed: key "${key}" not found.`);
      return;
    }
    close(key);
    cleanupAriaForItem(key);
    cancelAnimationIfExists(key);
    animations.delete(key);
    storage.accordion.itemsMap.delete(key);
    storage.accordion.openSet.delete(key);
    storage.accordion.disabledSet.delete(key);
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
  function ariaTrigger(key: string) {
    const isOpen = storage.accordion.openSet.has(key);
    const isDisabled = storage.accordion.disabledSet.has(key);
    return {
      'data-accordion-heading': key,
      role: 'button',
      tabIndex: isDisabled ? -1 : 0,
      'aria-disabled': isDisabled ? true : false,
      'aria-expanded': isOpen ? true : false,
      'aria-controls': `${controls}-panel-${key}`,
      id: `${controls}-heading-${key}`,
    };
  }

  function ariaPanel(key: string) {
    const isOpen = storage.accordion.openSet.has(key);
    return {
      'data-accordion-panel': key,
      role: 'region',
      'aria-labelledby': `${controls}-heading-${key}`,
      id: `${controls}-panel-${key}`,
      'aria-hidden': isOpen ? false : true,
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
      addItem,
      removeItem,
    },
    aria: {
      trigger: ariaTrigger,
      panel: ariaPanel,
    },
  };
}
