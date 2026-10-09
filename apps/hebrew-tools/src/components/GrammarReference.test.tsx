import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import posthog from 'posthog-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { letters, vowels } from '../data/grammar';
import {
  allNouns,
  articleRules,
  independentPrepositions,
  inseparableRules,
  minRules,
  nounGroups,
} from '../data/grammar-nominal';
import { paradigmsFor } from '../data/verb-paradigms';
import GrammarReference, { NAV_SECTIONS } from './GrammarReference';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), init: vi.fn(), identify: vi.fn(), captureException: vi.fn() },
}));

const section = (name: string) => screen.getByRole('region', { name });

beforeEach(() => {
  vi.mocked(posthog.capture).mockClear();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('section navigation', () => {
  it('renders a region for every section the nav lists', () => {
    render(<GrammarReference />);
    for (const s of NAV_SECTIONS) {
      expect(section(s.label)).toHaveAttribute('id', s.id);
    }
  });

  it('offers every section in both the sidebar and the pill row', () => {
    render(<GrammarReference />);
    const navs = screen.getAllByRole('navigation', { name: 'Grammar sections' });
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      expect(
        within(nav)
          .getAllByRole('link')
          .map((a) => a.getAttribute('href')),
      ).toEqual(NAV_SECTIONS.map((s) => `#${s.id}`));
    }
  });

  it('scrolls to a section and marks it current in both navs', async () => {
    const user = userEvent.setup();
    render(<GrammarReference />);
    const [sidebar] = screen.getAllByRole('navigation', { name: 'Grammar sections' });

    await user.click(within(sidebar).getByRole('link', { name: 'Vowels' }));

    expect(document.getElementById('vowels')?.scrollIntoView).toHaveBeenCalled();
    expect(screen.getAllByRole('link', { name: 'Vowels', current: true })).toHaveLength(2);
    expect(screen.queryAllByRole('link', { name: 'Alphabet', current: true })).toHaveLength(0);
    expect(posthog.capture).toHaveBeenCalledWith('hebrew_grammar_section_viewed', {
      section: 'vowels',
    });
  });
});

describe('alphabet', () => {
  it('lists every letter by name', () => {
    render(<GrammarReference />);
    const table = within(section('Alphabet')).getAllByRole('table')[0];
    for (const letter of letters) {
      expect(within(table).getByRole('rowheader', { name: new RegExp(`^${letter.name}\\b`) }));
    }
  });

  it('shows a begadkephat letter with and without its dot, and both sounds', () => {
    render(<GrammarReference />);
    const row = within(section('Alphabet')).getByRole('rowheader', { name: /^bet/ }).closest('tr');
    if (!row) throw new Error('no row for bet');
    expect(within(row).getByText('בּ ב')).toBeInTheDocument();
    expect(within(row).getByText('b / v')).toBeInTheDocument();
    expect(within(row).getAllByText(/b as in boy; without the dot, v as in vine/)).not.toHaveLength(
      0,
    );
  });

  it('shows a final form only for the letters that have one', () => {
    render(<GrammarReference />);
    const alphabet = within(section('Alphabet'));
    const kaf = alphabet.getByRole('rowheader', { name: /^kaf/ }).closest('tr');
    const lamed = alphabet.getByRole('rowheader', { name: /^lamed/ }).closest('tr');
    if (!kaf || !lamed) throw new Error('missing row');
    expect(within(kaf).getByText('ך')).toBeInTheDocument();
    expect(within(lamed).getAllByRole('cell')[1]).toBeEmptyDOMElement();
  });

  it('explains the letter groups and both kinds of dagesh', () => {
    render(<GrammarReference />);
    const alphabet = within(section('Alphabet'));
    expect(alphabet.getByText('Gutturals')).toBeInTheDocument();
    expect(alphabet.getByText('א ה ח ע')).toBeInTheDocument();
    expect(alphabet.getByText('Dagesh lene')).toBeInTheDocument();
    expect(alphabet.getByText('Dagesh forte')).toBeInTheDocument();
  });

  it('sets Hebrew inside an English note apart as its own right-to-left run', () => {
    render(<GrammarReference />);
    const note = within(section('Alphabet')).getByText(/is not a guttural/);
    expect(within(note).getByText('ר')).toHaveAttribute('dir', 'rtl');
    // A run of letters stays one run, so the list reads in Hebrew order.
    expect(within(section('Alphabet')).getByText('ב ג ד כ פ ת')).toHaveAttribute('lang', 'he');
  });

  it('marks every Hebrew run right-to-left', () => {
    render(<GrammarReference />);
    const hebrew = document.querySelectorAll('[lang="he"]');
    expect(hebrew.length).toBeGreaterThan(letters.length);
    for (const el of hebrew) expect(el).toHaveAttribute('dir', 'rtl');
  });
});

describe('vowels', () => {
  it('puts every classed vowel in the chart', () => {
    render(<GrammarReference />);
    const chart = within(section('Vowels')).getByRole('table');
    for (const vowel of vowels.filter((v) => v.vowelClass)) {
      expect(within(chart).getByText(vowel.name), vowel.name).toBeInTheDocument();
    }
    expect(within(chart).queryByText('sheva')).not.toBeInTheDocument();
  });

  it('labels the rows by length and the columns by class', () => {
    render(<GrammarReference />);
    const chart = within(section('Vowels')).getByRole('table');
    expect(within(chart).getByRole('columnheader', { name: 'A-class' })).toBeInTheDocument();
    expect(within(chart).getByRole('rowheader', { name: 'Reduced' })).toBeInTheDocument();
  });

  it('says how to tell qamets hatuf from the qamets it is written like', () => {
    render(<GrammarReference />);
    expect(within(section('Vowels')).getByText(/Written exactly like qamets/)).toBeInTheDocument();
  });

  it('sets out when a sheva is vocal and when it is silent', () => {
    render(<GrammarReference />);
    const vowelSection = within(section('Vowels'));
    expect(vowelSection.getByText(/^Vocal/)).toBeInTheDocument();
    expect(vowelSection.getByText(/^Silent/)).toBeInTheDocument();
    expect(vowelSection.getByText(/At the end of a word/)).toBeInTheDocument();
  });
});

describe('nouns', () => {
  it('sets out the endings by number, gender and state', () => {
    render(<GrammarReference />);
    const endings = within(section('Nouns')).getAllByRole('table')[0];
    expect(within(endings).getAllByRole('columnheader')).toHaveLength(5);
    const plural = within(endings).getByRole('rowheader', { name: 'Plural' }).closest('tr');
    if (!plural) throw new Error('no plural row');
    // A bare ending sits on a dotted circle, never on nothing.
    expect(within(plural).getByText('\u25CCִים')).toBeInTheDocument();
    expect(within(plural).getAllByText('וֹת')).toHaveLength(2);
  });

  it('says "no ending" where the masculine singular has none', () => {
    render(<GrammarReference />);
    const endings = within(section('Nouns')).getAllByRole('table')[0];
    expect(within(endings).getAllByText('no ending')).toHaveLength(2);
  });

  it('gives every pattern a table with a row per noun', () => {
    render(<GrammarReference />);
    const nouns = within(section('Nouns'));
    // The endings table, then one per group.
    expect(nouns.getAllByRole('table')).toHaveLength(nounGroups.length + 1);
    for (const group of nounGroups) {
      expect(nouns.getByRole('heading', { name: group.title })).toBeInTheDocument();
    }
    for (const noun of allNouns) {
      expect(
        nouns.getByRole('rowheader', { name: new RegExp(`^${noun.gloss}`) }),
      ).toBeInTheDocument();
    }
  });

  it('shows a segolate with its stress mark and its plural construct', () => {
    render(<GrammarReference />);
    const row = within(section('Nouns')).getByRole('rowheader', { name: /^king/ }).closest('tr');
    if (!row) throw new Error('no row for king');
    expect(within(row).getAllByText('מֶ֫לֶךְ')).toHaveLength(2);
    expect(within(row).getByText('מַלְכֵי')).toBeInTheDocument();
  });

  it('gives the dual table dual columns', () => {
    render(<GrammarReference />);
    const tables = within(section('Nouns')).getAllByRole('table');
    const dual = tables[tables.length - 1];
    // Abbreviated on a phone, but always named in full for a screen reader.
    for (const name of ['singular absolute', 'dual absolute', 'dual construct']) {
      expect(within(dual).getByRole('columnheader', { name })).toBeInTheDocument();
    }
    expect(within(dual).queryByRole('columnheader', { name: /plural/ })).not.toBeInTheDocument();
    expect(within(dual).getAllByText('Du.')[0]).toHaveAttribute('aria-hidden', 'true');
    expect(within(dual).getByText('יָדַ֫יִם')).toBeInTheDocument();
  });
});

describe('the article', () => {
  it('lists every form of the article with what it is used before', () => {
    render(<GrammarReference />);
    const article = within(section('The Article'));
    for (const rule of articleRules) {
      // `when` may itself contain Hebrew, which Prose splits into runs.
      const lead = rule.when.split(/[\u0590-\u05FF]/)[0].trim();
      expect(article.getAllByText(new RegExp(`^${lead}`)).length, rule.id).toBeGreaterThan(0);
    }
    expect(article.getAllByText('הָאִישׁ').length).toBeGreaterThan(0);
  });

  it('shows the word an example starts from, and reads the arrow aloud', () => {
    render(<GrammarReference />);
    const article = within(section('The Article'));
    const example = article.getAllByText('הַמֶּלֶךְ')[0].parentElement;
    if (!example) throw new Error('no example');
    expect(within(example).getByText('מֶלֶךְ')).toBeInTheDocument();
    expect(within(example).getByText('becomes')).toBeInTheDocument();
    expect(within(example).getByText('the king')).toBeInTheDocument();
  });

  it('lists the nouns that change their own vowel', () => {
    render(<GrammarReference />);
    const article = within(section('The Article'));
    expect(article.getByText('הָאָרֶץ')).toBeInTheDocument();
    expect(article.getByText('הֶחָג')).toBeInTheDocument();
  });
});

describe('prepositions', () => {
  it('covers the inseparable prepositions, מִן, and the independent ones', () => {
    render(<GrammarReference />);
    const prepositions = within(section('Prepositions'));
    for (const rule of [...inseparableRules, ...minRules]) {
      for (const example of rule.examples) {
        expect(prepositions.getAllByText(example.hebrew).length, rule.id).toBeGreaterThan(0);
      }
    }
    for (const entry of independentPrepositions) {
      expect(prepositions.getAllByText(entry.gloss).length, entry.hebrew).toBeGreaterThan(0);
    }
  });

  it('omits the arrow for an example that has no starting word', () => {
    render(<GrammarReference />);
    const example = within(section('Prepositions')).getByText('בְּיוֹם').parentElement;
    if (!example) throw new Error('no example');
    expect(within(example).queryByText('becomes')).not.toBeInTheDocument();
  });

  it('sets a Hebrew card title apart from its English gloss', () => {
    render(<GrammarReference />);
    const heading = within(section('Prepositions')).getByRole('heading', { name: /from$/ });
    expect(within(heading).getByText('מִן')).toHaveAttribute('dir', 'rtl');
  });
});

describe('Qal verb', () => {
  const panel = () => within(screen.getByRole('tabpanel'));

  it('opens on the qatal, with a column per verb class', () => {
    render(<GrammarReference />);
    expect(screen.getByRole('tab', { name: 'Qatal (Perfect)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(panel().getAllByRole('columnheader')).toHaveLength(paradigmsFor('qatal').length + 1);
    expect(panel().getByRole('rowheader', { name: '3cp' })).toBeInTheDocument();
  });

  it('prints forms with the stress mark the quiz strips', () => {
    render(<GrammarReference />);
    expect(panel().getByText('קָטַ֫לְתָּ')).toBeInTheDocument();
  });

  it('switches conjugation, swapping the rows and the columns with it', async () => {
    const user = userEvent.setup();
    render(<GrammarReference />);

    await user.click(screen.getByRole('tab', { name: 'Wayyiqtol' }));

    expect(screen.getByRole('tab', { name: 'Wayyiqtol' })).toHaveAttribute('aria-selected', 'true');
    expect(panel().getAllByRole('columnheader')).toHaveLength(paradigmsFor('wayyiqtol').length + 1);
    expect(panel().queryByRole('rowheader', { name: '3cp' })).not.toBeInTheDocument();
    expect(panel().getByRole('rowheader', { name: '3fp' })).toBeInTheDocument();
    expect(panel().getByText('וַיִּ֫בֶן')).toBeInTheDocument();
    expect(posthog.capture).toHaveBeenCalledWith('hebrew_grammar_conjugation_viewed', {
      conjugation: 'wayyiqtol',
    });
  });

  it('describes a form when it is tapped, and forgets it on a new conjugation', async () => {
    const user = userEvent.setup();
    render(<GrammarReference />);
    expect(panel().getByText(/Tap or hover over a form/)).toBeInTheDocument();

    await user.click(panel().getByRole('button', { name: /^הָיִ֫יתִי/ }));

    expect(
      panel().getByText('Qal qatal 1cs — 1st common singular, from היה (be). Table 10.8.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Yiqtol (Imperfect)' }));
    expect(panel().getByText(/Tap or hover over a form/)).toBeInTheDocument();
  });

  it('describes a form on hover as well', async () => {
    const user = userEvent.setup();
    render(<GrammarReference />);

    await user.hover(panel().getByRole('button', { name: /^קָטְלוּ/ }));

    expect(panel().getByText(/Qal qatal 3cp — 3rd common plural, from קטל/)).toBeInTheDocument();
  });
});
