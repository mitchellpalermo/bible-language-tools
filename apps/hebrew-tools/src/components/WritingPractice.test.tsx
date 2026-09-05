import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  type CompositeMask,
  type GlyphMask,
  maskFromAlpha,
  type WritableGlyph,
} from '@tools/shared/ink';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { daysFromNow, loadSRSStore, loadStats, newCard, saveSRSStore } from '../data/srs';
import { buildDecks, writingCardKey } from '../data/writing';
import WritingPractice from './WritingPractice';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn(), captureException: vi.fn() },
}));

// happy-dom has no canvas, so the real rasterizers always return null and the
// scoring path would never run. Only rasterization is faked: `scoreInk` runs
// for real against masks built by the real `maskFromAlpha`.
const scoring = vi.hoisted(() => ({
  mask: null as GlyphMask | null,
  composite: null as CompositeMask | null,
}));

vi.mock('@tools/shared/ink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tools/shared/ink')>();
  return {
    ...actual,
    loadGlyphMask: vi.fn(async () => scoring.mask),
    loadCompositeMask: vi.fn(async () => scoring.composite),
  };
});

const MASK_SOURCE = 64;

/** A horizontal or vertical bar in the source raster. */
function barAlpha(orientation: 'horizontal' | 'vertical', from = 8, to = 56): Uint8Array {
  const alpha = new Uint8Array(MASK_SOURCE * MASK_SOURCE);
  for (let y = 0; y < MASK_SOURCE; y++) {
    for (let x = 0; x < MASK_SOURCE; x++) {
      const along = orientation === 'horizontal' ? x : y;
      const across = orientation === 'horizontal' ? y : x;
      if (along >= from && along < to && across >= 30 && across < 34)
        alpha[y * MASK_SOURCE + x] = 255;
    }
  }
  return alpha;
}

/** A mask of a single bar, so `drawOn`'s horizontal stroke can hit or miss it. */
function barMask(orientation: 'horizontal' | 'vertical'): GlyphMask {
  return maskFromAlpha(barAlpha(orientation), MASK_SOURCE, MASK_SOURCE, { size: MASK_SOURCE });
}

/**
 * A bar, plus a slice of it nominated as the mark — both framed by the bar's
 * bounds, which is the contract `rasterizeComposite` satisfies for real.
 */
function barComposite(): CompositeMask {
  const bounds = { minX: 8, minY: 30, maxX: 55, maxY: 33 };
  const geometry = { size: MASK_SOURCE, bounds };
  return {
    whole: maskFromAlpha(barAlpha('horizontal'), MASK_SOURCE, MASK_SOURCE, geometry),
    mark: maskFromAlpha(barAlpha('horizontal', 20, 32), MASK_SOURCE, MASK_SOURCE, geometry),
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  scoring.mask = null;
  scoring.composite = null;
});

const DECKS = buildDecks();
const [ALPHABET, FINALS] = DECKS;
const deckById = (id: string) => DECKS.find((d) => d.id === id) as (typeof DECKS)[number];

/** Writing cards are keyed by glyph; letters and finals share a prefix. */
const letterKey = (char: string) =>
  writingCardKey({ char, name: char, group: 'consonant' } as WritableGlyph);

function canvas() {
  return screen.getByLabelText(/^Write the Hebrew letter/);
}

function vowelCanvas() {
  return screen.getByLabelText(/^Write the Hebrew vowel point/);
}

/** Lay down one stroke on the surface. */
function drawOn(el: Element) {
  const fire = (type: string, x: number) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, {
      pointerId: 1,
      pointerType: 'pen',
      clientX: x,
      clientY: 10,
      pressure: 0.5,
    });
    el.dispatchEvent(event);
  };
  fire('pointerdown', 10);
  fire('pointermove', 60);
  fire('pointerup', 110);
}

/** Reveal the reference, then grade the current letter. */
async function gradeCurrent(user: ReturnType<typeof userEvent.setup>, grade = 'Good') {
  await user.click(screen.getByRole('button', { name: 'Compare' }));
  await user.click(screen.getByRole('button', { name: grade }));
}

describe('deck and mode selection', () => {
  it('starts on the alphabet deck at alef, in trace mode', () => {
    render(<WritingPractice />);

    expect(screen.getByRole('button', { name: /The alphabet/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Trace' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('alef')).toBeInTheDocument();
    // The counter shares its element with the "new" tally, so match loosely.
    expect(screen.getByText(/1 \/ 23/)).toBeInTheDocument();
  });

  it('shows the letter itself only in copy mode', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    // Trace mode ghosts it onto the canvas instead of printing it.
    expect(screen.queryByText('א')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(screen.getByText('א')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Recall' }));
    expect(screen.queryByText('א')).not.toBeInTheDocument();
    expect(screen.getByText('alef')).toBeInTheDocument();
  });

  it('switches decks and restarts the session', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /Final forms/ }));
    expect(screen.getByText('kaf sofit')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`1 / ${FINALS.glyphs.length}`))).toBeInTheDocument();
  });

  it('offers every deck with its size', () => {
    render(<WritingPractice />);
    expect(screen.getByRole('button', { name: /Letters \+ finals/ })).toHaveTextContent('28');
    expect(ALPHABET.glyphs).toHaveLength(23);
  });
});

describe('the writing surface', () => {
  it('enables undo and clear only once there is ink', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    expect(screen.getByRole('button', { name: 'Undo stroke' })).toBeDisabled();

    drawOn(canvas());
    expect(await screen.findByRole('button', { name: 'Undo stroke' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('button', { name: 'Undo stroke' })).toBeDisabled();
  });

  it('reports that palm rejection has engaged once a stylus is used', async () => {
    render(<WritingPractice />);
    expect(screen.queryByText(/palm rejection on/)).not.toBeInTheDocument();

    drawOn(canvas());
    expect(await screen.findByText(/Stylus detected/)).toBeInTheDocument();
  });

  it('removes one stroke at a time with undo', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    drawOn(canvas());
    drawOn(canvas());
    await user.click(screen.getByRole('button', { name: 'Undo stroke' }));

    expect(screen.getByRole('button', { name: 'Undo stroke' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Undo stroke' }));
    expect(screen.getByRole('button', { name: 'Undo stroke' })).toBeDisabled();
  });
});

describe('grading', () => {
  it('hides the grade buttons until the student has compared', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    expect(screen.queryByRole('button', { name: 'Good' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.getByRole('button', { name: 'Good' })).toBeInTheDocument();
  });

  it('shows the discrimination note for a confusable letter', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    // alef has no note; bet does. Grade past alef to reach it.
    await gradeCurrent(user);
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.getByText(/The base extends left past the vertical/)).toBeInTheDocument();
  });

  it('writes a prefixed SRS card and advances', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await gradeCurrent(user);

    const store = loadSRSStore();
    expect(store[letterKey('א')]).toBeDefined();
    expect(store[letterKey('א')].repetition).toBe(1);
    // The bare lemma key belongs to vocabulary; writing must not touch it.
    expect(store['א']).toBeUndefined();

    expect(screen.getByText('bet')).toBeInTheDocument();
    expect(screen.getByText(/2 \/ 23/)).toBeInTheDocument();
  });

  it('counts a lapse without advancing the repetition count', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await gradeCurrent(user, 'Again');
    expect(loadSRSStore()[letterKey('א')].repetition).toBe(0);
  });

  it('records the review in the shared study stats', async () => {
    // Handwriting reviews feed the same streak as vocabulary reviews — that
    // shared store is what lets them sync with no schema change.
    const user = userEvent.setup();
    render(<WritingPractice />);

    await gradeCurrent(user);
    const stats = loadStats();
    expect(stats.totalReviewed).toBe(1);
    expect(stats.totalCorrect).toBe(1);
  });

  it('clears the ink between letters', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    drawOn(canvas());
    await gradeCurrent(user);

    expect(screen.getByRole('button', { name: 'Undo stroke' })).toBeDisabled();
  });
});

describe('scoring', () => {
  it('scores the attempt and suggests a grade', async () => {
    const user = userEvent.setup();
    scoring.mask = barMask('horizontal');
    render(<WritingPractice />);

    drawOn(canvas());
    await user.click(await screen.findByRole('button', { name: 'Compare' }));

    expect(await screen.findByText('100')).toBeInTheDocument();
    expect(screen.getByText('Good match')).toBeInTheDocument();
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Coverage')).toBeInTheDocument();
    expect(screen.getByText('Stray ink')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Easy \(suggested\)/ })).toBeInTheDocument();
  });

  it('suggests a lapse when the shape is wrong', async () => {
    const user = userEvent.setup();
    // The same horizontal stroke against a vertical bar.
    scoring.mask = barMask('vertical');
    render(<WritingPractice />);

    drawOn(canvas());
    await user.click(await screen.findByRole('button', { name: 'Compare' }));

    expect(await screen.findByText('Not there yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Again \(suggested\)/ })).toBeInTheDocument();
  });

  it('leaves every grade button live so the student can override', async () => {
    // The score reads shape occupancy, not letter identity — a ד drawn as a ר
    // scores well. The student is the only one who knows which happened.
    const user = userEvent.setup();
    scoring.mask = barMask('horizontal');
    render(<WritingPractice />);

    drawOn(canvas());
    await user.click(await screen.findByRole('button', { name: 'Compare' }));
    await user.click(await screen.findByRole('button', { name: 'Again' }));

    expect(loadSRSStore()[letterKey('א')].repetition).toBe(0);
  });

  it('does not score an untouched surface', async () => {
    const user = userEvent.setup();
    scoring.mask = barMask('horizontal');
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: 'Compare' }));

    expect(screen.queryByText('Accuracy')).not.toBeInTheDocument();
    expect(screen.getByText(/How close was it\?/)).toBeInTheDocument();
  });

  it('falls back to self-assessment when no mask is available', async () => {
    // No canvas, a blocked one, or a font that never resolved. Studying must
    // continue; only the score goes away.
    const user = userEvent.setup();
    scoring.mask = null;
    render(<WritingPractice />);

    drawOn(canvas());
    await user.click(await screen.findByRole('button', { name: 'Compare' }));

    expect(screen.getByText(/How close was it\?/)).toBeInTheDocument();
    expect(screen.queryByText('Accuracy')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled();
  });
});

describe('session end', () => {
  it('summarises the session after the last letter', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /Final forms/ }));
    for (let i = 0; i < FINALS.glyphs.length; i++) await gradeCurrent(user);

    expect(screen.getByText('Session complete')).toBeInTheDocument();
    expect(screen.getByText(/5 written well, 0 to revisit/)).toBeInTheDocument();
  });

  it('restarts on demand', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /Final forms/ }));
    for (let i = 0; i < FINALS.glyphs.length; i++) await gradeCurrent(user);
    await user.click(screen.getByRole('button', { name: 'Practice again' }));

    // Every card was just scheduled into the future, so nothing is due.
    expect(screen.getByText('Nothing due in this deck')).toBeInTheDocument();
  });

  it('says so when a deck is entirely scheduled for later', async () => {
    const user = userEvent.setup();
    saveSRSStore(
      Object.fromEntries(
        FINALS.glyphs.map((g) => {
          const key = writingCardKey(g);
          return [key, { ...newCard(key), dueDate: daysFromNow(5) }];
        }),
      ),
    );

    render(<WritingPractice />);
    // The alphabet is untouched and still due; the finals are not.
    expect(screen.getByText('alef')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Final forms/ }));
    expect(screen.getByText('Nothing due in this deck')).toBeInTheDocument();
  });
});

describe('the vowel deck', () => {
  it('drills a point on its host consonant', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /All vowel points/ }));

    expect(screen.getByText('patah')).toBeInTheDocument();
    // The surface asks for the pair, because the point alone is a stray tick.
    expect(vowelCanvas()).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 13/)).toBeInTheDocument();
  });

  it('shows the host consonant with the point in copy mode', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /All vowel points/ }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(screen.getByText('פַ')).toBeInTheDocument();
    expect(screen.getByText(/the פ as well as the point/)).toBeInTheDocument();
  });

  it('asks for the host from memory in recall mode', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /All vowel points/ }));
    await user.click(screen.getByRole('button', { name: 'Recall' }));

    expect(screen.queryByText('פַ')).not.toBeInTheDocument();
    expect(screen.getByText(/Write פ from memory/)).toBeInTheDocument();
  });

  it('keys vowel cards apart from letter cards', async () => {
    // Same store, different namespace. Reviewing patah must not touch a letter.
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /All vowel points/ }));
    await gradeCurrent(user);

    const store = loadSRSStore();
    expect(store['write:nikud:ַ']).toBeDefined();
    expect(store['write:letter:ַ']).toBeUndefined();
  });

  it('tells the student where the point goes once they have compared', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /All vowel points/ }));
    await user.click(screen.getByRole('button', { name: 'Compare' }));

    expect(screen.getByText(/A horizontal stroke centred beneath/)).toBeInTheDocument();
  });

  it('scores where the mark landed, not only the shape of the pair', async () => {
    // The vowel deck's reason for existing. `placement` is the fourth number,
    // and it only appears where there was a mark to place.
    const user = userEvent.setup();
    scoring.composite = barComposite();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /All vowel points/ }));
    drawOn(vowelCanvas());
    await user.click(await screen.findByRole('button', { name: 'Compare' }));

    expect(await screen.findByText('Placement')).toBeInTheDocument();
  });

  it('omits placement for a letter written whole', async () => {
    // Rendering 0% for a letter with no mark would read as failing something
    // that was never asked for.
    const user = userEvent.setup();
    scoring.mask = barMask('horizontal');
    render(<WritingPractice />);

    drawOn(canvas());
    await user.click(await screen.findByRole('button', { name: 'Compare' }));

    expect(await screen.findByText('Accuracy')).toBeInTheDocument();
    expect(screen.queryByText('Placement')).not.toBeInTheDocument();
  });

  it('falls back to self-assessment when the mark cannot be rasterized', async () => {
    const user = userEvent.setup();
    scoring.composite = null;
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /All vowel points/ }));
    drawOn(vowelCanvas());
    await user.click(await screen.findByRole('button', { name: 'Compare' }));

    expect(screen.getByText(/How close was it\?/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Good' })).toBeEnabled();
  });
});

describe('the confusable decks', () => {
  it('alternates the members of a pair rather than blocking them', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /dalet \/ resh/ }));
    expect(screen.getByText('dalet')).toBeInTheDocument();

    await gradeCurrent(user);
    expect(screen.getByText('resh')).toBeInTheDocument();

    await gradeCurrent(user);
    expect(screen.getByText('dalet')).toBeInTheDocument();
  });

  it('names the letter it is not, before the student writes', async () => {
    // The contrast has to be present at the moment of recall. Waiting for the
    // reveal teaches the letter and nothing about telling the two apart.
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /dalet \/ resh/ }));

    expect(screen.getByText('Not')).toBeInTheDocument();
    expect(screen.getByText('ר')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Good' })).not.toBeInTheDocument();
  });

  it('leaves the contrast off the ordinary letter decks', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    // bet is confusable with kaf, but the alphabet deck is not drilling that.
    await gradeCurrent(user);
    expect(screen.getByText('bet')).toBeInTheDocument();
    expect(screen.queryByText('Not')).not.toBeInTheDocument();
  });

  it('reviews the same card the alphabet deck does', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /dalet \/ resh/ }));
    await gradeCurrent(user);

    expect(loadSRSStore()[letterKey('ד')].repetition).toBe(1);
  });

  it('does not let a repeat within one session stretch the interval', async () => {
    // Three passing grades minutes apart are not three spaced repetitions, and
    // SM-2 has no way to know that on its own.
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /dalet \/ resh/ }));
    await gradeCurrent(user); // dalet
    await gradeCurrent(user); // resh
    await gradeCurrent(user); // dalet again

    expect(loadSRSStore()[letterKey('ד')].repetition).toBe(1);
  });

  it('still records a repeat lapse, which can only pull the schedule in', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /dalet \/ resh/ }));
    await gradeCurrent(user); // dalet, good
    await gradeCurrent(user); // resh, good
    await gradeCurrent(user, 'Again'); // dalet, lapsed

    expect(loadSRSStore()[letterKey('ד')].repetition).toBe(0);
  });

  it('counts every presentation toward the study streak', async () => {
    // The student did the review whether or not it moved the schedule.
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /dalet \/ resh/ }));
    await gradeCurrent(user);
    await gradeCurrent(user);
    await gradeCurrent(user);

    expect(loadStats().totalReviewed).toBe(3);
  });

  it('offers a combined deck that never repeats a letter', async () => {
    const user = userEvent.setup();
    render(<WritingPractice />);

    await user.click(screen.getByRole('button', { name: /All pairs/ }));
    expect(screen.getByText(/1 \/ 16/)).toBeInTheDocument();
    expect(deckById('confusable-all').glyphs).toHaveLength(16);
  });
});
