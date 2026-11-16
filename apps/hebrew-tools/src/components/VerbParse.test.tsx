import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import posthog from 'posthog-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMorphhbCache } from '../data/morphhb';
import { clearParseFormsCache, type ParseFormsFile } from '../data/parse-forms';
import { loadAttempts } from '../lib/attempt-log';
import { loadParseSettings, saveParseSettings } from '../lib/parse-settings';
import VerbParse from './VerbParse';

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn(), captureException: vi.fn() },
}));

const FORMS: ParseFormsFile = {
  lemmas: { 559: ['אָמַר', 'אמר'], 3427: ['יָשַׁב', 'ישׁב'] },
  forms: [
    ['וַיֹּאמֶר', [['559', 'C/Vqw3ms', 1945]]],
    ['יֹשֵׁב', [['3427', 'Vqrmsa', 30]]],
    ['הוֹשִׁיב', [['3427', 'Vhp3ms', 5]]],
  ],
};

const GLOSSES = { 559: { g: ['say'] }, 3427: { g: ['sit', 'dwell'] } };

let formsResponse: () => Promise<Response>;

beforeEach(() => {
  localStorage.clear();
  clearParseFormsCache();
  clearMorphhbCache();
  vi.mocked(posthog.capture).mockClear();
  formsResponse = async () => new Response(JSON.stringify(FORMS));
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      url.endsWith('parse-forms.json')
        ? formsResponse()
        : Promise.resolve(new Response(JSON.stringify(GLOSSES))),
    ),
  );
});

afterEach(() => vi.unstubAllGlobals());

const start = async (user: ReturnType<typeof userEvent.setup>) => {
  const button = screen.getByRole('button', { name: 'Start Parsing' });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
};

describe('VerbParse — settings', () => {
  it('starts on Qal qatal, yiqtol and wayyiqtol and counts the forms that match', async () => {
    render(<VerbParse />);
    expect(screen.getByRole('button', { name: 'Qal' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Hiphil' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Wayyiqtol' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await screen.findByText(/^1 form from the Hebrew Bible/)).toBeInTheDocument();
  });

  it('saves a narrowed choice and says when nothing matches', async () => {
    const user = userEvent.setup();
    render(<VerbParse />);
    await screen.findByText(/from the Hebrew Bible/);
    await user.click(screen.getByRole('button', { name: 'Qal' }));
    expect(screen.getByText(/at least one stem and one conjugation/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hiphil' }));
    expect(screen.getByText(/^1 form from the Hebrew Bible/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'None' })[1]);
    await user.click(screen.getByRole('button', { name: 'Participle' }));
    expect(screen.getByText('No forms in the text match these settings.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Parsing' })).toBeDisabled();
    await user.click(screen.getAllByRole('button', { name: 'All' })[1]);
    expect(screen.getByText(/^1 form from/)).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Ask for the root' }));
    await user.click(screen.getByRole('button', { name: '10' }));
    expect(loadParseSettings()).toMatchObject({
      stems: ['hiphil'],
      askRoot: false,
      sessionLength: 10,
    });
    await user.click(screen.getAllByRole('button', { name: 'None' })[0]);
    expect(loadParseSettings().stems).toEqual([]);
  });

  it('says so when the forms cannot be loaded', async () => {
    formsResponse = async () => new Response('', { status: 500 });
    render(<VerbParse />);
    expect(await screen.findByText(/could not be loaded/)).toBeInTheDocument();
  });
});

describe('VerbParse — a session', () => {
  it('asks the fields the chosen conjugation has, marks a right answer, and logs it', async () => {
    const user = userEvent.setup();
    render(<VerbParse />);
    await start(user);

    expect(screen.getByText('וַיֹּאמֶר')).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Person')).not.toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Submit' });
    expect(submit).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Stem'), 'qal');
    await user.selectOptions(screen.getByLabelText('Conjugation'), 'wayyiqtol');
    await user.selectOptions(screen.getByLabelText('Person'), '3');
    await user.selectOptions(screen.getByLabelText('Gender'), 'm');
    await user.selectOptions(screen.getByLabelText('Number'), 's');
    expect(screen.queryByLabelText('State')).not.toBeInTheDocument();
    expect(submit).toBeDisabled();
    // The root, typed through the phonetic mapping.
    await user.type(screen.getByRole('textbox', { name: 'Root' }), "'mr");
    await user.click(submit);

    expect(screen.getByRole('status')).toHaveTextContent('Correct!');
    expect(screen.getByText('Qal Wayyiqtol 3rd Masculine Singular')).toBeInTheDocument();
    expect(await screen.findByText('say')).toBeInTheDocument();
    expect(loadAttempts()).toMatchObject([{ concept: 'parse/verb/qal-wayyiqtol', correct: true }]);

    await user.click(screen.getByRole('button', { name: 'See Results' }));
    expect(screen.getByText('100% correct')).toBeInTheDocument();
    expect(screen.getByText('Root')).toBeInTheDocument();
    expect(posthog.capture).toHaveBeenCalledWith('hebrew_parse_completed', {
      correct: 1,
      total: 1,
    });

    await user.click(screen.getByRole('button', { name: 'Change Settings' }));
    expect(screen.getByRole('button', { name: 'Start Parsing' })).toBeInTheDocument();
  });

  it('names the right answer for every field missed, the root included', async () => {
    saveParseSettings({
      stems: ['qal'],
      conjugations: ['participle'],
      askRoot: true,
      sessionLength: 10,
    });
    const user = userEvent.setup();
    render(<VerbParse />);
    await start(user);

    await user.selectOptions(screen.getByLabelText('Stem'), 'piel');
    await user.selectOptions(screen.getByLabelText('Conjugation'), 'participle');
    await user.selectOptions(screen.getByLabelText('Gender'), 'f');
    await user.selectOptions(screen.getByLabelText('Number'), 's');
    await user.selectOptions(screen.getByLabelText('State'), 'a');
    await user.type(screen.getByRole('textbox', { name: 'Root' }), 'Sb{enter}');

    // A root with too few letters is still an answer; Enter submits.
    expect(screen.getByRole('status')).toHaveTextContent('Not quite');
    const stemRow = screen.getByText('Stem').parentElement as HTMLElement;
    expect(within(stemRow).getByText('Piel')).toBeInTheDocument();
    expect(within(stemRow).getByText('Qal')).toBeInTheDocument();
    const rootRow = screen.getByText('Root').parentElement as HTMLElement;
    expect(within(rootRow).getByText('ישׁב')).toBeInTheDocument();
    expect(loadAttempts()).toMatchObject([
      { concept: 'parse/verb/qal-participle', correct: false },
    ]);

    await user.click(screen.getByRole('button', { name: 'See Results' }));
    expect(screen.getByText('0% correct')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(screen.getByText('יֹשֵׁב')).toBeInTheDocument();
  });

  it('leaves the root out when it is not asked', async () => {
    saveParseSettings({
      stems: ['hiphil'],
      conjugations: ['qatal'],
      askRoot: false,
      sessionLength: 10,
    });
    const user = userEvent.setup();
    render(<VerbParse />);
    await start(user);
    expect(screen.queryByRole('textbox', { name: 'Root' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Stem'), 'hiphil');
    await user.selectOptions(screen.getByLabelText('Conjugation'), 'qatal');
    await user.selectOptions(screen.getByLabelText('Person'), '3');
    await user.selectOptions(screen.getByLabelText('Gender'), 'm');
    await user.selectOptions(screen.getByLabelText('Number'), 's');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('status')).toHaveTextContent('Correct!');
    expect(screen.queryByText('Root')).not.toBeInTheDocument();
  });
});
