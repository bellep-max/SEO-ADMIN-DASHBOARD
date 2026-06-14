import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] Render error:", error.message);
    console.error("[ErrorBoundary] Stack:", info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-8 space-y-3">
          <h2 className="text-lg font-semibold text-destructive">Something went wrong</h2>
          <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-64">
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
          <button
            className="text-sm underline text-primary"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
