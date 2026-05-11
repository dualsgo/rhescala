import React, { useState } from 'react';
import { setConfiguredApiUrl } from '../src/gas-api';

interface SetupScreenProps {
    onComplete: () => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
    const [url, setUrl] = useState('');
    const [adminPass, setAdminPass] = useState('admin');
    const [viewerPass, setViewerPass] = useState('1234');
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState('');

    async function handleConnect() {
        const trimmed = url.trim();
        if (!trimmed.startsWith('https://script.google.com')) {
            setError('Cole o link completo do Web App do Google Apps Script.');
            return;
        }

        if (!adminPass || !viewerPass) {
            setError('Defina as senhas de acesso para continuar.');
            return;
        }

        setTesting(true);
        setError('');

        try {
            // 1. Testar conexão (Ping)
            const response = await fetch(`${trimmed}?key=_ping`, {
                method: 'GET',
                redirect: 'follow',
            });
            if (!response.ok) throw new Error('Não foi possível conectar.');
            
            // 2. Salvar URL temporariamente para as chamadas de API
            setConfiguredApiUrl(trimmed);

            // 3. Configurar as senhas na planilha
            const api = (await import('../src/gas-api')).apiStore;
            await api.updatePassword('admin', adminPass);
            await api.updatePassword('viewer', viewerPass);

            onComplete();
        } catch (e) {
            console.error(e);
            setError('Não foi possível configurar a loja. Verifique o link e tente novamente.');
            localStorage.removeItem('escala_gas_api_url'); // Limpa em caso de erro
        } finally {
            setTesting(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 py-12">
            <div className="w-full max-w-md">
                {/* Logo / Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 mb-4">
                        <span className="text-3xl">📅</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Gestão de Escala</h1>
                    <p className="text-slate-400 text-sm mt-1">Configuração de Nova Loja</p>
                </div>

                {/* Card */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 shadow-2xl">
                    <h2 className="text-white font-bold text-lg mb-2">Conectar e Configurar</h2>
                    <p className="text-slate-400 text-xs mb-6 leading-relaxed">
                        Insira o link do Apps Script e defina as senhas de acesso para esta unidade.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                                Link do Web App (GAS)
                            </label>
                            <textarea
                                className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white text-xs placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-400 transition-colors"
                                rows={2}
                                placeholder="https://script.google.com/macros/s/..."
                                value={url}
                                onChange={(e) => { setUrl(e.target.value); setError(''); }}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 text-orange-400">
                                    Senha Admin
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-orange-400 transition-colors"
                                    value={adminPass}
                                    onChange={(e) => setAdminPass(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 text-emerald-400">
                                    Senha Viewer
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-emerald-400 transition-colors"
                                    value={viewerPass}
                                    onChange={(e) => setViewerPass(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <p className="text-rose-400 text-xs mt-4 flex items-center gap-1 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                            <span>⚠️</span> {error}
                        </p>
                    )}

                    <button
                        onClick={handleConnect}
                        disabled={testing || !url.trim()}
                        className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                    >
                        {testing ? '⏳ Configurando Loja...' : '🚀 Finalizar Configuração'}
                    </button>
                </div>


                {/* Instructions */}
                <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                        Como obter o link?
                    </p>
                    <ol className="space-y-2">
                        {[
                            'Abra a Planilha Google da sua loja',
                            'Vá em Extensões → Apps Script',
                            'Cole o código do sistema e salve',
                            'Clique em Implantar → Novo Aplicativo Web',
                            'Copie o link gerado e cole aqui',
                        ].map((step, i) => (
                            <li key={i} className="flex gap-3 text-sm text-slate-300">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600/40 text-indigo-300 text-xs font-bold flex items-center justify-center">
                                    {i + 1}
                                </span>
                                {step}
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </div>
    );
}
