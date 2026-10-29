import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Check } from './check-list.ts';
import { blockedBy, formatReport, runChecks, tail } from './run-checks.ts';

const node = (code: string) => ['node', '-e', code];

describe('tail', () => {
  it('keeps the last lines and strips colour', () => {
    expect(tail('a\nb\n\u001b[31mc\u001b[0m\n', 2)).toBe('b\nc');
  });
});

describe('blockedBy', () => {
  const check: Check = { id: 'b', title: '', command: [], needs: ['a'] };
  it('blocks on a need that failed or never ran', () => {
    expect(blockedBy(check, new Map([['a', 'fail']]))).toMatch(/needs a/);
    expect(blockedBy(check, new Map())).toMatch(/needs a/);
    expect(blockedBy(check, new Map([['a', 'pass']]))).toBeUndefined();
  });
});

describe('runChecks', () => {
  it('runs every check, skips one whose need failed, and logs each', async () => {
    const logDir = mkdtempSync(join(tmpdir(), 'checks-test-'));
    const checks: Check[] = [
      { id: 'ok', title: 'passes', command: node('console.log("fine")') },
      {
        id: 'env',
        title: 'sees its env',
        command: node('process.exit(process.env.CI === "1" ? 0 : 1)'),
        env: { CI: '1' },
      },
      {
        id: 'bad:one',
        title: 'fails',
        command: node('console.error("boom"); process.exit(3)'),
      },
      { id: 'after', title: 'needs the failure', command: node(''), needs: ['bad:one'] },
      { id: 'missing', title: 'no such program', command: ['definitely-not-a-command-xyz'] },
    ];
    const progress: string[] = [];
    const results = await runChecks(checks, process.cwd(), logDir, (l) => progress.push(l));

    expect(results.map((r) => [r.check.id, r.status])).toEqual([
      ['ok', 'pass'],
      ['env', 'pass'],
      ['bad:one', 'fail'],
      ['after', 'skipped'],
      ['missing', 'fail'],
    ]);
    expect(readFileSync(join(logDir, 'ok.log'), 'utf8')).toBe('fine\n');
    expect(results[2].tail).toBe('boom');
    expect(results[2].log).toBe(join(logDir, 'bad-one.log'));
    expect(progress).toContain('skip  after (needs bad:one, which did not pass)');

    const report = formatReport(results);
    expect(report).toMatch(/^## Checks: 2 failed, 1 skipped, 2 passed\./);
    expect(report).toContain('| bad:one | **FAIL** |');
    expect(report).toContain('### bad:one failed');
    expect(report).toContain('**after** skipped: needs bad:one, which did not pass.');
  });

  it('says so plainly when everything passed', () => {
    const check: Check = { id: 'ok', title: 't', command: [] };
    expect(formatReport([{ check, status: 'pass', seconds: 1 }])).toMatch(
      /^## Checks: All 1 checks passed\./,
    );
  });
});
