/**
 * Test helper: does a component hydrate cleanly over its own server HTML?
 *
 * Production builds prerender each island on a server with no storage, then
 * hydrate it in a browser that has the student's data. This replays that in
 * one test: render to a string with storage hidden, seed storage, hydrate the
 * markup, and report every mismatch React notices — the thrown kind (#418, a
 * text difference) and the silent kind (an attribute difference, which React
 * leaves unrepaired and only warns about in development).
 *
 * ADR 006 explains the rule this guards. A grep for storage reads is not a
 * substitute: reads hide in `useMemo`, behind helper functions and inside
 * nested generics, and a read is harmless anyway when nothing it returns
 * reaches the first render. This asks the question that matters.
 *
 * Usage:
 *
 *   expect(await hydrationErrors(<ParadigmQuiz />, { seed })).toEqual([]);
 */

import { act, type ReactElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

interface HydrationOptions {
  /** Writes the returning student's data, after the server render and before hydration. */
  seed?: () => void;
}

const STORAGES = ['localStorage', 'sessionStorage'] as const;

/** Storage that behaves as it does on the server: every touch throws. */
const absentStorage = (name: string): Storage =>
  new Proxy({} as Storage, {
    get() {
      throw new ReferenceError(`${name} is not defined`);
    },
  });

function renderOnServer(ui: ReactElement): string {
  const g = globalThis as unknown as Record<string, Storage | undefined>;
  const saved = STORAGES.map((name) => [name, g[name]] as const);
  for (const [name] of saved) g[name] = absentStorage(name);
  try {
    return renderToString(ui);
  } finally {
    for (const [name, storage] of saved) g[name] = storage;
  }
}

/**
 * Renders `ui` as the server would, hydrates it with `seed` applied, and
 * returns the hydration errors and warnings React raised. Empty means clean.
 */
export async function hydrationErrors(
  ui: ReactElement,
  { seed }: HydrationOptions = {},
): Promise<string[]> {
  const html = renderOnServer(ui);
  seed?.();

  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  const problems: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const message = args.map(String).join(' ');
    if (/hydrat|did not match|didn't match/i.test(message)) problems.push(message);
    else originalError(...args);
  };

  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, ui, {
        onRecoverableError: (error) => {
          problems.push(error instanceof Error ? error.message : String(error));
        },
      });
    });
  } finally {
    console.error = originalError;
    act(() => root?.unmount());
    container.remove();
  }
  return problems;
}
