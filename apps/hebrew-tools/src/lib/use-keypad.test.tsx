import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useKeypad } from './use-keypad';

const pointer = (coarse: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: coarse && query === '(pointer: coarse)' })),
  );

afterEach(() => vi.unstubAllGlobals());

describe('useKeypad', () => {
  it('starts open on a touch screen', () => {
    pointer(true);
    const { result } = renderHook(() => useKeypad());
    expect(result.current.open).toBe(true);
  });

  it('starts closed with a mouse, and toggles', () => {
    pointer(false);
    const { result } = renderHook(() => useKeypad());
    expect(result.current.open).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.open).toBe(false);
  });
});
