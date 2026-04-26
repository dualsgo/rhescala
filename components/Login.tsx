
import React, { useState } from 'react';
import { Icon } from './Icon';

interface LoginProps {
  onLogin: (role: 'admin' | 'viewer') => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple authentication logic
    if (password === 'rihappy123') {
      onLogin('admin');
    } else if (password === 'consulta') {
      onLogin('viewer');
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
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
                className={`w-full bg-slate-50 dark:bg-slate-800/50 border ${error ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200 dark:border-slate-700'} rounded-2xl p-4 text-center text-lg font-bold focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all dark:text-white`}
                autoFocus
              />
              {error && (
                <p className="absolute -bottom-6 left-0 right-0 text-center text-[10px] font-black text-rose-500 uppercase tracking-widest animate-shake">Senha Incorreta</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black py-4 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest text-xs"
          >
            Entrar no Sistema
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800">
          <div className="flex justify-center gap-8">
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase mb-1">Versão</span>
              <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">2.0.0</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase mb-1">Status</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
