import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GNTFiniteItem, GNTInfinitiveItem, GNTParticipleItem } from '../lib/gnt-parse';
import { emptyGNTAnswer } from '../lib/gnt-parse';
import GNTParseQuestion from './GNTParseQuestion';

vi.mock('../data/morphgnt', () => ({
  splitWordPunct: vi.fn((text: string) => [text, '']),
}));

const STUB_VERSE_WORDS = [
  { text: 'ὁ', lemma: 'ὁ', pos: 'RA', parsing: '--------' },
  { text: 'κόσμον', lemma: 'κόσμος', pos: 'N-', parsing: '--------' },
  { text: 'λόγος', lemma: 'λόγος', pos: 'N-', parsing: '--------' },
];

const FINITE_ITEM: GNTFiniteItem = {
  type: 'finite',
  form: 'λύει',
  lemma: 'λύω',
  verseRef: 'John 1:1',
  verseWords: STUB_VERSE_WORDS,
  wordIndex: 1,
  tense: 'present',
  voice: 'active',
  mood: 'indicative',
  person: '3rd',
  number: 'singular',
};

const INFINITIVE_ITEM: GNTInfinitiveItem = {
  type: 'infinitive',
  form: 'λύειν',
  lemma: 'λύω',
  verseRef: 'John 1:2',
  verseWords: STUB_VERSE_WORDS,
  wordIndex: 1,
  tense: 'present',
  voice: 'active',
  mood: 'infinitive',
};

const PARTICIPLE_ITEM: GNTParticipleItem = {
  type: 'participle',
  form: 'λύσας',
  lemma: 'λύω',
  verseRef: 'John 1:3',
  verseWords: STUB_VERSE_WORDS,
  wordIndex: 1,
  tense: 'aorist',
  voice: 'active',
  mood: 'participle',
  parseCase: 'nominative',
  number: 'singular',
  gender: 'masculine',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GNTParseQuestion', () => {
  describe('finite verb', () => {
    it('renders the word form', () => {
      render(
        <GNTParseQuestion
          item={FINITE_ITEM}
          index={0}
          total={5}
          answer={emptyGNTAnswer()}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );
      expect(screen.getByText('λύει')).toBeInTheDocument();
    });

    it('shows progress counter', () => {
      render(
        <GNTParseQuestion
          item={FINITE_ITEM}
          index={2}
          total={10}
          answer={emptyGNTAnswer()}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );
      expect(screen.getByText('3 / 10')).toBeInTheDocument();
    });

    it('shows verse reference', () => {
      render(
        <GNTParseQuestion
          item={FINITE_ITEM}
          index={0}
          total={5}
          answer={emptyGNTAnswer()}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );
      expect(screen.getByText('John 1:1')).toBeInTheDocument();
    });

    it('Submit button is disabled when no tense/voice/mood selected', () => {
      render(
        <GNTParseQuestion
          item={FINITE_ITEM}
          index={0}
          total={5}
          answer={emptyGNTAnswer()}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );
      expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
    });

    it('shows Person and Number selects for finite verb', () => {
      render(
        <GNTParseQuestion
          item={FINITE_ITEM}
          index={0}
          total={5}
          answer={{ ...emptyGNTAnswer(), tense: 'present', voice: 'active', mood: 'indicative' }}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );
      expect(screen.getByText('Person')).toBeInTheDocument();
      expect(screen.getByText('Number')).toBeInTheDocument();
    });

    it('Submit is enabled when all required fields are filled for finite verb', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onSubmit = vi.fn();
      const { rerender } = render(
        <GNTParseQuestion
          item={FINITE_ITEM}
          index={0}
          total={5}
          answer={emptyGNTAnswer()}
          onChange={onChange}
          onSubmit={onSubmit}
        />,
      );

      const fullAnswer = {
        tense: 'present' as const,
        voice: 'active' as const,
        mood: 'indicative' as const,
        person: '3rd' as const,
        number: 'singular' as const,
        parseCase: '' as const,
        gender: '' as const,
      };
      rerender(
        <GNTParseQuestion
          item={FINITE_ITEM}
          index={0}
          total={5}
          answer={fullAnswer}
          onChange={onChange}
          onSubmit={onSubmit}
        />,
      );
      const submitBtn = screen.getByRole('button', { name: /submit/i });
      expect(submitBtn).not.toBeDisabled();
      await user.click(submitBtn);
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  describe('infinitive', () => {
    it('Submit is enabled with tense+voice+mood only for infinitive', () => {
      render(
        <GNTParseQuestion
          item={INFINITIVE_ITEM}
          index={0}
          total={3}
          answer={{
            tense: 'present',
            voice: 'active',
            mood: 'infinitive',
            person: '',
            number: '',
            parseCase: '',
            gender: '',
          }}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );
      expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
    });

    it('does not show Person/Number for infinitive', () => {
      render(
        <GNTParseQuestion
          item={INFINITIVE_ITEM}
          index={0}
          total={3}
          answer={{
            tense: 'present',
            voice: 'active',
            mood: 'infinitive',
            person: '',
            number: '',
            parseCase: '',
            gender: '',
          }}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );
      expect(screen.queryByText('Person')).not.toBeInTheDocument();
    });
  });

  describe('participle', () => {
    it('shows Case, Number, and Gender selects for participle', () => {
      render(
        <GNTParseQuestion
          item={PARTICIPLE_ITEM}
          index={0}
          total={3}
          answer={{ ...emptyGNTAnswer(), tense: 'aorist', voice: 'active', mood: 'participle' }}
          onChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );
      expect(screen.getByText('Case')).toBeInTheDocument();
      expect(screen.getByText('Gender')).toBeInTheDocument();
    });

    it('clearing mood resets conditional fields', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <GNTParseQuestion
          item={FINITE_ITEM}
          index={0}
          total={5}
          answer={{ ...emptyGNTAnswer(), tense: 'present', voice: 'active', mood: 'indicative', person: '3rd', number: 'singular' }}
          onChange={onChange}
          onSubmit={vi.fn()}
        />,
      );
      const moodSelect = screen.getByLabelText('Mood');
      await user.selectOptions(moodSelect, 'infinitive');
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ mood: 'infinitive', person: '', number: '' }),
      );
    });
  });
});
