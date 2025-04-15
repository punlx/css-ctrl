// src/plugin/dialog.ts

import { CssCtrlPlugin } from './types';

// ----- Type ของ options ที่ plugin รับ -----
interface DialogPluginOptions {
  // React Node ที่จะ render ลง <dialog>
  modal: any;
}

// ----- Plugin Function -----
export function dialog(options: DialogPluginOptions): CssCtrlPlugin<{
  dialog: {
    willShowModal: () => void;
    showModal: () => void;
    didShowModal: () => void;
    closeModal: () => void;
    willCloseModal: () => void;
    didCloseModal: () => void;
    modalData: (data: any) => void;
    modalState: () => any;
    modalACtion: () => void; // คง logic เดิมสะกดแบบเดิม
  };
}> {
  const { modal } = options;

  return (storage, className) => {
    // ตรวจว่ามี storage.dialogItems หรือยัง
    // ถ้ายังไม่มี => จะสร้างครั้งแรก
    if (!(storage.dialogItems as any)) {
      (storage.dialogItems as any) = {};
      (storage.dialogItems as any).state = { open: false };
    }

    // แยกเมธอดย่อย
    function willShowModal() {
      // ยังไม่ทำอะไรเป็นพิเศษ
    }

    function didShowModal() {
      // ยังไม่ทำอะไรเป็นพิเศษ
    }

    function willCloseModal() {
      // ยังไม่ทำอะไรเป็นพิเศษ
    }

    function didCloseModal() {
      // ยังไม่ทำอะไรเป็นพิเศษ
    }

    function modalACtion() {
      // ตามโค้ดเดิม ยังเป็น placeholder
    }

    function modalState() {
      return (storage.dialogItems as any).state;
    }

    function modalData(data: any) {
      const dialogItems = storage.dialogItems as any;
      dialogItems.data = data;

      // ถ้ามี root อยู่แล้ว → render ใหม่เลย
      if (dialogItems.root) {
        dialogItems.root.render(modal(dialogItems.data));
      }
    }

    function showModal() {
      // เรียก willShowModal ก่อน
      willShowModal();

      // ถ้ามี dialog แล้ว => ไม่ต้องสร้างซ้ำ
      if ((storage.dialogItems as any).dialog) {
        throw new Error(`ให้บอกว่า ไม่สามารถ เรียกตัวเอกได้`);
      }

      // 1) สร้าง <dialog> + ใส่คลาส
      const dialogEl = document.createElement('dialog');
      dialogEl.classList.add(className);
      document.body.appendChild(dialogEl);

      // 2) สร้าง react root => render(options.render) ลงไป
      const root = (storage.plugin as any).react.createRoot(dialogEl);
      root.render(modal((storage.dialogItems as any).data));

      // 3) เก็บอ้างอิงใน (storage.dialogItems as any)
      (storage.dialogItems as any).dialog = dialogEl;
      (storage.dialogItems as any).root = root;

      // 4) showModal => เปิด dialog
      (storage.dialogItems as any).state = { open: true };
      (dialogEl as HTMLDialogElement).showModal();

      // เรียก didShowModal หลังเปิด
      didShowModal();
    }

    function closeModal() {
      // เรียก willCloseModal ก่อน
      willCloseModal();

      // ถ้าไม่มี dialog => ไม่ต้องทำอะไร
      if (!(storage.dialogItems as any).dialog) return;

      const dialogEl = (storage.dialogItems as any).dialog as HTMLDialogElement;

      // ใส่ fade-out class เพื่อเล่น animation
      dialogEl.classList.add('fade-out');

      // รอ 1 frame => event animationend
      requestAnimationFrame(() => {
        dialogEl.addEventListener(
          'animationend',
          () => {
            // 1) เอา fade-out ออก
            dialogEl.classList.remove('fade-out');
            // 2) ปิด dialog
            dialogEl.close();
            (storage.dialogItems as any).state = { open: false };

            // 3) unmount React เพื่อเคลียร์ state
            if ((storage.dialogItems as any).root) {
              ((storage.dialogItems as any).root as any).unmount();
              (storage.dialogItems as any).root = null;
            }

            // 4) เอา <dialog> ออกจาก DOM
            if (dialogEl.parentNode) {
              dialogEl.parentNode.removeChild(dialogEl);
            }

            // 5) เคลียร์ตัวแปรใน (storage.dialogItems as any)
            (storage.dialogItems as any).dialog = null;

            // เรียก didCloseModal หลังปิด
            didCloseModal();
          },
          { once: true }
        );
      });
    }

    return {
      dialog: {
        willShowModal,
        showModal,
        didShowModal,
        closeModal,
        willCloseModal,
        didCloseModal,
        modalData,
        modalState,
        modalACtion,
      },
    };
  };
}
