
import React, { Component, ErrorInfo, ReactNode } from 'react';

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
// Fix: Use named Component import to ensure TypeScript correctly identifies the base class and its members (props, state, setState).
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    // Fix: state is inherited from Component and initialized here.
    this.state = {
      hasError: false
    };
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
    // Fix: Access state inherited from Component class.
    if (this.state.hasError) {
      // Fallback UI when an error is caught in child components
      return (
        <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl text-center">
          <div className="text-3xl mb-2">⚠️</div>
          {/* Fix: Access props inherited from Component class. */}
          <h3 className="font-bold text-red-700 dark:text-red-400">{this.props.fallbackTitle || 'Widget Error'}</h3>
          <p className="text-xs text-red-600/70 dark:text-red-400/50 mt-1">Something went wrong in this section.</p>
          <button 
            /* Fix: Access setState inherited from Component class to reset error state. */
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg active:scale-95 transition-transform"
          >
            Retry Section
          </button>
        </div>
      );
    }

    // Fix: Access props inherited from Component class.
    return this.props.children || null;
  }
}
