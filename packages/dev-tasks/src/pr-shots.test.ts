import { describe, expect, it } from 'vitest';
import {
  alreadyRun,
  failureContent,
  parseShotBlocks,
  runKey,
  SECTION_END,
  SECTION_START,
  shotBlocks,
  withSection,
} from './pr-shots.ts';

const list = (app: string, name: string) =>
  JSON.stringify({ app, shots: [{ name, path: '/study', expect: 'Study' }] }, null, 2);

const body = (...blocks: string[]) =>
  [
    'Closes #1.',
    ...blocks.map(
      (b) => `<details><summary>Shot list</summary>\n\n\`\`\`shots\n${b}\n\`\`\`\n</details>`,
    ),
  ].join('\n\n');

describe('shotBlocks', () => {
  it('finds every ```shots block and nothing else', () => {
    const b = `${body(list('hebrew', 'a'), list('greek', 'b'))}\n\n\`\`\`json\n{}\n\`\`\``;
    expect(shotBlocks(b)).toEqual([list('hebrew', 'a'), list('greek', 'b')]);
  });

  it('finds none in a body without one', () => {
    expect(shotBlocks('Closes #1.\n\n```ts\nconst x = 1;\n```')).toEqual([]);
    expect(shotBlocks('')).toEqual([]);
  });

  it('accepts tildes, longer fences and CRLF', () => {
    expect(shotBlocks('~~~~shots\r\n{"a":1}\r\n~~~~')).toEqual(['{"a":1}']);
  });

  it('ignores a block inside its own screenshots section', () => {
    const b = withSection(body(list('hebrew', 'a')), failureContent('```shots\n{}\n```'), 'k');
    expect(shotBlocks(b)).toEqual([list('hebrew', 'a')]);
  });
});

describe('parseShotBlocks', () => {
  it('parses each block as a shot list', () => {
    const [h, g] = parseShotBlocks([list('hebrew', 'a'), list('greek', 'b')]);
    expect(h.app).toBe('hebrew');
    expect(g.shots[0].name).toBe('b');
  });

  it('names the block that is not JSON', () => {
    expect(() => parseShotBlocks([list('hebrew', 'a'), '{ nope'])).toThrow(
      /shots block 2 is not valid JSON/,
    );
  });

  it('passes on the shot list errors', () => {
    expect(() => parseShotBlocks(['{"app":"latin","shots":[]}'])).toThrow(
      /shots block: Invalid shot list/,
    );
  });

  it('refuses a shot name used in two lists, since their files share a branch', () => {
    expect(() => parseShotBlocks([list('hebrew', 'study'), list('greek', 'study')])).toThrow(
      /"study" appears in more than one/,
    );
  });
});

describe('runKey and alreadyRun', () => {
  const blocks = [list('hebrew', 'a')];

  it('changes with the commit and with the list', () => {
    const k = runKey('abc', blocks);
    expect(runKey('abc', blocks)).toBe(k);
    expect(runKey('abd', blocks)).not.toBe(k);
    expect(runKey('abc', [list('hebrew', 'b')])).not.toBe(k);
  });

  it('is true only once a section for that key is in the body', () => {
    const k = runKey('abc', blocks);
    const b = body(blocks[0]);
    expect(alreadyRun(b, k)).toBe(false);
    const done = withSection(b, '## Screenshots\n\n| x |', k);
    expect(alreadyRun(done, k)).toBe(true);
    expect(alreadyRun(done, runKey('new', blocks))).toBe(false);
  });

  it('is false when the marker is outside the section', () => {
    expect(alreadyRun('<!-- shots-run: k -->', 'k')).toBe(false);
  });
});

describe('withSection', () => {
  it('appends a section to a body without one', () => {
    const out = withSection('Closes #1.\n\n', 'table', 'k1');
    expect(out).toBe(
      `Closes #1.\n\n${SECTION_START}\n<!-- shots-run: k1 -->\ntable\n${SECTION_END}\n`,
    );
  });

  it('replaces the section in place and keeps the rest of the body', () => {
    const first = withSection('Top', 'old', 'k1') + '\nBottom';
    const second = withSection(first, 'new $& $1', 'k2');
    expect(second).toContain('Top');
    expect(second).toContain('Bottom');
    expect(second).toContain('new $& $1');
    expect(second).not.toContain('old');
    expect(second.match(/shots:start/g)).toHaveLength(1);
  });
});

describe('a marker mentioned in prose', () => {
  const prose = 'The table goes between `<!-- shots:start -->` and `<!-- shots:end -->`.';

  it('is not taken for the section', () => {
    const out = withSection(prose, 'table', 'k1');
    expect(out.startsWith(prose)).toBe(true);
    expect(out.match(/^<!-- shots:start -->$/gm)).toHaveLength(1);
    expect(alreadyRun(prose.replace('start -->', 'start -->\n<!-- shots-run: k1 -->'), 'k1')).toBe(
      false,
    );
  });

  it('is left alone when the real section is replaced', () => {
    const once = withSection(prose, 'old', 'k1');
    const twice = withSection(once, 'new', 'k2');
    expect(twice.startsWith(prose)).toBe(true);
    expect(twice).toContain('new');
    expect(twice).not.toContain('old');
    expect(alreadyRun(twice, 'k2')).toBe(true);
  });
});

describe('failureContent', () => {
  it('shows the error and how to retry', () => {
    const md = failureContent('  "Again" was not visible  ');
    expect(md).toContain('Capture failed');
    expect(md).toContain('"Again" was not visible\n```');
  });
});
