'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

export type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: (retry: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  /** A change clears a caught error, so the children get another go. */
  resetKey?: unknown;
};

type ErrorBoundaryState = { failed: boolean; resetKey: unknown };

/**
 * Contains a render error to the subtree it wraps. Carries no copy: the caller supplies the
 * fallback, so the words stay in the app's own language layer.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    return Object.is(props.resetKey, state.resetKey) ? null : { failed: false, resetKey: props.resetKey };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return this.props.fallback(() => {
      this.setState({ failed: false });
    });
  }
}
