import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

/**
 * Root-level boundary so a render-time crash shows a recoverable screen
 * instead of going blank-white. Also logs full error + component stack
 * so the bug is visible in console / dev-server logs.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Render crashed:', error, info.componentStack);
    this.setState({ info });
  }

  private reset = () => this.setState({ error: null, info: null });

  private reload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const stack = this.state.info?.componentStack || '';
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
        <div className="max-w-2xl w-full space-y-3 border border-border rounded-lg p-4 bg-card">
          <h1 className="text-lg font-semibold">Something broke while rendering.</h1>
          <p className="text-sm text-muted-foreground">
            The game caught a crash so you don't see a blank screen. Try recovering;
            if it keeps happening, copy the details below into a bug report.
          </p>
          <pre className="text-xs whitespace-pre-wrap break-words bg-muted p-2 rounded max-h-40 overflow-auto">
            {this.state.error.message}
          </pre>
          {stack && (
            <pre className="text-[10px] whitespace-pre-wrap break-words bg-muted p-2 rounded max-h-40 overflow-auto opacity-70">
              {stack}
            </pre>
          )}
          <div className="flex gap-2">
            <Button onClick={this.reset}>Try to continue</Button>
            <Button variant="secondary" onClick={this.reload}>Reload</Button>
          </div>
        </div>
      </div>
    );
  }
}
