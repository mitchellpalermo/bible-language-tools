import '@testing-library/jest-dom/vitest';

// happy-dom's localStorage is incomplete — replace with a full working mock
let _store: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key) => _store[key] ?? null,
  setItem: (key, value) => { _store[key] = String(value); },
  removeItem: (key) => { delete _store[key]; },
  clear: () => { _store = {}; },
  get length() { return Object.keys(_store).length; },
  key: (i) => Object.keys(_store)[i] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
