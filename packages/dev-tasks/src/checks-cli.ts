#!/usr/bin/env node
/**
 * Run the repo's checks and print one report. See packages/dev-tasks/README.md.
 *
 *   pnpm checks                  the data checks (default)
 *   pnpm checks ci               what both CI workflows run
 *   pnpm checks hebrew:vocab     one check, plus what it needs
 *   pnpm checks --list           every check and group
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHECKS, GROUPS, selectChecks } from './check-list.ts';
import { repoRoot } from './git.ts';
import { formatReport, runChecks } from './run-checks.ts';

const args = process.argv.slice(2);
try {
  if (args.includes('--list')) {
    console.log(`Groups: ${Object.keys(GROUPS).join(', ')} (default: data)\n`);
    for (const c of CHECKS)
      console.log(`${c.id.padEnd(20)} ${c.title}${c.network ? ' [network]' : ''}`);
  } else {
    const checks = selectChecks(args);
    const root = repoRoot();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logDir = join(root, '.checks', stamp);
    const results = await runChecks(checks, root, logDir, (line) => console.error(line));
    const report = formatReport(results);
    writeFileSync(join(logDir, 'report.md'), `${report}\n`);
    console.log(`\n${report}\n\nReport saved to ${join(logDir, 'report.md')}`);
    if (results.some((r) => r.status !== 'pass')) process.exitCode = 1;
  }
} catch (err) {
  console.error((err as Error).message);
  process.exit(2);
}
