import { describe, expect, it } from 'vitest';
import { APP_PACKAGE, APPS_WITH_DATA, parseShotList } from './shot-list.ts';

const shot = { name: 'flashcards', path: '/flashcards', expect: 'Flashcards' };

describe('parseShotList', () => {
  it('accepts every app, the landing page included', () => {
    for (const app of ['greek', 'hebrew', 'landing'])
      expect(parseShotList({ app, shots: [shot] }).app).toBe(app);
  });

  it('maps each app to its workspace package, and says which read a corpus', () => {
    expect(APP_PACKAGE).toEqual({
      greek: 'greek-tools',
      hebrew: 'hebrew-tools',
      landing: 'landing',
    });
    expect(APPS_WITH_DATA).toEqual(['greek', 'hebrew']);
  });

  it('fills in both viewports, no steps and no storage by default', () => {
    expect(parseShotList({ app: 'hebrew', shots: [shot] })).toEqual({
      app: 'hebrew',
      before: true,
      shots: [
        {
          ...shot,
          steps: [],
          storage: {},
          viewports: ['mobile', 'desktop'],
          fullPage: false,
        },
      ],
    });
  });

  it('captures a before unless the list says not to', () => {
    expect(parseShotList({ app: 'greek', before: false, shots: [shot] }).before).toBe(false);
    expect(() => parseShotList({ app: 'greek', before: 'no', shots: [shot] })).toThrow(
      /"before" must be true or false/,
    );
  });

  it('refuses an empty list rather than capturing a default page', () => {
    expect(() => parseShotList({ app: 'greek', shots: [] })).toThrow(/never picks a page/);
    expect(() => parseShotList({ app: 'greek' })).toThrow(/at least one shot/);
  });

  it('requires the text that proves the page is right', () => {
    expect(() => parseShotList({ app: 'greek', shots: [{ name: 'home', path: '/' }] })).toThrow(
      /"expect" is required/,
    );
  });

  it('reports every problem at once', () => {
    const err = (() => {
      try {
        parseShotList({
          app: 'latin',
          shots: [{ name: 'Bad Name', path: 'flashcards', expect: 'x' }, 'nope'],
        });
      } catch (e) {
        return (e as Error).message;
      }
    })();
    expect(err).toMatch(/"app" must be one of "greek", "hebrew", "landing"/);
    expect(err).toMatch(/shot 1: "name" must be a slug/);
    expect(err).toMatch(/shot 1: "path" must start with "\/"/);
    expect(err).toMatch(/shot 2: a shot must be an object/);
  });

  it('refuses "before" on a shot, which only the list reads (PR #274)', () => {
    expect(() => parseShotList({ app: 'greek', shots: [{ ...shot, before: false }] })).toThrow(
      /shot 1: "before" belongs on the list/,
    );
  });

  it('refuses keys it does not read, on the list and on a shot', () => {
    expect(() =>
      parseShotList({ app: 'greek', viewport: 'mobile', shots: [{ ...shot, wait: 500 }] }),
    ).toThrow(/list: unknown key "viewport"[\s\S]*shot 1: unknown key "wait"/);
  });

  it('rejects a non-object list', () => {
    expect(() => parseShotList([])).toThrow(/JSON object/);
  });

  it('rejects duplicate names, which would overwrite each other', () => {
    expect(() => parseShotList({ app: 'hebrew', shots: [shot, shot] })).toThrow(
      /"flashcards" is used more than once/,
    );
  });

  it('parses every kind of step', () => {
    const steps = [
      { click: 'button' },
      { hover: 'a' },
      { fill: 'input', text: 'λόγος' },
      { press: 'Enter' },
      { waitFor: '.card' },
      { scrollTo: 'footer' },
    ];
    expect(parseShotList({ app: 'greek', shots: [{ ...shot, steps }] }).shots[0].steps).toEqual(
      steps,
    );
  });

  it.each([
    [['click'], /must be an object/],
    [[{}], /exactly one of/],
    [[{ click: 'a', hover: 'b' }], /exactly one of/],
    [[{ click: '' }], /"click" must be a non-empty string/],
    [[{ fill: 'input' }], /"fill" needs a "text" string/],
    ['click', /"steps" must be a list/],
  ])('rejects bad steps %j', (steps, message) => {
    expect(() => parseShotList({ app: 'greek', shots: [{ ...shot, steps }] })).toThrow(message);
  });

  it('JSON-encodes object storage values and keeps strings as they are', () => {
    const parsed = parseShotList({
      app: 'hebrew',
      shots: [{ ...shot, storage: { a: 'raw', b: { due: 3 } } }],
    });
    expect(parsed.shots[0].storage).toEqual({ a: 'raw', b: '{"due":3}' });
  });

  it('accepts a viewport subset, deduplicated', () => {
    const parsed = parseShotList({
      app: 'hebrew',
      shots: [{ ...shot, viewports: ['mobile', 'mobile'], fullPage: true, element: '.card' }],
    });
    expect(parsed.shots[0]).toMatchObject({
      viewports: ['mobile'],
      fullPage: true,
      element: '.card',
    });
  });

  it.each([
    [{ storage: 'x' }, /"storage" must be an object/],
    [{ viewports: [] }, /"viewports" must be a non-empty list/],
    [{ viewports: ['tablet'] }, /"viewports" must be a non-empty list/],
    [{ fullPage: 'yes' }, /"fullPage" must be true or false/],
    [{ element: '' }, /"element" must be a selector/],
  ])('rejects %j', (extra, message) => {
    expect(() => parseShotList({ app: 'hebrew', shots: [{ ...shot, ...extra }] })).toThrow(message);
  });
});
