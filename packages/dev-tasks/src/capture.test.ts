import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { captureShots } from './capture.ts';
import { parseShotList } from './shot-list.ts';

// A stand-in for an app: plain pages titled the way the real layouts title
// theirs, so the checks run against a real browser without an Astro server.
const page = (title: string, body: string) =>
  `<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`;

const PAGES: Record<string, string> = {
  '/': page('Home | hebrew.tools', '<h1>Welcome</h1>'),
  '/greek': page('Home | greek.tools', '<h1>Welcome</h1>'),
  '/hidden': page(
    'Cards | hebrew.tools',
    `<input id="q"><button id="show">Show</button><p id="answer" hidden>Revealed</p>
     <script>show.onclick = () => { answer.hidden = false }</script>`,
  ),
  '/stored': page(
    'Stats | hebrew.tools',
    `<p id="out"></p><script>out.textContent = 'Streak ' + localStorage.getItem('streak')</script>`,
  ),
  // A hidden copy first, as the closed mobile drawer has of every nav link.
  '/dup': page(
    'Study | hebrew.tools',
    `<nav hidden><a class="go">Paradigms</a></nav>
     <h2>Paradigms</h2><a class="go" href="/">Go</a>`,
  ),
  // A panel that slides in over 600ms once the button is clicked.
  '/slide': page(
    'Menu | hebrew.tools',
    `<style>#panel { transform: translateX(100%); transition: transform 600ms linear }
       #panel.open { transform: none }</style>
     <button id="opener">Menu</button><div id="panel">Menu items</div>
     <script>document.getElementById('opener').onclick = () => document.getElementById('panel').classList.add('open')</script>`,
  ),
  // Hebrew text with no webfont declared: what a blocked Google Fonts looks like.
  '/no-font': page('Word | hebrew.tools', '<p>Word of the day: בְּרֵאשִׁית</p>'),
};

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    const body = PAGES[req.url ?? ''];
    res.writeHead(body ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(body ?? page('Not found | hebrew.tools', 'Not found'));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

const out = () => mkdtempSync(join(tmpdir(), 'shots-test-'));
const run = (shots: unknown[], dir = out(), app = 'hebrew') =>
  captureShots(base, parseShotList({ app, shots }), dir, 'after', { stepTimeout: 1500 });

describe('captureShots', () => {
  it('writes one PNG per viewport once the expected text is visible', async () => {
    const dir = out();
    const files = await run([{ name: 'home', path: '/', expect: 'Welcome' }], dir);
    expect(files).toEqual(['home-mobile-after.png', 'home-desktop-after.png']);
    expect(readdirSync(dir).sort()).toEqual(['home-desktop-after.png', 'home-mobile-after.png']);
  });

  it('runs steps to reach the state, and captures one element', async () => {
    const dir = out();
    await run(
      [
        {
          name: 'answer',
          path: '/hidden',
          expect: 'Revealed',
          steps: [{ click: '#show' }],
          element: '#answer',
          viewports: ['mobile'],
        },
      ],
      dir,
    );
    expect(existsSync(join(dir, 'answer-mobile-after.png'))).toBe(true);
  });

  it('seeds localStorage before the page loads', async () => {
    await expect(
      run([
        {
          name: 's',
          path: '/stored',
          expect: 'Streak 12',
          storage: { streak: 12 },
          viewports: ['mobile'],
        },
      ]),
    ).resolves.toHaveLength(1);
  });

  it('looks past hidden copies to the visible match', async () => {
    await expect(
      run([
        {
          name: 'dup',
          path: '/dup',
          expect: 'Paradigms',
          steps: [{ hover: '.go' }],
          viewports: ['mobile'],
        },
      ]),
    ).resolves.toHaveLength(1);
  });

  it('waits for a transition to finish before capturing', async () => {
    const started = Date.now();
    await run([
      {
        name: 'slide',
        path: '/slide',
        expect: 'Menu items',
        steps: [{ click: '#opener' }],
        viewports: ['mobile'],
      },
    ]);
    // The click lands immediately; the 600ms is the wait for the slide.
    expect(Date.now() - started).toBeGreaterThanOrEqual(600);
  });

  it('fails on a 404 instead of shooting the error page', async () => {
    await expect(run([{ name: 'x', path: '/nope', expect: 'Not found' }])).rejects.toThrow(
      /server answered 404/,
    );
  });

  it('fails when the other app is answering', async () => {
    await expect(run([{ name: 'x', path: '/greek', expect: 'Welcome' }])).rejects.toThrow(
      /not a hebrew\.tools page/,
    );
  });

  it('fails when the expected text never shows', async () => {
    await expect(run([{ name: 'x', path: '/hidden', expect: 'Revealed' }])).rejects.toThrow(
      /expected text "Revealed" is not visible/,
    );
  });

  it('fails when a step misses its target', async () => {
    await expect(
      run([{ name: 'x', path: '/hidden', expect: 'Revealed', steps: [{ click: '#nope' }] }]),
    ).rejects.toThrow(/step \{"click":"#nope"\} failed/);
  });

  it('fails rather than shoot Hebrew in a fallback font', async () => {
    await expect(run([{ name: 'x', path: '/no-font', expect: 'Word of the day' }])).rejects.toThrow(
      /"Noto Sans Hebrew" never loaded/,
    );
  });

  it('runs every step kind', async () => {
    await expect(
      run([
        {
          name: 'steps',
          path: '/hidden',
          expect: 'Revealed',
          viewports: ['desktop'],
          fullPage: true,
          steps: [
            { hover: '#show' },
            { scrollTo: '#show' },
            { click: '#show' },
            { waitFor: '#answer' },
            { fill: '#q', text: 'λόγος' },
            { press: 'Tab' },
          ],
        },
      ]),
    ).resolves.toHaveLength(1);
  });
});
