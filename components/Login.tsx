
import React, { useState } from 'react';
import { Icon } from './Icon';
import { apiStore } from '../src/gas-api';

interface LoginProps {
  onLogin: (role: 'admin' | 'viewer') => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await apiStore.login(password);
      if (result.success && result.role) {
        onLogin(result.role);
      } else {
        setError(result.error || 'Senha Incorreta');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      setError('Erro de conexão com o servidor');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-10 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-orange-500 rounded-3xl shadow-lg shadow-orange-500/20 flex items-center justify-center mb-6 animate-bounce-subtle">
             <Icon name="event_note" className="text-4xl text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">RH Escala</h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2">Sistema de Gestão de Escalas</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Senha de Acesso</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className={`w-full bg-slate-50 dark:bg-slate-800/50 border ${error ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200 dark:border-slate-700'} rounded-2xl p-4 text-center text-lg font-bold focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all dark:text-white disabled:opacity-50`}
                autoFocus
              />
              {error && (
                <p className="absolute -bottom-6 left-0 right-0 text-center text-[10px] font-black text-rose-500 uppercase tracking-widest animate-shake">{error}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black py-4 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-400 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
                Autenticando...
              </>
            ) : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col items-center gap-6">
            <div className="flex justify-center gap-8 w-full">
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-slate-400 uppercase mb-1">Versão</span>
                <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">2.1.0</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-slate-400 uppercase mb-1">Segurança</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">Nuvem</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                if (window.confirm('Deseja realmente trocar o link da planilha? Você voltará para a tela de configuração inicial.')) {
                  import('../src/gas-api').then(m => {
                    m.clearConfiguredApiUrl();
                    window.location.reload();
                  });
                }
              }}
              className="text-[10px] font-black text-slate-400 hover:text-orange-500 uppercase tracking-widest transition-colors flex items-center gap-2"
            >
              <Icon name="settings_backup_restore" className="text-sm" />
              Configurar outra loja / Trocar Link
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

