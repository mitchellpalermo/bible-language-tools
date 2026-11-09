/**
 * Drive a browser through a shot list against a running server and write one
 * PNG per shot per viewport. Knows nothing about starting servers or git, so
 * it can be tested against a plain HTTP server.
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { type Browser, chromium, type Page } from '@playwright/test';
import {
  fileName,
  HIDE_DEV_TOOLBAR,
  type Label,
  SCRIPT_FONT,
  titleMatchesApp,
  uncoveredChars,
} from './checks.ts';
import { bodyText, fontFaces, seedStorage, settleAnimations } from './in-page.ts';
import { type Shot, type ShotList, type Step, VIEWPORTS, type ViewportName } from './shot-list.ts';

export interface CaptureOptions {
  /** How long a step or the expected text may take to appear. */
  stepTimeout?: number;
}

/**
 * The first *visible* match. Pages carry hidden copies of their own text and
 * controls — the closed mobile drawer repeats every nav link — and a plain
 * `.first()` lands on those and then times out waiting for them to show.
 */
const visible = (page: Page, selector: string) =>
  page.locator(selector).filter({ visible: true }).first();

async function runStep(page: Page, step: Step, timeout: number): Promise<void> {
  const opts = { timeout };
  if ('click' in step) await visible(page, step.click).click(opts);
  else if ('hover' in step) await visible(page, step.hover).hover(opts);
  else if ('fill' in step) await visible(page, step.fill).fill(step.text, opts);
  else if ('press' in step) await page.keyboard.press(step.press);
  else if ('waitFor' in step) await visible(page, step.waitFor).waitFor(opts);
  else await visible(page, step.scrollTo).scrollIntoViewIfNeeded(opts);
}

/**
 * `reducedMotion` does not stop CSS transitions — the nav drawer slides in
 * regardless — and a shot taken mid-slide passes every other check.
 */
const SETTLE_CAP = 3000;

async function captureOne(
  browser: Browser,
  baseURL: string,
  list: ShotList,
  shot: Shot,
  viewport: ViewportName,
  out: string,
  as: Label,
  timeout: number,
): Promise<void> {
  const where = `${shot.name} (${viewport}, ${shot.path})`;
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    reducedMotion: 'reduce',
    deviceScaleFactor: 2,
  });
  try {
    if (Object.keys(shot.storage).length > 0) {
      await context.addInitScript(seedStorage, shot.storage);
    }
    const page = await context.newPage();
    const response = await page.goto(new URL(shot.path, baseURL).href, { waitUntil: 'load' });
    if (!response || response.status() >= 400)
      throw new Error(`${where}: server answered ${response?.status() ?? 'nothing'}`);

    const title = await page.title();
    if (!titleMatchesApp(list.app, title))
      throw new Error(`${where}: title "${title}" is not a ${list.app}.tools page`);

    await page.addStyleTag({ content: HIDE_DEV_TOOLBAR });
    for (const step of shot.steps) {
      try {
        await runStep(page, step, timeout);
      } catch (err) {
        throw new Error(
          // Playwright's first line says what went wrong; the rest is its call log.
          `${where}: step ${JSON.stringify(step)} failed — ${(err as Error).message.split('\n')[0]}`,
        );
      }
    }

    try {
      await page
        .getByText(shot.expect)
        .filter({ visible: true })
        .first()
        .waitFor({ state: 'visible', timeout });
    } catch {
      throw new Error(`${where}: expected text "${shot.expect}" is not visible`);
    }

    await page.evaluate(settleAnimations, SETTLE_CAP);
    const missing = uncoveredChars(
      list.app,
      await page.evaluate(bodyText),
      await page.evaluate(fontFaces),
    );
    if (missing.length > 0)
      throw new Error(
        `${where}: "${SCRIPT_FONT[list.app]}" never loaded for ${missing.slice(0, 12).join(' ')} — the shot would show a fallback font`,
      );

    const path = join(out, fileName(shot.name, viewport, as));
    if (shot.element)
      await visible(page, shot.element).screenshot({ path, animations: 'disabled' });
    else await page.screenshot({ path, fullPage: shot.fullPage, animations: 'disabled' });
  } finally {
    await context.close();
  }
}

/**
 * Capture every shot at every viewport it asks for. Stops at the first
 * failure: a half-captured set is worse than none, because it looks finished.
 * Returns the files written.
 */
export async function captureShots(
  baseURL: string,
  list: ShotList,
  out: string,
  as: Label,
  { stepTimeout = 10_000 }: CaptureOptions = {},
): Promise<string[]> {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch();
  const written: string[] = [];
  try {
    for (const shot of list.shots) {
      for (const viewport of shot.viewports) {
        await captureOne(browser, baseURL, list, shot, viewport, out, as, stepTimeout);
        written.push(fileName(shot.name, viewport, as));
      }
    }
  } finally {
    await browser.close();
  }
  return written;
}
