interface PopoverProperty {
  id: string;
}

export const popover = (options: PopoverProperty) => {
  const { id } = options;

  return (storage, className) => {
    if (!storage.popover) {
      storage.popover = {};
    }

    if (!storage.popover.containerEl) {
      storage.popover.containerEl = {};
    }

    return {
      popover: {
        panel: (jsx: any) => {
          if (!jsx) {
            throw new Error(`ให้บอกว่า จะต้องมีการกำหนด jsx ก่อนเท่านั้น`);
          }

          // ตรวจสอบว่ามี div เดิมอยู่ใน DOM แล้วหรือยัง
          const existing = document.getElementById(id);

          const container =
            existing ??
            (() => {
              const containerEl = document.createElement('div');
              containerEl.id = id;
              containerEl.setAttribute('hidden', '');
              containerEl.setAttribute('role', 'dialog');
              containerEl.setAttribute('aria-modal', 'false');
              containerEl.tabIndex = -1;
              document.body.appendChild(containerEl);
              storage.popover.containerEl = containerEl;
              return containerEl;
            })();

          return storage.plugin.react.createPortal(jsx, container);
        },
        events: () => {},
        actions: {
          show: (e: any) => {
            console.log('popover.ts:63 |e| : ', e);
            storage.popover.containerEl.hidden = false;
          },
          close: (e: any) => {
            console.log('popover.ts:63 |e| : ', e);
            storage.popover.containerEl.hidden = true;
          },
        },
        id,
      },
    };
  };
};
