import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { EmptyState } from './ui';

interface ErrorBoundaryProps {
  /** Changing this value clears the error (e.g. the active tab) */
  resetKey?: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/* Keeps a crash in one page from blanking the whole app shell */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Page failed to render:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page-body">
        <div className="card">
          <EmptyState
            icon={<AlertTriangle size={22} />}
            title="This page couldn’t be displayed"
            text="Something went wrong while loading this section. Try again, or open another page from the menu."
            action={
              <button type="button" className="btn btn-secondary" onClick={() => this.setState({ error: null })}>
                <RotateCcw size={16} />
                Try again
              </button>
            }
          />
        </div>
      </div>
    );
  }
}
