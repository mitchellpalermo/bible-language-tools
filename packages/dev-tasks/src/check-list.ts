/**
 * Every repeatable check in the repo, and how to pick some of them.
 *
 * The list mirrors what CI runs (`.github/workflows/*.yml`) plus the data
 * checks CI does not run: the generators' `--check` modes, the daily-verse
 * proofread and the BDB pins against TBESH. A check names what it `needs`, and
 * a selection pulls those in — so asking for the vocabulary check also builds
 * the corpus it compares against, instead of failing on an absent file.
 */

export interface Check {
  id: string;
  /** What the check catches, in one line, for the report. */
  title: string;
  command: string[];
  env?: Record<string, string>;
  needs?: string[];
  /** Downloads something; slow or unavailable offline. */
  network?: boolean;
}

const pnpm = (...args: string[]) => ['pnpm', ...args];
const hebrew = (...args: string[]) => pnpm('--filter', 'hebrew-tools', ...args);
const greek = (...args: string[]) => pnpm('--filter', 'greek-tools', ...args);

export const CHECKS: Check[] = [
  { id: 'lint', title: 'Biome over the whole repo', command: pnpm('lint') },

  {
    id: 'hebrew:corpus',
    title: 'Fetch the Westminster Leningrad Codex the data checks read',
    command: hebrew('build:data'),
    network: true,
  },
  {
    id: 'hebrew:tests',
    title: 'hebrew-tools tests, with the corpus gate on',
    command: hebrew('test:run'),
    // CI=1 turns corpus.test.ts on: with the corpus missing, the gate fails
    // instead of skipping, exactly as it does in the workflow.
    env: { CI: '1' },
    needs: ['hebrew:corpus'],
  },
  { id: 'hebrew:typecheck', title: 'hebrew-tools typecheck', command: hebrew('typecheck') },
  {
    id: 'hebrew:vocab',
    title: 'vocabulary-garrett.ts matches what build-vocabulary.mjs would write',
    command: hebrew('build:vocab:check'),
    needs: ['hebrew:corpus'],
  },
  {
    id: 'hebrew:morph-codes',
    title: 'morph-codes.json matches the codes the corpus uses',
    command: hebrew('build:morph-codes:check'),
    needs: ['hebrew:corpus'],
  },
  {
    id: 'hebrew:verses',
    title: 'Every daily verse resolves in the corpus',
    command: hebrew('check:verses'),
    needs: ['hebrew:corpus'],
  },
  {
    id: 'hebrew:pins',
    title: 'Every BDB pin still agrees with STEPBible TBESH',
    command: hebrew('check:pins'),
    network: true,
  },

  { id: 'greek:tests', title: 'greek-tools tests', command: greek('test:run') },
  { id: 'greek:typecheck', title: 'greek-tools typecheck', command: greek('typecheck') },

  {
    id: 'shared:tests',
    title: 'packages/shared tests with the 90% coverage gate',
    command: pnpm('--filter', '@tools/shared', 'test:coverage'),
  },
  {
    id: 'shared:typecheck',
    title: 'packages/shared typecheck',
    command: pnpm('--filter', '@tools/shared', 'typecheck'),
  },
  {
    id: 'db:tests',
    title: 'packages/db tests',
    command: pnpm('--filter', '@tools/db', 'test:run'),
  },
  {
    id: 'db:typecheck',
    title: 'packages/db typecheck',
    command: pnpm('--filter', '@tools/db', 'typecheck'),
  },
  {
    id: 'dev-tasks:tests',
    title: 'packages/dev-tasks tests',
    command: pnpm('--filter', '@tools/dev-tasks', 'test:run'),
  },
];

/** Named selections. Anything else is a check id. */
export const GROUPS: Record<string, (c: Check) => boolean> = {
  all: () => true,
  // The data checks: the corpus gate, the generators' --check modes, the
  // verse and pin checks. What changes to src/data or scripts/ need.
  data: (c) =>
    ['hebrew:tests', 'hebrew:vocab', 'hebrew:morph-codes', 'hebrew:verses', 'hebrew:pins'].includes(
      c.id,
    ),
  hebrew: (c) => c.id.startsWith('hebrew:'),
  greek: (c) => c.id.startsWith('greek:'),
  shared: (c) => c.id.startsWith('shared:'),
  // What a pull request's CI would run, both workflows together.
  ci: (c) => !['hebrew:vocab', 'hebrew:morph-codes', 'hebrew:verses', 'hebrew:pins'].includes(c.id),
};

/**
 * Resolve names (groups or ids) to checks in list order, adding whatever they
 * need. Throws on an unknown name rather than running less than was asked.
 */
export function selectChecks(names: string[], checks: Check[] = CHECKS): Check[] {
  const byId = new Map(checks.map((c) => [c.id, c]));
  const wanted = new Set<string>();
  const unknown: string[] = [];
  for (const name of names.length > 0 ? names : ['data']) {
    const group = GROUPS[name];
    if (group) for (const c of checks.filter(group)) wanted.add(c.id);
    else if (byId.has(name)) wanted.add(name);
    else unknown.push(name);
  }
  if (unknown.length > 0) {
    const known = [...Object.keys(GROUPS), ...byId.keys()].join(', ');
    throw new Error(`Unknown check or group: ${unknown.join(', ')}\nKnown: ${known}`);
  }

  const add = (id: string, path: string[]) => {
    if (path.includes(id))
      throw new Error(`Checks need each other in a loop: ${[...path, id].join(' → ')}`);
    const check = byId.get(id);
    if (!check) throw new Error(`"${path.at(-1)}" needs unknown check "${id}"`);
    for (const need of check.needs ?? []) add(need, [...path, id]);
    wanted.add(id);
  };
  for (const id of [...wanted]) add(id, []);

  return checks.filter((c) => wanted.has(c.id));
}
