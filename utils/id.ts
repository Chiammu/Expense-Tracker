export const generateId = (): string => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}`;
};
