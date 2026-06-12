import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParseAnswer, ParseItem } from '../lib/verb-parse';
import { emptyAnswer } from '../lib/verb-parse';
import ParseQuestion from './ParseQuestion';

const STUB_ITEM: ParseItem = {
  form: 'λύω',
  tense: 'present',
  voice: 'active',
  mood: 'indicative',
  person: '1st',
  number: 'singular',
  paradigmLabel: 'Present Active Indicative — λύω',
  lemma: 'λύω',
};

function renderQuestion(answer: ParseAnswer = emptyAnswer(), onChange = vi.fn(), onSubmit = vi.fn()) {
  return render(
    <ParseQuestion
      item={STUB_ITEM}
      index={0}
      total={10}
      answer={answer}
      onChange={onChange}
      onSubmit={onSubmit}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ParseQuestion', () => {
  it('renders the word form', () => {
    renderQuestion();
    expect(screen.getByText('λύω')).toBeInTheDocument();
  });

  it('shows progress counter', () => {
    render(
      <ParseQuestion
        item={STUB_ITEM}
        index={3}
        total={10}
        answer={emptyAnswer()}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('4 / 10')).toBeInTheDocument();
  });

  it('shows Tense, Voice, Mood, Person, Number selects', () => {
    renderQuestion();
    expect(screen.getByText('Tense')).toBeInTheDocument();
    expect(screen.getByText('Voice')).toBeInTheDocument();
    expect(screen.getByText('Mood')).toBeInTheDocument();
    expect(screen.getByText('Person')).toBeInTheDocument();
    expect(screen.getByText('Number')).toBeInTheDocument();
  });

  it('Submit button is disabled when answer is empty', () => {
    renderQuestion();
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
  });

  it('Submit button is enabled when all fields filled', () => {
    renderQuestion({
      tense: 'present',
      voice: 'active',
      mood: 'indicative',
      person: '1st',
      number: 'singular',
    });
    expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
  });

  it('calls onSubmit when Submit is clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderQuestion(
      { tense: 'present', voice: 'active', mood: 'indicative', person: '1st', number: 'singular' },
      vi.fn(),
      onSubmit,
    );
    await user.click(screen.getByRole('button', { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('calls onChange with cleared voice when tense changes to one with restricted voices', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    // 'middle' is valid for present but not for perfect (perfect only has active/mid-pass)
    renderQuestion({ tense: 'present', voice: 'middle', mood: '', person: '', number: '' }, onChange);
    const tenseSelect = screen.getByLabelText('Tense');
    await user.selectOptions(tenseSelect, 'perfect');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ tense: 'perfect', voice: '' }),
    );
  });

  it('calls onChange when voice changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderQuestion({ tense: 'present', voice: '', mood: '', person: '', number: '' }, onChange);
    const voiceSelect = screen.getByLabelText('Voice');
    await user.selectOptions(voiceSelect, 'active');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ voice: 'active' }));
  });
});
