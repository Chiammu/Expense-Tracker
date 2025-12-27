
import React, { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children?: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * ErrorBoundary component to catch UI-breaking errors in child components.
 * Standard class component implementation for error boundaries.
 */
// Explicitly use React.Component with generic types to ensure props and setState are correctly inherited.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Define state as a class property to ensure it's recognized by the compiler and shadows the base definition correctly.
  public override state: ErrorBoundaryState = {
    hasError: false
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  /**
   * Updates state so the next render will show the fallback UI.
   */
  public static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  /**
   * Log error details for debugging purposes.
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render(): ReactNode {
    // Access state inherited from React.Component to check for errors.
    if (this.state.hasError) {
      // Fallback UI when an error is caught in child components.
      return (
        <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl text-center">
          <div className="text-3xl mb-2">⚠️</div>
          {/* Access props for the fallback title. props is inherited from React.Component. */}
          <h3 className="font-bold text-red-700 dark:text-red-400">{this.props.fallbackTitle || 'Widget Error'}</h3>
          <p className="text-xs text-red-600/70 dark:text-red-400/50 mt-1">Something went wrong in this section.</p>
          <button 
            /* Use setState to reset the error state. Method is inherited from React.Component. */
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg active:scale-95 transition-transform"
          >
            Retry Section
          </button>
        </div>
      );
    }

    // Render children if no error occurred. children is accessed from this.props inherited from React.Component.
    return this.props.children || null;
  }
}
