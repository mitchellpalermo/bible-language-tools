import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VerbParseChallenge from './VerbParseChallenge';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('VerbParseChallenge', () => {
  it('renders settings phase on initial load', async () => {
    render(<VerbParseChallenge />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start parsing/i })).toBeInTheDocument();
    });
  });

  it('shows tense chips on settings phase', async () => {
    render(<VerbParseChallenge />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Present' })).toBeInTheDocument();
    });
  });

  it('shows session length buttons on settings phase', async () => {
    render(<VerbParseChallenge />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
    });
  });

  it('starts a session and shows a parse question', async () => {
    const user = userEvent.setup();
    render(<VerbParseChallenge />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start parsing/i })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: /start parsing/i }));
    await waitFor(() => {
      expect(screen.getByText(/parse this form/i)).toBeInTheDocument();
    });
  });

  it('submits an answer and shows feedback', async () => {
    const user = userEvent.setup();
    render(<VerbParseChallenge />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start parsing/i })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: /start parsing/i }));
    await waitFor(() => expect(screen.getByText(/parse this form/i)).toBeInTheDocument());

    // Fill in a complete answer
    await user.selectOptions(screen.getByLabelText('Tense'), 'present');
    await user.selectOptions(screen.getByLabelText('Voice'), 'active');
    await user.selectOptions(screen.getByLabelText('Mood'), 'indicative');
    await user.selectOptions(screen.getByLabelText('Person'), '1st');
    await user.selectOptions(screen.getByLabelText('Number'), 'singular');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    // Feedback shows correct/incorrect
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('navigates to results after completing all questions in a 10-item session', async () => {
    const user = userEvent.setup();
    render(<VerbParseChallenge />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start parsing/i })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: '10' }));
    await user.click(screen.getByRole('button', { name: /start parsing/i }));

    for (let i = 0; i < 10; i++) {
      await waitFor(() => expect(screen.getByText(/parse this form/i)).toBeInTheDocument());
      await user.selectOptions(screen.getByLabelText('Tense'), 'present');
      await user.selectOptions(screen.getByLabelText('Voice'), 'active');
      await user.selectOptions(screen.getByLabelText('Mood'), 'indicative');
      await user.selectOptions(screen.getByLabelText('Person'), '1st');
      await user.selectOptions(screen.getByLabelText('Number'), 'singular');
      await user.click(screen.getByRole('button', { name: /submit/i }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /next form|see results/i })).toBeInTheDocument(),
      );
      await user.click(screen.getByRole('button', { name: /next form|see results/i }));
    }

    await waitFor(() => {
      expect(screen.getByText(/session score/i)).toBeInTheDocument();
    });
  }, 30000);

  it('can return to settings from results via Change Settings', async () => {
    const user = userEvent.setup();
    render(<VerbParseChallenge />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start parsing/i })).not.toBeDisabled(),
    );
    // Use smallest session
    await user.click(screen.getByRole('button', { name: '10' }));
    await user.click(screen.getByRole('button', { name: /start parsing/i }));

    for (let i = 0; i < 10; i++) {
      await waitFor(() => expect(screen.getByText(/parse this form/i)).toBeInTheDocument());
      await user.selectOptions(screen.getByLabelText('Tense'), 'present');
      await user.selectOptions(screen.getByLabelText('Voice'), 'active');
      await user.selectOptions(screen.getByLabelText('Mood'), 'indicative');
      await user.selectOptions(screen.getByLabelText('Person'), '1st');
      await user.selectOptions(screen.getByLabelText('Number'), 'singular');
      await user.click(screen.getByRole('button', { name: /submit/i }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /next form|see results/i })).toBeInTheDocument(),
      );
      await user.click(screen.getByRole('button', { name: /next form|see results/i }));
    }

    await waitFor(() => expect(screen.getByText(/session score/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /change settings/i }));
    expect(screen.getByRole('button', { name: /start parsing/i })).toBeInTheDocument();
  }, 30000);
});
