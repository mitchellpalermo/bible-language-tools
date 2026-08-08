import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initNavMenu, type NavMenuHandle } from './nav-menu';

// Mirrors the structural contract of components/SiteNav.astro: a trigger, a
// backdrop, and a panel whose first focusable is the close button.
const MARKUP = `
  <header>
    <button type="button" data-nav-trigger aria-expanded="false" aria-controls="site-nav-panel">Menu</button>
    <div data-nav-backdrop></div>
    <nav id="site-nav-panel" data-nav-panel>
      <button type="button" data-nav-close id="close">Close</button>
      <ul>
        <li><a id="type" href="/keyboard">Type</a></li>
        <li><a id="study" href="/study">Study</a></li>
      </ul>
      <a id="account" href="/account">Account</a>
    </nav>
  </header>
  <main><button id="outside">Outside</button></main>
`;

let menu: NavMenuHandle | null;

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing #${id}`);
  return found as T;
}

function trigger(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-nav-trigger]') as HTMLElement;
}

function panel(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-nav-panel]') as HTMLElement;
}

function backdrop(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-nav-backdrop]') as HTMLElement;
}

function press(key: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
  document.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  document.body.innerHTML = MARKUP;
  document.body.style.overflow = '';
  menu = initNavMenu();
});

afterEach(() => {
  menu?.destroy();
  menu = null;
  document.body.innerHTML = '';
});

describe('initNavMenu', () => {
  it('returns null when the nav markup is not on the page', () => {
    document.body.innerHTML = '<main>no nav here</main>';
    expect(initNavMenu()).toBeNull();
  });

  it('returns null when the panel is missing', () => {
    document.body.innerHTML = '<button data-nav-trigger></button>';
    expect(initNavMenu()).toBeNull();
  });

  it('starts closed', () => {
    expect(menu?.isOpen()).toBe(false);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(panel().hasAttribute('data-nav-open')).toBe(false);
  });

  it('scopes its query to the root it is given', () => {
    const scoped = document.createElement('div');
    document.body.appendChild(scoped);
    expect(initNavMenu(scoped)).toBeNull();
  });
});

describe('opening', () => {
  it('opens on trigger click', () => {
    trigger().click();

    expect(menu?.isOpen()).toBe(true);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(panel().hasAttribute('data-nav-open')).toBe(true);
    expect(backdrop().hasAttribute('data-nav-open')).toBe(true);
  });

  it('locks body scroll while open', () => {
    trigger().click();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('moves focus into the panel', () => {
    trigger().click();
    expect(document.activeElement).toBe(el('close'));
  });

  it('toggles shut on a second trigger click', () => {
    trigger().click();
    trigger().click();
    expect(menu?.isOpen()).toBe(false);
  });

  it('ignores a redundant open', () => {
    menu?.open();
    el('type').focus();
    menu?.open();
    expect(document.activeElement).toBe(el('type'));
  });

  it('opens with no backdrop present', () => {
    menu?.destroy();
    backdrop().remove();
    menu = initNavMenu();

    trigger().click();
    expect(menu?.isOpen()).toBe(true);
  });
});

describe('closing', () => {
  beforeEach(() => {
    trigger().click();
  });

  it('closes on link click', () => {
    el('type').click();
    expect(menu?.isOpen()).toBe(false);
    expect(panel().hasAttribute('data-nav-open')).toBe(false);
  });

  it('closes on close-button click', () => {
    el('close').click();
    expect(menu?.isOpen()).toBe(false);
  });

  it('closes on backdrop click', () => {
    backdrop().click();
    expect(menu?.isOpen()).toBe(false);
  });

  it('closes on Escape', () => {
    const event = press('Escape');
    expect(menu?.isOpen()).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it('returns focus to the trigger', () => {
    press('Escape');
    expect(document.activeElement).toBe(trigger());
  });

  it('releases the body scroll lock', () => {
    press('Escape');
    expect(document.body.style.overflow).toBe('');
  });

  it('restores a scroll lock the page had set for its own reasons', () => {
    menu?.close();
    document.body.style.overflow = 'clip';

    trigger().click();
    expect(document.body.style.overflow).toBe('hidden');

    press('Escape');
    expect(document.body.style.overflow).toBe('clip');
  });

  it('ignores clicks on the panel’s own chrome', () => {
    panel().click();
    expect(menu?.isOpen()).toBe(true);
  });
});

describe('focus trap', () => {
  beforeEach(() => {
    trigger().click();
  });

  it('wraps forward from the last focusable to the first', () => {
    el('account').focus();
    const event = press('Tab');

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(el('close'));
  });

  it('wraps backward from the first focusable to the last', () => {
    el('close').focus();
    const event = press('Tab', true);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(el('account'));
  });

  it('leaves Tab alone in the middle of the panel', () => {
    el('type').focus();
    const event = press('Tab');

    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(el('type'));
  });

  it('pulls focus back in when it escapes the panel', () => {
    el('outside').focus();
    press('Tab');
    expect(document.activeElement).toBe(el('close'));
  });

  it('pulls focus back to the end on a backward tab from outside', () => {
    el('outside').focus();
    press('Tab', true);
    expect(document.activeElement).toBe(el('account'));
  });

  it('swallows Tab when the panel has nothing focusable', () => {
    panel().innerHTML = '<p>Nothing here</p>';
    const event = press('Tab');
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores other keys', () => {
    el('type').focus();
    const event = press('a');

    expect(event.defaultPrevented).toBe(false);
    expect(menu?.isOpen()).toBe(true);
  });
});

describe('while closed', () => {
  it('ignores Escape', () => {
    const event = press('Escape');
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores Tab', () => {
    const event = press('Tab');
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores a redundant close', () => {
    el('outside').focus();
    menu?.close();
    expect(document.activeElement).toBe(el('outside'));
  });
});

describe('destroy', () => {
  it('unbinds the trigger', () => {
    menu?.destroy();
    trigger().click();
    expect(panel().hasAttribute('data-nav-open')).toBe(false);
  });

  it('unbinds the backdrop and panel', () => {
    menu?.destroy();
    backdrop().click();
    el('type').click();
    expect(panel().hasAttribute('data-nav-open')).toBe(false);
  });

  it('unbinds Escape', () => {
    menu?.destroy();
    const event = press('Escape');
    expect(event.defaultPrevented).toBe(false);
  });

  it('releases the scroll lock if it was open', () => {
    trigger().click();
    menu?.destroy();
    expect(document.body.style.overflow).toBe('');
  });
});
