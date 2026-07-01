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
          style={{ borderColor: '#D1FAE5', background: '#F0FDF4' }}
          role="alert"
        >
          <p className="text-lg font-semibold mb-1" style={{ color: '#14532D' }}>
            Something went wrong
          </p>
          <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
            An unexpected error occurred in this section.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: 'var(--color-primary)', color: '#fff' }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
