import React, { useState } from 'react';
import { setConfiguredApiUrl } from '../src/gas-api';

interface SetupScreenProps {
    onComplete: () => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
    const [url, setUrl] = useState('');
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState('');

    async function handleConnect() {
        const trimmed = url.trim();
        if (!trimmed.startsWith('https://script.google.com')) {
            setError('Cole o link completo do Web App do Google Apps Script.');
            return;
        }

        setTesting(true);
        setError('');

        try {
            const response = await fetch(`${trimmed}?key=_ping`, {
                method: 'GET',
                redirect: 'follow',
            });
            if (!response.ok) throw new Error('Não foi possível conectar.');
            setConfiguredApiUrl(trimmed);
            onComplete();
        } catch {
            setError('Não foi possível conectar. Verifique o link e tente novamente.');
        } finally {
            setTesting(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo / Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 mb-4">
                        <span className="text-3xl">📅</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Gestão de Escala</h1>
                    <p className="text-slate-400 text-sm mt-1">Ri Happy — Configure sua loja</p>
                </div>

                {/* Card */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
                    <h2 className="text-white font-bold text-lg mb-2">Conectar à Planilha</h2>
                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                        Cole abaixo o <strong className="text-slate-200">link do Web App</strong> gerado
                        no Google Apps Script da sua loja.
                    </p>

                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                        Link do Web App
                    </label>
                    <textarea
                        className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-white text-sm placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-400 transition-colors"
                        rows={3}
                        placeholder="https://script.google.com/macros/s/..."
                        value={url}
                        onChange={(e) => { setUrl(e.target.value); setError(''); }}
                    />

                    {error && (
                        <p className="text-rose-400 text-xs mt-2 flex items-center gap-1">
                            <span>⚠️</span> {error}
                        </p>
                    )}

                    <button
                        onClick={handleConnect}
                        disabled={testing || !url.trim()}
                        className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all active:scale-95"
                    >
                        {testing ? '⏳ Testando conexão...' : '🔗 Conectar'}
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
