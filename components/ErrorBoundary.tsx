
import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
}

// ErrorBoundary component to catch UI-breaking errors in child components
// Using React.Component explicitly to ensure TypeScript correctly identifies the base class properties
export class ErrorBoundary extends React.Component<Props, State> {
  // Adding constructor to initialize state and clarify inheritance for the TypeScript compiler
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false
    };
  }

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error("Uncaught error:", error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      // Fallback UI when an error is caught
      return (
        <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl text-center">
          <div className="text-3xl mb-2">⚠️</div>
          {/* Fix: Correctly accessing inherited 'props' property from React.Component */}
          <h3 className="font-bold text-red-700 dark:text-red-400">{this.props.fallbackTitle || 'Widget Error'}</h3>
          <p className="text-xs text-red-600/70 dark:text-red-400/50 mt-1">Something went wrong in this section.</p>
          <button 
            /* Fix: Correctly accessing inherited 'setState' method from React.Component */
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg active:scale-95 transition-transform"
          >
            Retry Section
          </button>
        </div>
      );
    }

    /* Fix: Correctly accessing inherited 'props' to return children */
    return this.props.children;
  }
}
