/**
 * Start one app's Astro dev server on a port of its own, and stop it again.
 *
 * Both apps default to 4321, and a dev server you are using — in this checkout
 * or another worktree — is usually sitting on it. So this never touches 4321:
 * it asks the OS for a free port and starts a fresh server there. That also
 * rules out the old failure where a stale server for the *other* app answered
 * and the shots came out of the wrong site.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import type { App } from './shot-list.ts';

const READY_TIMEOUT = 90_000;

/** A port nothing is listening on right now. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

async function waitUntilUp(url: string, child: ChildProcess, log: () => string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`Dev server exited (${child.exitCode}) before it was ready:\n${log()}`);
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Dev server did not answer at ${url} within ${READY_TIMEOUT / 1000}s:\n${log()}`);
}

export interface DevServer {
  baseURL: string;
  stop(): void;
}

/** Start `<app>-tools`' dev server from the checkout at `root`. */
export async function startDevServer(app: App, root: string): Promise<DevServer> {
  const port = await freePort();
  const child = spawn(
    'pnpm',
    ['--filter', `${app}-tools`, 'dev', '--port', String(port), '--host', '127.0.0.1'],
    { cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let output = '';
  const keep = (b: Buffer) => {
    output = (output + b.toString()).slice(-4000);
  };
  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);

  // Negative pid: the whole process group, so pnpm's astro child goes too —
  // and only that group, never whatever else is running on the machine.
  const stop = () => {
    try {
      if (child.pid) process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  };

  const baseURL = `http://127.0.0.1:${port}`;
  try {
    await waitUntilUp(baseURL, child, () => output);
  } catch (err) {
    stop();
    throw err;
  }
  return { baseURL, stop };
}
