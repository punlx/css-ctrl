// src/server/constant.ts
export const isServer = typeof window === 'undefined';

export const _sheet: Record<'serverStyleSheet', any> = {
  serverStyleSheet: null,
};
