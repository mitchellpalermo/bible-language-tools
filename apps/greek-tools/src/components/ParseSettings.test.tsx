import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParseSettings as ParseSettingsType } from '../lib/verb-parse';
import { DEFAULT_PARSE_SETTINGS } from '../lib/verb-parse';
import ParseSettings from './ParseSettings';

function renderSettings(
  settings: ParseSettingsType = DEFAULT_PARSE_SETTINGS,
  onChange = vi.fn(),
  onStart = vi.fn(),
) {
  return render(<ParseSettings settings={settings} onChange={onChange} onStart={onStart} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ParseSettings', () => {
  it('renders tense chip buttons', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: 'Present' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aorist' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imperfect' })).toBeInTheDocument();
  });

  it('renders voice chip buttons', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Middle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Passive' })).toBeInTheDocument();
  });

  it('renders mood chip buttons', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: 'Indicative' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subjunctive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imperative' })).toBeInTheDocument();
  });

  it('renders session length buttons', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30' })).toBeInTheDocument();
  });

  it('Start Parsing button is enabled when settings are valid', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: /start parsing/i })).not.toBeDisabled();
  });

  it('Start Parsing button is disabled when no tenses selected', () => {
    renderSettings({ ...DEFAULT_PARSE_SETTINGS, tenses: [] });
    expect(screen.getByRole('button', { name: /start parsing/i })).toBeDisabled();
    expect(screen.getByText(/select at least one tense/i)).toBeInTheDocument();
  });

  it('Start Parsing button is disabled when no voices selected', () => {
    renderSettings({ ...DEFAULT_PARSE_SETTINGS, voices: [] });
    expect(screen.getByRole('button', { name: /start parsing/i })).toBeDisabled();
  });

  it('calls onStart when Start Parsing is clicked', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    renderSettings(DEFAULT_PARSE_SETTINGS, vi.fn(), onStart);
    await user.click(screen.getByRole('button', { name: /start parsing/i }));
    expect(onStart).toHaveBeenCalled();
  });

  it('toggles a tense chip off and calls onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSettings(DEFAULT_PARSE_SETTINGS, onChange);
    await user.click(screen.getByRole('button', { name: 'Present' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tenses: expect.not.arrayContaining(['present']),
      }),
    );
  });

  it('toggles a tense chip on and calls onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSettings({ ...DEFAULT_PARSE_SETTINGS, tenses: [] }, onChange);
    await user.click(screen.getByRole('button', { name: 'Present' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tenses: expect.arrayContaining(['present']),
      }),
    );
  });

  it('toggles a voice chip and calls onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSettings(DEFAULT_PARSE_SETTINGS, onChange);
    await user.click(screen.getByRole('button', { name: 'Active' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        voices: expect.not.arrayContaining(['active']),
      }),
    );
  });

  it('changes session length and calls onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSettings(DEFAULT_PARSE_SETTINGS, onChange);
    await user.click(screen.getByRole('button', { name: '30' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sessionLength: 30 }));
  });

  it('"All" and "None" tense shortcuts work', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSettings({ ...DEFAULT_PARSE_SETTINGS, tenses: [] }, onChange);
    await user.click(screen.getByRole('button', { name: /^all$/i }));
    const call = onChange.mock.calls[0][0];
    expect(call.tenses.length).toBeGreaterThan(0);
  });

  it('"None" tense shortcut clears all tenses', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderSettings(DEFAULT_PARSE_SETTINGS, onChange);
    await user.click(screen.getByRole('button', { name: /^none$/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tenses: [] }));
  });
});
