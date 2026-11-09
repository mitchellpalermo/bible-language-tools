import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { identityArgs } from './git.ts';

const run = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** A fresh repository with one staged file, as `pushAssets` builds one. */
function freshRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'git-test-'));
  run(dir, 'init', '-q', '.');
  writeFileSync(join(dir, 'shot.png'), 'png');
  run(dir, 'add', 'shot.png');
  return dir;
}

describe('identityArgs', () => {
  const dirs: string[] = [];
  const repo = () => {
    const dir = freshRepo();
    dirs.push(dir);
    return dir;
  };

  beforeEach(() => {
    // Hide every config but the repository's own, and every identity fallback,
    // so the test behaves the same on a machine with a global identity.
    vi.stubEnv('GIT_CONFIG_GLOBAL', '/dev/null');
    vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1');
    for (const v of [
      'GIT_AUTHOR_NAME',
      'GIT_AUTHOR_EMAIL',
      'GIT_COMMITTER_NAME',
      'GIT_COMMITTER_EMAIL',
      'EMAIL',
    ])
      vi.stubEnv(v, undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('lets a fresh repository commit as one whose identity is set locally', () => {
    const root = repo();
    run(root, 'config', 'user.name', 'Local Name');
    run(root, 'config', 'user.email', 'local@example.com');
    run(root, 'config', 'user.useConfigOnly', 'true');

    const tmp = repo();
    // The failure this exists for: no identity in a fresh `git init`.
    run(tmp, 'config', 'user.useConfigOnly', 'true');
    expect(() => run(tmp, 'commit', '-q', '-m', 'x')).toThrow(/identity|email/i);

    run(tmp, ...identityArgs(root), 'commit', '-q', '-m', 'assets');
    expect(run(tmp, 'log', '-1', '--format=%an <%ae>')).toBe('Local Name <local@example.com>');
  });

  it('leaves out what is not set, so git reports the gap itself', () => {
    expect(identityArgs(repo())).toEqual([]);
  });
});
