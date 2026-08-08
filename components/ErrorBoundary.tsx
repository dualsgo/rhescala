import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Icon } from './Icon';

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

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCache = () => {
    if (window.confirm('Deseja limpar os dados locais de cache e recarregar a página? Suas configurações salvas na nuvem não serão perdidas.')) {
      // Limpa dados temporários mantendo apenas a URL da planilha se existir
      const apiUrl = localStorage.getItem('escala_gas_api_url');
      localStorage.clear();
      if (apiUrl) {
        localStorage.setItem('escala_gas_api_url', apiUrl);
      }
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans">
          <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Icon name="warning" className="text-3xl" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Ops! Algo deu errado ao carregar o RH Escala</h1>
                <p className="text-xs text-slate-400 mt-1">Ocorreu um erro inesperado durante o processamento da página.</p>
              </div>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/80 border border-slate-700/60 rounded-2xl p-4 text-xs font-mono text-rose-300 overflow-x-auto">
                <p className="font-bold">{this.state.error.toString()}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 text-[10px] text-slate-400 whitespace-pre-wrap leading-relaxed">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20"
              >
                <Icon name="refresh" />
                Recarregar Página
              </button>
              <button
                onClick={this.handleClearCache}
                className="w-full sm:w-auto flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-3 px-5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider border border-slate-600"
              >
                <Icon name="cleaning_services" />
                Limpar Cache e Restaurar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
