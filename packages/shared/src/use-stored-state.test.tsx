import { act, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hydrationErrors } from './test/hydration';
import { useHydrated, useStoredState } from './use-stored-state';

const KEY = 'use-stored-state-test';
// Guarded like every loader in both apps: on the server storage is absent.
const load = () => {
  try {
    return localStorage.getItem(KEY) ?? 'default';
  } catch {
    return 'default';
  }
};
const save = (value: string) => localStorage.setItem(KEY, value);
const seed = () => localStorage.setItem(KEY, 'stored');

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

function Stored() {
  const [value, , loaded] = useStoredState(load, 'default');
  return (
    <p data-loaded={String(loaded)} className={value}>
      {value}
    </p>
  );
}

// ─── The helper ───────────────────────────────────────────────────────────────
// These pin that `hydrationErrors` sees both kinds of mismatch. If it stopped
// seeing them, every hydration test in both apps would pass for nothing.

describe('hydrationErrors', () => {
  it('reports a text mismatch from a storage read during render', async () => {
    function ReadsInRender() {
      const [value] = useState(load);
      return <p>{value}</p>;
    }

    expect(await hydrationErrors(<ReadsInRender />, { seed })).not.toEqual([]);
  });

  it('reports an attribute-only mismatch, which React does not throw for', async () => {
    function ReadsInRender() {
      const [value] = useState(load);
      return <p className={value}>same text</p>;
    }

    expect(await hydrationErrors(<ReadsInRender />, { seed })).not.toEqual([]);
  });

  it('hides storage from the server render, as production does', async () => {
    let seenOnServer: string | undefined;
    function Probe() {
      try {
        seenOnServer ??= localStorage.getItem(KEY) ?? 'empty';
      } catch {
        seenOnServer ??= 'absent';
      }
      return null;
    }
    seed();

    await hydrationErrors(<Probe />);

    expect(seenOnServer).toBe('absent');
    expect(localStorage.getItem(KEY)).toBe('stored');
  });

  it('passes other console errors through untouched', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Noisy() {
      console.error('unrelated');
      return null;
    }

    expect(await hydrationErrors(<Noisy />)).toEqual([]);
    expect(spy).toHaveBeenCalledWith('unrelated');
  });
});

// ─── useStoredState ───────────────────────────────────────────────────────────

describe('useStoredState', () => {
  it('renders the fallback on the server without touching storage', () => {
    seed();
    const spy = vi.fn(load);
    function Server() {
      const [value] = useStoredState(spy, 'default');
      return <p>{value}</p>;
    }

    expect(renderToString(<Server />)).toContain('default');
    expect(spy).not.toHaveBeenCalled();
  });

  it('raises no warning on the server for its layout effect', () => {
    const spy = vi.spyOn(console, 'error');

    renderToString(<Stored />);

    expect(spy).not.toHaveBeenCalled();
  });

  it('hydrates cleanly over server HTML for a returning student', async () => {
    expect(await hydrationErrors(<Stored />, { seed })).toEqual([]);
  });

  it('shows the stored value once hydrated', async () => {
    seed();
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Stored />);
    document.body.appendChild(container);

    const { hydrateRoot } = await import('react-dom/client');
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <Stored />);
    });

    const p = container.querySelector('p');
    expect(p?.textContent).toBe('stored');
    expect(p?.dataset.loaded).toBe('true');
    act(() => root?.unmount());
    container.remove();
  });

  it('reads storage on the first render when nothing is being hydrated', () => {
    seed();
    const spy = vi.fn(load);
    const { result } = renderHook(() => useStoredState(spy, 'default'));

    expect(result.current[0]).toBe('stored');
    expect(result.current[2]).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('persists every value set through it, functional updates included', () => {
    const { result } = renderHook(() => useStoredState(load, 'default', save));

    act(() => result.current[1]('one'));
    expect(localStorage.getItem(KEY)).toBe('one');

    act(() => result.current[1]((prev) => `${prev}+two`));
    expect(result.current[0]).toBe('one+two');
    expect(localStorage.getItem(KEY)).toBe('one+two');
  });

  it('writes nothing on mount, so the fallback never overwrites stored data', async () => {
    seed();
    const spy = vi.fn(save);
    function Saving() {
      const [value] = useStoredState(load, 'default', spy);
      return <p>{value}</p>;
    }

    expect(await hydrationErrors(<Saving />)).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe('stored');
  });

  it('persists nothing when no save is given', () => {
    const { result } = renderHook(() => useStoredState(load, 'default'));

    act(() => result.current[1]('changed'));

    expect(result.current[0]).toBe('changed');
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe('useHydrated', () => {
  it('is false on the server', () => {
    function Flag() {
      return <p>{String(useHydrated())}</p>;
    }

    expect(renderToString(<Flag />)).toContain('false');
  });

  it('is true for a component mounted outside hydration', () => {
    function Flag() {
      return <p>{String(useHydrated())}</p>;
    }
    render(<Flag />);

    expect(screen.getByText('true')).toBeTruthy();
  });
});
