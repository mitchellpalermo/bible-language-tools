import posthog from 'posthog-js';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  component: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches React rendering errors within an island, reports them
 * to PostHog via `captureException`, and renders a friendly fallback UI with a
 * retry button.
 *
 * Usage: wrap the root of each React island so errors are contained and tracked.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    posthog.captureException(error, {
      tags: { component: this.props.component },
      extra: { componentStack: info.componentStack },
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-xl border p-8 text-center"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
          }}
          role="alert"
        >
          <p className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
            Something went wrong
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
            An unexpected error occurred in this section.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{
              background: 'var(--color-primary)',
              color: '#fff',
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
