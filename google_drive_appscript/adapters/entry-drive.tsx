// ─── 1. BLINDAGEM PRIORITÁRIA DE STORAGE/IFRAME (DEVE SER O 1º IMPORT) ───────
import './sandbox-shims';

// ─── 2. MONTAGEM DA APLICAÇÃO ENXUTA (GRADE + CONFIGURAÇÕES + LÓGICAS) ───────
import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import AppDriveLite from './AppDriveLite';
import { DialogProvider } from '../../contexts/DialogContext';
import { Icon } from '../../components/Icon';
import { apiStore } from './gas-api';

class DriveErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null }
> {
  public state = { hasError: false, error: null as Error | null, errorInfo: null as ErrorInfo | null };

  public static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Rhescala Drive] Erro capturado:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = (clearCache: boolean) => {
    if (clearCache) {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {}
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '560px',
              width: '100%',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '24px',
              padding: '32px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
          >
            <h1 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', color: '#ffffff' }}>
              Algo inesperado ocorreu
            </h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>
              Seus dados salvos no Google Drive estão protegidos.
            </p>
            {this.state.error && (
              <pre
                style={{
                  backgroundColor: '#020617',
                  border: '1px solid #334155',
                  borderRadius: '14px',
                  padding: '14px',
                  fontSize: '12px',
                  color: '#fda4af',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  marginBottom: '20px',
                }}
              >
                {this.state.error.toString()}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => this.handleReset(false)}
                style={{
                  flex: 1,
                  backgroundColor: '#f97316',
                  color: '#ffffff',
                  fontWeight: 700,
                  padding: '12px 18px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                }}
              >
                Tentar Novamente
              </button>
              <button
                onClick={() => this.handleReset(true)}
                style={{
                  flex: 1,
                  backgroundColor: '#334155',
                  color: '#e2e8f0',
                  fontWeight: 700,
                  padding: '12px 18px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                }}
              >
                Limpar Cache Local
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function FirstRunDriveSetup({
  onComplete,
  spreadsheetUrl,
  initialError,
}: {
  onComplete: () => void;
  spreadsheetUrl?: string;
  initialError?: string;
}) {
  const [adminPass, setAdminPass] = useState('admin');
  const [viewerPass, setViewerPass] = useState('1234');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(initialError || '');

  const handleInit = async () => {
    if (!adminPass.trim() || !viewerPass.trim()) {
      setError('Defina as duas senhas para iniciar o sistema.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const r1 = await apiStore.updatePassword('admin', adminPass.trim());
      const r2 = await apiStore.updatePassword('viewer', viewerPass.trim());
      if (!r1.success || !r2.success) {
        throw new Error(r1.error || r2.error || 'Falha ao salvar senhas');
      }
      onComplete();
    } catch (e: any) {
      setError(
        e?.message ||
          'Não foi possível gravar as senhas no Google Drive. Verifique se a implantação está configurada para executar como "Eu".'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ minHeight: '100vh', backgroundColor: '#09090b' }}
      className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-sans"
    >
      <div
        style={{ backgroundColor: '#ffffff', maxWidth: '448px', width: '100%', borderRadius: '24px', padding: '32px' }}
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-200 dark:border-zinc-800 animate-fade-in"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500 shadow-xl shadow-orange-500/20 mb-4">
            <Icon name="add_to_drive" className="text-3xl text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">RH Escala</h1>
          <p className="text-orange-500 font-bold text-[11px] uppercase tracking-[0.2em] mt-2">
            Configuração Inicial • Google Drive
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-3 leading-relaxed">
            O banco de dados é gerenciado automaticamente no seu Google Drive. Defina as senhas de acesso da unidade:
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-[11px] font-black text-orange-500 uppercase tracking-widest mb-2 ml-1">
              Senha do Gestor (Admin)
            </label>
            <input
              type="password"
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:border-orange-500"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] font-black text-emerald-500 uppercase tracking-widest mb-2 ml-1">
              Senha da Equipe (Viewer)
            </label>
            <input
              type="password"
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
              value={viewerPass}
              onChange={(e) => setViewerPass(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
              <p className="text-rose-600 text-[11px] font-bold text-center">{error}</p>
            </div>
          )}

          <button
            onClick={handleInit}
            disabled={saving}
            style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-zinc-900 font-black py-4 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.15em] text-[11px] flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {saving ? (
              <span>Salvando no Google Drive...</span>
            ) : (
              <>
                <Icon name="rocket_launch" />
                <span>Concluir e Abrir Sistema</span>
              </>
            )}
          </button>

          {spreadsheetUrl && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-[11px] font-bold text-slate-400 hover:text-orange-500 transition-colors pt-2"
            >
              Ver planilha criada no Google Drive ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function DriveRoot() {
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [ssUrl, setSsUrl] = useState<string | undefined>(undefined);
  const [setupErr, setSetupErr] = useState<string | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    apiStore
      .checkSetup()
      .then((res) => {
        if (!mounted) return;
        setInitialized(Boolean(res?.initialized));
        setSsUrl(res?.spreadsheetUrl);
        if (res?.error) setSetupErr(res.error);
      })
      .catch((e) => {
        if (mounted) {
          setInitialized(false);
          setSetupErr(e?.message || String(e));
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#09090b',
          color: '#e4e4e7',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            border: '4px solid rgba(249,115,22,0.25)',
            borderTopColor: '#f97316',
            borderRadius: '9999px',
            animation: 'rhescalaSpin 0.8s linear infinite',
            marginBottom: '16px',
          }}
        />
        <p style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a1a1aa' }}>
          Carregando Rhescala no Google Drive...
        </p>
      </div>
    );
  }

  if (!initialized) {
    return <FirstRunDriveSetup spreadsheetUrl={ssUrl} initialError={setupErr} onComplete={() => setInitialized(true)} />;
  }

  return (
    <DialogProvider>
      <AppDriveLite />
    </DialogProvider>
  );
}

function mountDriveApp() {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mountDriveApp, { once: true });
      return;
    }
    throw new Error('Elemento #root não encontrado em Index.html');
  }

  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <DriveErrorBoundary>
        <DriveRoot />
      </DriveErrorBoundary>
    </React.StrictMode>
  );
}

mountDriveApp();
