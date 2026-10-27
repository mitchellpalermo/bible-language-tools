/**
 * State kept in browser storage, read so that hydration survives it.
 *
 * Both apps prerender their pages, and the server has no `localStorage`. A
 * component that reads storage while rendering draws the defaults on the
 * server and the student's real values in the browser, and React throws
 * hydration error #418 at the difference — or, when only an attribute
 * differs, keeps the server's attribute with no error at all. ADR 006 has
 * the full account.
 *
 * The rule these hooks enforce: **the first client render must match the
 * server's.** So during hydration they hand back the fallback, and swap in
 * the stored value in a layout effect, which re-renders before the browser
 * paints. A component that mounts after hydration — a tab opened later, or a
 * test rendering with `createRoot` — is never compared to server HTML, so it
 * reads storage straight away and skips the extra render.
 */

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

const noSubscription = () => () => {};

/**
 * False on the server and during hydration, true from then on, and true from
 * the start for anything that mounts after hydration.
 *
 * `useSyncExternalStore` is React's own escape hatch for this: it renders the
 * server snapshot while hydrating, then re-renders with the client one before
 * paint. Use it to hold back output that would differ from the server's.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

/**
 * `useState`, seeded from storage without breaking hydration.
 *
 * Returns `[value, setValue, loaded]`. `loaded` is false only for the
 * hydration render, while `value` is still `fallback` — use it to hold back
 * an empty state ("No passages yet") that would be wrong for a returning
 * student.
 *
 * Pass `save` and the setter persists every new value itself. That is
 * deliberate, not a convenience: the usual alternative, an effect that saves
 * whenever the value changes, runs on mount with the fallback and writes it
 * over what the student had stored.
 *
 * `load` and `save` are read through a ref, so they need not be stable. `save`
 * runs inside a state updater, which React's Strict Mode calls twice in
 * development — it must be idempotent, as a `setItem` is.
 */
export function useStoredState<T>(
  load: () => T,
  fallback: T,
  save?: (value: T) => void,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const io = useRef({ load, save });
  io.current = { load, save };

  const hydrated = useHydrated();
  const [state, setState] = useState(() =>
    hydrated ? { value: load(), loaded: true } : { value: fallback, loaded: false },
  );

  useLayoutEffect(() => {
    setState((s) => (s.loaded ? s : { value: io.current.load(), loaded: true }));
  }, []);

  const setValue = useCallback((action: SetStateAction<T>) => {
    setState((s) => {
      const value = typeof action === 'function' ? (action as (prev: T) => T)(s.value) : action;
      io.current.save?.(value);
      return { value, loaded: s.loaded };
    });
  }, []);

  return [state.value, setValue, state.loaded];
}
