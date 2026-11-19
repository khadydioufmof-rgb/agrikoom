import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Erreur applicative inattendue' };
  }

  componentDidCatch(error: Error) {
    console.error('AgriKoom ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      let friendlyDetail = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed?.error) {
          friendlyDetail = `Opération ${parsed.operationType} refusée (${parsed.path || 'racine'}): ${parsed.error}`;
        }
      } catch {
        // non-JSON error message
      }

      return (
        <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-6">
            <div className="flex items-center gap-3 text-[#D32F2F]">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h2 className="font-display text-lg font-bold text-[#1E293B]">Interruption de sécurité</h2>
            </div>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">{friendlyDetail}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2E7D32] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#256428] transition-colors min-h-[48px]"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Recharger AgriKoom</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
