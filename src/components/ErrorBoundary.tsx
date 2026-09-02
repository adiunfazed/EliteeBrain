import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by EliteLife ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCache = () => {
    try {
      localStorage.removeItem('elite_brain_profile_v2');
      localStorage.removeItem('elitebrain_authenticated_user_session');
      localStorage.removeItem('elitebrain_guest');
    } catch (e) {
      console.warn('Cache clear notice:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0E14] text-[var(--ink)] flex items-center justify-center p-4 font-sans select-none">
          <div className="max-w-md w-full bg-[var(--surface)] border border-[var(--rule)] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-indigo-500" />
            
            <div className="w-14 h-14 shrink-0 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-7 h-7 shrink-0" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-mono font-bold tracking-tight text-white">
                Application Recovery
              </h2>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                EliteLife encountered an unexpected UI state exception. Don't worry, your data is protected.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-[#0B0E14] border border-[var(--rule)] rounded-xl p-3 text-left overflow-x-auto max-h-32 text-[11px] font-mono text-red-300">
                {this.state.error.toString()}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full h-11 bg-[#8B5CF6] hover:bg-[#4B5ACD] text-white font-mono text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 shrink-0" />
                <span>Reload Application</span>
              </button>

              <button
                onClick={this.handleClearCache}
                className="w-full h-11 bg-[var(--surface-sunk)] hover:bg-[#1E232D] border border-[var(--rule)] text-[#C4B5FD] font-mono text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 shrink-0 eb-warn" />
                <span>Reset Cache & Restore Default</span>
              </button>
            </div>

            <p className="text-[10px] text-[#667085] font-mono">
              EliteLife
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
