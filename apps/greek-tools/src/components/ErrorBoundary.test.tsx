import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import posthog from 'posthog-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

vi.mock('posthog-js', () => ({
  default: {
    captureException: vi.fn(),
  },
}));

// Suppress React's error boundary console output in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Component that throws on render
function BombComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('test explosion');
  return <div>safe content</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary component="TestIsland">
        <div>hello</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('renders fallback UI when a child throws', () => {
    render(
      <ErrorBoundary component="TestIsland">
        <BombComponent shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('safe content')).not.toBeInTheDocument();
  });

  it('calls posthog.captureException with the component name and error', () => {
    render(
      <ErrorBoundary component="Flashcards">
        <BombComponent shouldThrow />
      </ErrorBoundary>,
    );

    expect(posthog.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'test explosion' }),
      expect.objectContaining({ tags: { component: 'Flashcards' } }),
    );
  });

  it('resets error state when retry button is clicked', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <ErrorBoundary component="TestIsland">
        <BombComponent shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Swap in a non-throwing child before retry so the reset doesn't re-trigger the error
    rerender(
      <ErrorBoundary component="TestIsland">
        <BombComponent shouldThrow={false} />
      </ErrorBoundary>,
    );

    // Click retry — boundary resets and the non-throwing child renders
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });
});
