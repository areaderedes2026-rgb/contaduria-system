import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isChunkLoadError, hardReload } from '@/utils/chunkError';
import { AppRecoveryPanel } from './AppRecoveryPanel';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error de aplicación:', error, info);
  }

  private handleReload = (opts?: { clearCaches?: boolean }) => {
    this.setState({ hasError: false, isChunkError: false });
    hardReload({
      clearCaches: opts?.clearCaches ?? this.state.isChunkError,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <AppRecoveryPanel
          reason={this.state.isChunkError ? 'chunk' : 'crash'}
          onReload={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}
