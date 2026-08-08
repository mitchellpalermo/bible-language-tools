// Behaviour for the mobile navigation drawer rendered by
// `components/SiteNav.astro`.
//
// Deliberately framework-free: the nav lives in Astro layouts, so hydrating a
// React island just to toggle a panel would be the expensive way to do this.
// It is plain DOM wiring against data attributes, which also makes it directly
// testable without a renderer.

/** Elements that can hold focus inside the panel. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface NavMenuHandle {
  isOpen(): boolean;
  open(): void;
  close(): void;
  /** Unbind every listener and release the body scroll lock. */
  destroy(): void;
}

/**
 * Wire up the drawer inside `root`.
 *
 * Returns `null` when the markup is not present — desktop-only renders and
 * unit tests of unrelated pages should not have to care.
 */
export function initNavMenu(root: ParentNode = document): NavMenuHandle | null {
  const foundTrigger = root.querySelector<HTMLElement>('[data-nav-trigger]');
  const foundPanel = root.querySelector<HTMLElement>('[data-nav-panel]');
  if (!foundTrigger || !foundPanel) return null;

  // Re-bound so the closures below see the non-null types; narrowing does not
  // survive into hoisted function declarations.
  const trigger: HTMLElement = foundTrigger;
  const panel: HTMLElement = foundPanel;
  const backdrop = root.querySelector<HTMLElement>('[data-nav-backdrop]');
  const doc = panel.ownerDocument;
  const body = doc.body;

  let open = false;
  let previousOverflow = '';

  function focusables(): HTMLElement[] {
    return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }

  function setOpen(next: boolean): void {
    if (next === open) return;
    open = next;

    trigger.setAttribute('aria-expanded', String(next));
    panel.toggleAttribute('data-nav-open', next);
    backdrop?.toggleAttribute('data-nav-open', next);

    if (next) {
      // Save whatever the page had set rather than assuming '' — a page that
      // locks scrolling for its own reasons should get its value back.
      previousOverflow = body.style.overflow;
      body.style.overflow = 'hidden';
      // The panel is `visibility: hidden` until the attribute above lands, and
      // a hidden element cannot take focus. Read a layout property to flush
      // the style change before moving focus into it.
      void panel.offsetWidth;
      focusables()[0]?.focus();
    } else {
      body.style.overflow = previousOverflow;
      trigger.focus();
    }
  }

  function onTriggerClick(): void {
    setOpen(!open);
  }

  function onBackdropClick(): void {
    setOpen(false);
  }

  /** Any link, or an explicit close button, dismisses the panel. */
  function onPanelClick(event: Event): void {
    const target = event.target as Element | null;
    if (!target?.closest) return;
    if (target.closest('a[href], [data-nav-close]')) setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!open) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key !== 'Tab') return;

    const items = focusables();
    if (items.length === 0) {
      event.preventDefault();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = doc.activeElement as HTMLElement | null;
    const inside = !!active && panel.contains(active);

    if (event.shiftKey) {
      if (!inside || active === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (!inside || active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  trigger.addEventListener('click', onTriggerClick);
  backdrop?.addEventListener('click', onBackdropClick);
  panel.addEventListener('click', onPanelClick);
  doc.addEventListener('keydown', onKeyDown);

  return {
    isOpen: () => open,
    open: () => setOpen(true),
    close: () => setOpen(false),
    destroy() {
      setOpen(false);
      trigger.removeEventListener('click', onTriggerClick);
      backdrop?.removeEventListener('click', onBackdropClick);
      panel.removeEventListener('click', onPanelClick);
      doc.removeEventListener('keydown', onKeyDown);
    },
  };
}
