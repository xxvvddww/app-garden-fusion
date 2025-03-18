
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true, 
      error: error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to an error reporting service
    console.error('🔥 React Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Fallback UI when an error occurs
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
          <div className="max-w-md w-full bg-slate-900 rounded-lg shadow-xl p-6">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="mb-4 text-slate-300">
              We've encountered an error while rendering the application.
            </p>
            
            {/* Show error details */}
            <div className="mb-6">
              <div className="p-4 bg-slate-800 rounded text-xs overflow-auto mb-2">
                <strong>Error:</strong> {this.state.error?.toString()}
              </div>
              {this.state.errorInfo && (
                <div className="p-4 bg-slate-800 rounded text-xs overflow-auto">
                  <strong>Component Stack:</strong> 
                  <pre>{this.state.errorInfo.componentStack}</pre>
                </div>
              )}
            </div>
            
            {/* Refresh button */}
            <button 
              onClick={() => window.location.reload()} 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    // When there's no error, render children normally
    return this.props.children;
  }
}
