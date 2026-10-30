import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import posthog from 'posthog-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BARE_SUFFIXES, SUFFIX_PGNS } from '../data/pronominal-suffixes';
import { daysFromNow, loadSRSStore, loadStats, newCard, type SRSCard } from '../data/srs';
import { ATTEMPT_LOG_KEY } from '../lib/attempt-log';
import type { QuizCell } from '../lib/paradigm-quiz';
import { paradigmCardKey } from '../lib/paradigm-srs';
import { QUIZ_SETTINGS_KEY } from '../lib/quiz-settings';
import { LADDER_PROGRESS_KEY } from '../lib/suffix-ladder';
import ParadigmQuiz, { progressText, recitationOrder, scheduleNote } from './ParadigmQuiz';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn(), captureException: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(posthog.capture).mockClear();
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as typeof window.matchMedia;
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cell = (label: string) =>
  screen.getByRole('textbox', { name: `Answer for ${label}` }) as HTMLInputElement;

/** Type through the phonetic mapping, one keydown per key, as a laptop does. */
function typeKeys(input: HTMLInputElement, keys: string[]) {
  for (const key of keys) fireEvent.keyDown(input, { key });
}

const keypad = () => screen.getByRole('region', { name: 'Hebrew keypad' });

async function startTable(user: ReturnType<typeof userEvent.setup>, tab: string, card: RegExp) {
  render(<ParadigmQuiz />);
  await user.click(screen.getByRole('tab', { name: tab }));
  await user.click(screen.getByRole('button', { name: card }));
  await user.click(screen.getByRole('button', { name: 'Start' }));
}

// ─── Select phase ─────────────────────────────────────────────────────────────

describe('choosing a table', () => {
  it('lists the summary and every verb under each conjugation', async () => {
    const user = userEvent.setup();
    render(<ParadigmQuiz />);

    expect(screen.getByRole('tab', { name: 'Qal Qatal (Perfect)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('button', { name: /All classes side by side/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /begadkephat.*“write”/ })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Qal Wayyiqtol' }));
    // No begadkephat wayyiqtol is transcribed, so it is not offered.
    expect(screen.queryByRole('button', { name: /begadkephat/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /III-\s*ה.*“build”/ })).toBeInTheDocument();
  });

  it('offers the pronominal suffix tables, and a full round grades', async () => {
    const user = userEvent.setup();
    await startTable(user, 'Noun suffixes', /דָּבָר.*“word”/);

    expect(screen.getByText(/Every Type 2 suffix contains a yod/)).toBeInTheDocument();
    typeKeys(cell('3m Singular'), ['d', 'A', 'b', 'A', 'r', 'o']);
    await user.click(screen.getByRole('button', { name: 'Check answers' }));
    expect(posthog.capture).toHaveBeenCalled();
  });

  it('cannot start until a table is chosen, and choosing again deselects', async () => {
    const user = userEvent.setup();
    render(<ParadigmQuiz />);

    const start = screen.getByRole('button', { name: 'Choose a table to begin' });
    expect(start).toBeDisabled();

    const card = screen.getByRole('button', { name: /strong.*“kill”/ });
    await user.click(card);
    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();

    await user.click(card);
    expect(screen.getByRole('button', { name: 'Choose a table to begin' })).toBeDisabled();
  });

  it('starts on a full table and remembers the settings it is given', async () => {
    const user = userEvent.setup();
    render(<ParadigmQuiz />);

    expect(screen.getByRole('button', { name: /Full table/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: /Easy/ }));
    await user.click(screen.getByRole('switch', { name: 'Strict pointing' }));

    expect(JSON.parse(localStorage.getItem(QUIZ_SETTINGS_KEY) ?? '{}')).toEqual({
      accentStrict: true,
      density: 'easy',
    });
  });
});

// ─── Quiz phase ───────────────────────────────────────────────────────────────

describe('filling in a table', () => {
  it('blanks every form by default and starts at the 3ms', async () => {
    const user = userEvent.setup();
    await startTable(user, 'Qal Qatal (Perfect)', /strong.*“kill”/);

    expect(screen.getAllByRole('textbox')).toHaveLength(9);
    expect(screen.getByText(/Full table — 9 blanks/)).toBeInTheDocument();
    expect(cell('3m Singular')).toHaveFocus();
    expect(posthog.capture).toHaveBeenCalledWith('hebrew_paradigm_quiz_started', {
      table: 'qal-qatal-strong',
      mode: 'hard',
    });
  });

  it('blanks a quarter of the table on easy and shows the rest', async () => {
    const user = userEvent.setup();
    render(<ParadigmQuiz />);
    await user.click(screen.getByRole('button', { name: /Easy/ }));
    await user.click(screen.getByRole('button', { name: /strong.*“kill”/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.getByText(/Easy — 2 blanks/)).toBeInTheDocument();
  });

  it('types through the phonetic mapping and shows final forms', async () => {
    const user = userEvent.setup();
    await startTable(user, 'Qal Qatal (Perfect)', /strong.*“kill”/);

    typeKeys(cell('2m Plural'), ['q', ':', 't', 'a', 'l', ':', 'T', '.', 'e', 'm']);

    expect(cell('2m Plural').value.normalize('NFC')).toBe('קְטַלְתֶּם');
  });

  it('moves down the column on Enter, the order a paradigm is recited in', async () => {
    const user = userEvent.setup();
    await startTable(user, 'Qal Qatal (Perfect)', /strong.*“kill”/);

    fireEvent.keyDown(cell('3m Singular'), { key: 'Enter' });
    // The 3f row, not the 3cp beside the 3ms.
    expect(cell('3f Singular')).toHaveFocus();

    // Off the bottom of the singular column, into the plural.
    cell('1c Singular').focus();
    fireEvent.keyDown(cell('1c Singular'), { key: 'Enter' });
    expect(cell('3m Plural')).toHaveFocus();
  });

  it('notes where the qatal puts its one third-person plural', async () => {
    const user = userEvent.setup();
    await startTable(user, 'Qal Qatal (Perfect)', /strong.*“kill”/);

    expect(screen.getByText(/the 3cp, written on the 3m row/)).toBeInTheDocument();
    expect(screen.getByText('no form')).toBeInTheDocument();
  });

  it('shows the answers only while Peek is held, and keeps what was typed', async () => {
    const user = userEvent.setup();
    await startTable(user, 'Qal Qatal (Perfect)', /strong.*“kill”/);
    typeKeys(cell('3m Singular'), ['q', 'A']);

    const peek = screen.getByRole('button', { name: 'Hold to peek' });
    fireEvent.pointerDown(peek);
    expect(cell('3m Singular').value).toBe('קָטַל');
    expect(cell('3m Singular')).toHaveAttribute('readonly');
    expect(cell('3m Singular')).toHaveFocus();

    fireEvent.pointerUp(peek);
    expect(cell('3m Singular').value.normalize('NFC')).toBe('קָ');
    expect(cell('3m Singular')).not.toHaveAttribute('readonly');
  });

  it('peeks from the keyboard too', async () => {
    const user = userEvent.setup();
    await startTable(user, 'Qal Qatal (Perfect)', /strong.*“kill”/);

    const peek = screen.getByRole('button', { name: 'Hold to peek' });
    fireEvent.keyDown(peek, { key: ' ' });
    expect(cell('3f Singular').value).toBe('קָטְלָה');
    fireEvent.keyUp(peek, { key: ' ' });
    expect(cell('3f Singular').value).toBe('');
  });

  it('heads a summary table with each class and its root', async () => {
    const user = userEvent.setup();
    await startTable(user, 'Qal Yiqtol (Imperfect)', /All classes side by side/);

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual([
      'Person, gender, number',
      'Strong (קטל)',
      'Begadkephat (כתב)',
      'III-ה (בנה)',
    ]);
    expect(screen.getAllByRole('textbox')).toHaveLength(30);
  });
});

// ─── The keypad ───────────────────────────────────────────────────────────────

describe('the on-screen keypad', () => {
  it('opens by default on a touch screen and keeps the system keyboard down', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as typeof window.matchMedia;
    const user = userEvent.setup();
    await startTable(user, 'Qal Qatal (Perfect)', /strong.*“kill”/);

    expect(keypad()).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Keypad' })).toHaveAttribute('aria-checked', 'true');
    for (const field of screen.getAllByRole('textbox')) {
      expect(field).toHaveAttribute('inputmode', 'none');
    }
  });

  it('is closed on a laptop, where the fields take the system keyboard', async () => {
    const user = userEvent.setup();
    await startTable(user, 'Qal Qatal (Perfect)', /strong.*“kill”/);

    expect(screen.queryByRole('region', { name: 'Hebrew keypad' })).not.toBeInTheDocument();
    expect(cell('3m Singular')).toHaveAttribute('inputmode', 'text');
    expect(screen.getByRole('link', { name: 'phonetic mapping' })).toHaveAttribute(
      'href',
      '/keyboard',
    );
  });

  it('types into the focused cell without taking focus from it', async () => {
    const user = userEvent.setup();
    await startTable(user, 'Qal Qatal (Perfect)', /strong.*“kill”/);
    await user.click(screen.getByRole('switch', { name: 'Keypad' }));

    await user.click(cell('2f Singular'));
    const keys = within(keypad());
    for (const name of [
      'qof',
      'qamets',
      'tet',
      'patah',
      'lamed',
      'sheva',
      'tav',
      'dagesh',
      'sheva',
    ]) {
      await user.click(keys.getByRole('button', { name }));
    }

    expect(cell('2f Singular').value.normalize('NFC')).toBe('קָטַלְתְּ');
    expect(cell('2f Singular')).toHaveFocus();

    await user.click(keys.getByRole('button', { name: 'Backspace' }));
    expect(cell('2f Singular').value.normalize('NFC')).toBe('קָטַלְתּ');
  });

  it('types into the first blank when no cell has been chosen', async () => {
    const user = userEvent.setup();
    await startTable(user, 'Qal Qatal (Perfect)', /strong.*“kill”/);
    await user.click(screen.getByRole('switch', { name: 'Keypad' }));
    // Blur everything: the keypad still has somewhere to type.
    (document.activeElement as HTMLElement).blur();

    await user.click(within(keypad()).getByRole('button', { name: 'shureq' }));
    expect(cell('3m Singular').value).toBe('וּ');
  });

  it('moves down the column with Next', async () => {
    const user = userEvent.setup();
    await startTable(user, 'Qal Qatal (Perfect)', /strong.*“kill”/);
    await user.click(screen.getByRole('switch', { name: 'Keypad' }));
    await user.click(cell('3m Singular'));

    await user.click(within(keypad()).getByRole('button', { name: 'Next blank' }));
    expect(cell('3f Singular')).toHaveFocus();
  });
});

// ─── Results ──────────────────────────────────────────────────────────────────

describe('checking answers', () => {
  /** כתב qatal: the 3ms right, the 3fs without its dagesh, the 2ms on the wrong root. */
  async function answerBegadkephat(user: ReturnType<typeof userEvent.setup>) {
    await startTable(user, 'Qal Qatal (Perfect)', /begadkephat.*“write”/);
    typeKeys(cell('3m Singular'), ['k', '.', 'A', 'T', 'a', 'b']);
    typeKeys(cell('3f Singular'), ['k', 'A', 'T', ':', 'b', 'A', 'h']);
    typeKeys(cell('2m Singular'), ['q', 'A', 't', 'a', 'l', ':', 'T', '.', 'A']);
    await user.click(screen.getByRole('button', { name: 'Check answers' }));
  }

  it('forgives pointing by default but still marks it on the cell', async () => {
    const user = userEvent.setup();
    await answerBegadkephat(user);

    expect(screen.getByText('2/9')).toBeInTheDocument();
    expect(screen.getByText('1 pointing slip (not counted)')).toBeInTheDocument();
    expect(screen.getByText('dagesh · not counted')).toBeInTheDocument();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(posthog.capture).toHaveBeenCalledWith('hebrew_paradigm_quiz_submitted', {
      table: 'qal-qatal-begadkephat',
      correct: 2,
      total: 9,
      strict: false,
      peeked: false,
    });
  });

  it('counts a missing dagesh against you under strict pointing', async () => {
    const user = userEvent.setup();
    await answerBegadkephat(user);

    await user.click(screen.getByRole('switch', { name: 'Strict pointing' }));

    expect(screen.getByText('1/9')).toBeInTheDocument();
    expect(screen.getByText('1 pointing slip')).toBeInTheDocument();
    expect(screen.getByText('dagesh')).toBeInTheDocument();
  });

  it('shows what was written beside the right form', async () => {
    const user = userEvent.setup();
    await answerBegadkephat(user);

    // The wrong root, struck through, over the form it should have been.
    const wrong = screen.getByText('כָּתַבְתָּ').closest('div');
    expect(wrong?.textContent?.normalize('NFC')).toContain('קָטַלְתָּ');
  });

  it('says so when every form is exactly right', async () => {
    const user = userEvent.setup();
    render(<ParadigmQuiz />);
    await user.click(screen.getByRole('button', { name: /Easy/ }));
    await user.click(screen.getByRole('button', { name: /strong.*“kill”/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    // Fill whichever two cells were blanked by peeking at their answers.
    const peek = screen.getByRole('button', { name: 'Hold to peek' });
    fireEvent.pointerDown(peek);
    const answers = screen.getAllByRole('textbox').map((f) => (f as HTMLInputElement).value);
    fireEvent.pointerUp(peek);
    screen.getAllByRole('textbox').forEach((field, i) => {
      fireEvent.change(field, { target: { value: answers[i] } });
    });
    await user.click(screen.getByRole('button', { name: 'Check answers' }));

    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getByText('Every form exactly right.')).toBeInTheDocument();
  });

  it('starts the same table over, or goes back to choose another', async () => {
    const user = userEvent.setup();
    await answerBegadkephat(user);

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(9);
    expect(cell('3m Singular').value).toBe('');

    await user.click(screen.getByRole('button', { name: '← Choose another table' }));
    expect(screen.getByRole('button', { name: 'Choose a table to begin' })).toBeInTheDocument();
  });
});

// ─── Recitation order ─────────────────────────────────────────────────────────

describe('recitationOrder', () => {
  const at = (rowIndex: number, colIndex: number, isBlank = true): QuizCell => ({
    index: rowIndex * 2 + colIndex,
    rowIndex,
    colIndex,
    answer: 'x',
    isBlank,
  });

  it('runs down each column in turn and skips the given cells', () => {
    const cells = [at(0, 0), at(0, 1), at(1, 0, false), at(1, 1), at(2, 0)];

    expect(recitationOrder(cells).map((c) => [c.rowIndex, c.colIndex])).toEqual([
      [0, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ]);
  });
});

// ─── The review schedule ──────────────────────────────────────────────────────

const SRS_KEY = 'hebrew-tools-srs-v1';

/** Seed the store: every כתב qatal form answered before, the given PGNs due today. */
function seedBegadkephat(...duePgns: string[]) {
  const store: Record<string, SRSCard> = {};
  for (const pgn of ['3ms', '3fs', '2ms', '2fs', '1cs', '3cp', '2mp', '2fp', '1cp']) {
    const key = paradigmCardKey(`qal-qatal-begadkephat:${pgn}`);
    store[key] = {
      ...newCard(key),
      interval: 4,
      repetition: 2,
      lastReviewed: daysFromNow(-4),
      dueDate: daysFromNow(duePgns.includes(pgn) ? 0 : 4),
    };
  }
  localStorage.setItem(SRS_KEY, JSON.stringify(store));
}

describe('the review schedule', () => {
  it('saves a card per checked form, keyed by its cell', async () => {
    const user = userEvent.setup();
    await startTable(user, 'Qal Qatal (Perfect)', /strong.*“kill”/);
    typeKeys(cell('3m Singular'), ['q', 'A', 't', 'a', 'l']);
    await user.click(screen.getByRole('button', { name: 'Check answers' }));

    const store = loadSRSStore();
    expect(Object.keys(store)).toHaveLength(9);
    expect(store[paradigmCardKey('qal-qatal-strong:3ms')].repetition).toBe(1);
    expect(store[paradigmCardKey('qal-qatal-strong:3fs')].repetition).toBe(0);
    expect(loadStats().totalReviewed).toBe(9);
    expect(
      screen.getByText('Saved to your review schedule: 9 forms come back tomorrow.'),
    ).toBeInTheDocument();
  });

  it('shows on each table what is due and what is new', async () => {
    seedBegadkephat('3ms', '2fs');
    render(<ParadigmQuiz />);

    expect(
      screen.getByRole('button', { name: /begadkephat.*9 forms · 2 due/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /strong.*9 forms · not started/ }),
    ).toBeInTheDocument();
    // The summary shares כתב's forms with its own table.
    expect(
      screen.getByRole('button', { name: /side by side.*27 forms · 2 due · 18 new/ }),
    ).toBeInTheDocument();
  });

  it('blanks only the due forms in Due forms mode', async () => {
    seedBegadkephat('3ms', '2fs');
    const user = userEvent.setup();
    render(<ParadigmQuiz />);
    await user.click(screen.getByRole('button', { name: /Due forms/ }));
    await user.click(screen.getByRole('button', { name: /begadkephat/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(cell('3m Singular')).toBeInTheDocument();
    expect(cell('2f Singular')).toBeInTheDocument();
    expect(screen.getByText(/Due forms — 2 blanks/)).toBeInTheDocument();
  });

  it('will not start Due forms on a table with nothing due', async () => {
    seedBegadkephat();
    const user = userEvent.setup();
    render(<ParadigmQuiz />);
    await user.click(screen.getByRole('button', { name: /Due forms/ }));
    await user.click(screen.getByRole('button', { name: /begadkephat/ }));

    expect(screen.getByRole('button', { name: 'Nothing due in this table' })).toBeDisabled();
  });

  it('records no promotion after a peek, and says so', async () => {
    const user = userEvent.setup();
    await startTable(user, 'Qal Qatal (Perfect)', /strong.*“kill”/);
    const peek = screen.getByRole('button', { name: 'Hold to peek' });
    fireEvent.pointerDown(peek);
    fireEvent.pointerUp(peek);
    typeKeys(cell('3m Singular'), ['q', 'A', 't', 'a', 'l']);
    await user.click(screen.getByRole('button', { name: 'Check answers' }));

    const store = loadSRSStore();
    expect(store[paradigmCardKey('qal-qatal-strong:3ms')]).toBeUndefined();
    expect(store[paradigmCardKey('qal-qatal-strong:3fs')].repetition).toBe(0);
    expect(screen.getByText(/You peeked/)).toBeInTheDocument();
    expect(posthog.capture).toHaveBeenCalledWith(
      'hebrew_paradigm_quiz_submitted',
      expect.objectContaining({ peeked: true }),
    );
  });

  it('does not promote the same form twice in a day', async () => {
    const user = userEvent.setup();
    await startTable(user, 'Qal Qatal (Perfect)', /strong.*“kill”/);
    typeKeys(cell('3m Singular'), ['q', 'A', 't', 'a', 'l']);
    await user.click(screen.getByRole('button', { name: 'Check answers' }));
    const first = loadSRSStore()[paradigmCardKey('qal-qatal-strong:3ms')];

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    typeKeys(cell('3m Singular'), ['q', 'A', 't', 'a', 'l']);
    await user.click(screen.getByRole('button', { name: 'Check answers' }));

    expect(loadSRSStore()[paradigmCardKey('qal-qatal-strong:3ms')]).toEqual(first);
  });
});

describe('progressText', () => {
  it('names what is true about a table', () => {
    expect(progressText({ total: 9, fresh: 9, due: 0 })).toBe('9 forms · not started');
    expect(progressText({ total: 9, fresh: 3, due: 2 })).toBe('9 forms · 2 due · 3 new');
    expect(progressText({ total: 9, fresh: 0, due: 0 })).toBe('9 forms · nothing due');
    expect(progressText({ total: 9, fresh: 2, due: 0 })).toBe('9 forms · 2 new');
  });
});

describe('scheduleNote', () => {
  const card = (interval: number) => ({ ...newCard('k'), interval });

  it('says when forms come back', () => {
    expect(scheduleNote([card(1), card(4), card(6)], false)).toBe(
      'Saved to your review schedule: 1 form comes back tomorrow, 2 forms later.',
    );
    expect(scheduleNote([card(4)], false)).toBe('Saved to your review schedule: 1 form later.');
  });

  it('explains an attempt that moved nothing', () => {
    expect(scheduleNote([], false)).toMatch(/already reviewed these forms today/);
  });
});

// ─── The suffix ladder (#186) ─────────────────────────────────────────────────

describe('the suffix ladder', () => {
  /** Rung 1's answers in DOM order: a row per PGN, Type 1 then Type 2. */
  const rungOneAnswers = SUFFIX_PGNS.flatMap((pgn) => [
    BARE_SUFFIXES.type1[pgn],
    BARE_SUFFIXES.type2[pgn],
  ]);

  async function openLadder(user: ReturnType<typeof userEvent.setup>) {
    render(<ParadigmQuiz />);
    await user.click(screen.getByRole('tab', { name: 'Suffix ladder' }));
  }

  it('shows every rung, with only the first open and the rest saying what opens them', async () => {
    const user = userEvent.setup();
    await openLadder(user);

    const rungs = within(screen.getByRole('list', { name: 'Ladder rungs' })).getAllByRole(
      'listitem',
    );
    expect(rungs).toHaveLength(8);
    expect(rungs.filter((r) => r.dataset.locked)).toHaveLength(7);
    expect(within(rungs[1]).getByText(/2 clean writes of rung 1 \(0 of 2/)).toBeInTheDocument();
    expect(within(rungs[0]).getByText('20 forms · not started')).toBeInTheDocument();
  });

  it('opens a locked rung anyway, in any mode', async () => {
    const user = userEvent.setup();
    await openLadder(user);

    const segholate = screen.getByRole('listitem', { name: 'Rung 5, locked' });
    await user.click(within(segholate).getByRole('button', { name: 'Open anyway' }));
    await user.click(screen.getByRole('button', { name: /Easy/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.getByRole('heading', { name: /Rung 5 — מֶלֶךְ and מְלָכִים/ })).toBeInTheDocument();
    expect(screen.getByText(/older one-syllable stem/)).toBeInTheDocument();
    // A quarter of twenty forms.
    expect(screen.getAllByRole('textbox')).toHaveLength(5);
  });

  it('opens rung 2 after a second clean write of rung 1, and logs every answer', async () => {
    localStorage.setItem(LADDER_PROGRESS_KEY, JSON.stringify({ suffixes: 1 }));
    const user = userEvent.setup();
    await openLadder(user);
    await user.click(screen.getByRole('button', { name: /The suffixes alone/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    screen.getAllByRole('textbox').forEach((field, i) => {
      fireEvent.change(field, { target: { value: rungOneAnswers[i] } });
    });
    await user.click(screen.getByRole('button', { name: 'Check answers' }));

    expect(screen.getByText('20/20')).toBeInTheDocument();
    expect(screen.getByText('Clean write. Rung 2 is open.')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(LADDER_PROGRESS_KEY) ?? '')).toEqual({ suffixes: 2 });
    // A bare suffix is shown on a dotted circle.
    expect(screen.getAllByText('◌ִי').length).toBeGreaterThan(0);

    const log = JSON.parse(localStorage.getItem(ATTEMPT_LOG_KEY) ?? '[]');
    expect(log).toHaveLength(20);
    expect(log[0]).toMatchObject({ concept: 'paradigm/suffix-bare-type1:1cs', correct: true });

    await user.click(screen.getByRole('button', { name: 'Another table' }));
    await user.click(screen.getByRole('tab', { name: 'Suffix ladder' }));
    expect(screen.getByRole('button', { name: /סוּס and סוּסִים/ })).toBeInTheDocument();
  });

  it('says a partial table does not count, and leaves the ladder alone', async () => {
    const user = userEvent.setup();
    await openLadder(user);
    await user.click(screen.getByRole('button', { name: /The suffixes alone/ }));
    await user.click(screen.getByRole('button', { name: /Medium/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('button', { name: 'Check answers' }));

    expect(
      screen.getByText('Only a Full table write counts toward the next rung.'),
    ).toBeInTheDocument();
    expect(localStorage.getItem(LADDER_PROGRESS_KEY)).toBeNull();
  });

  it('logs nothing from an attempt with a peek', async () => {
    const user = userEvent.setup();
    await openLadder(user);
    await user.click(screen.getByRole('button', { name: /The suffixes alone/ }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    const peek = screen.getByRole('button', { name: 'Hold to peek' });
    fireEvent.pointerDown(peek);
    fireEvent.pointerUp(peek);
    await user.click(screen.getByRole('button', { name: 'Check answers' }));

    expect(screen.getByText(/You peeked, so this write does not count/)).toBeInTheDocument();
    expect(localStorage.getItem(ATTEMPT_LOG_KEY)).toBeNull();
  });
});
