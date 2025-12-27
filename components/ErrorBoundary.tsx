
import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  // Marking children as optional to prevent "missing children" errors when used in JSX
  children?: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
}

/**
 * ErrorBoundary component to catch UI-breaking errors in child components.
 * Inherits from React.Component to use lifecycle methods and state management.
 */
// Fix: Explicitly use React.Component with Props and State to resolve 'props' and 'setState' not found errors.
export class ErrorBoundary extends React.Component<Props, State> {
  // Use a constructor to initialize state and handle props correctly in TypeScript context
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false
    };
  }

  /**
   * Updates state so the next render will show the fallback UI.
   */
  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  /**
   * Log error details for debugging purposes.
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      // Fallback UI when an error is caught in child components
      return (
        <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl text-center">
          <div className="text-3xl mb-2">⚠️</div>
          {/* Accessing fallbackTitle from this.props which is inherited from React.Component */}
          <h3 className="font-bold text-red-700 dark:text-red-400">{this.props.fallbackTitle || 'Widget Error'}</h3>
          <p className="text-xs text-red-600/70 dark:text-red-400/50 mt-1">Something went wrong in this section.</p>
          <button 
            /* Accessing setState from React.Component base class to reset error state */
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg active:scale-95 transition-transform"
          >
            Retry Section
          </button>
        </div>
      );
    }

    /* Returning children from this.props or null if none exist */
    return this.props.children || null;
  }
}
