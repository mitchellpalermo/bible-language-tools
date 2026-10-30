import { describe, expect, it } from 'vitest';
import { parseShotList } from './shot-list.ts';

const shot = { name: 'flashcards', path: '/flashcards', expect: 'Flashcards' };

describe('parseShotList', () => {
  it('fills in both viewports, no steps and no storage by default', () => {
    expect(parseShotList({ app: 'hebrew', shots: [shot] })).toEqual({
      app: 'hebrew',
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
    expect(err).toMatch(/"app" must be "greek" or "hebrew"/);
    expect(err).toMatch(/shot 1: "name" must be a slug/);
    expect(err).toMatch(/shot 1: "path" must start with "\/"/);
    expect(err).toMatch(/shot 2: a shot must be an object/);
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
