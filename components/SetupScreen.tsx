import React, { useState } from 'react';
import { setConfiguredApiUrl } from '../src/gas-api';
import { APPS_SCRIPT_CODE } from '../src/constants/appsScriptCode';
import { Icon } from './Icon';

interface SetupScreenProps {
    onComplete: () => void;
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
    const [url, setUrl] = useState('');
    const [adminPass, setAdminPass] = useState('admin');
    const [viewerPass, setViewerPass] = useState('1234');
    const [testing, setTesting] = useState(false);
    const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
    const [error, setError] = useState('');
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(APPS_SCRIPT_CODE);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    async function handleConnect() {
        const trimmed = url.trim();
        if (!trimmed.startsWith('https://script.google.com')) {
            setError('Cole o link completo do Web App do Google Apps Script.');
            return;
        }

        setTesting(true);
        setError('');

        try {
            const api = (await import('../src/gas-api')).apiStore;
            
            // 1. Verificar se a planilha já está configurada
            const { initialized } = await api.checkSetup(trimmed);
            
            if (initialized) {
                // Se já existe uma senha, apenas salvamos a URL e finalizamos
                setConfiguredApiUrl(trimmed);
                onComplete();
                return;
            }

            // 2. Se NÃO estiver inicializada, exige senhas
            if (!adminPass || !viewerPass) {
                setError('Esta é uma nova planilha. Defina as senhas de acesso para continuar.');
                setTesting(false);
                return;
            }

            // 3. Salvar URL e Configurar as senhas na planilha
            setConfiguredApiUrl(trimmed);
            await api.updatePassword('admin', adminPass);
            await api.updatePassword('viewer', viewerPass);

            onComplete();
        } catch (e) {
            console.error(e);
            setError('Não foi possível configurar a loja. Verifique o link e tente novamente.');
            localStorage.removeItem('escala_gas_api_url');
        } finally {
            setTesting(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 py-20 font-sans">
            <div className="w-full max-w-2xl">
                {/* Logo / Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-indigo-500 shadow-xl shadow-indigo-500/20 mb-6 animate-bounce-subtle">
                        <Icon name="event_note" className="text-4xl text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-white uppercase tracking-tight">RH Escala</h1>
                    <p className="text-indigo-300 font-bold text-[11px] uppercase tracking-[0.2em] mt-3">Configuração de Nova Unidade</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Coluna Esquerda: Instruções e Código */}
                    <div className="space-y-6">
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] p-8 shadow-2xl">
                            <h2 className="text-white font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">1</span>
                                Preparar Planilha
                            </h2>
                            
                            <div className="space-y-4 mb-8">
                                <p className="text-slate-400 text-xs leading-relaxed">
                                    Crie uma nova Planilha Google, vá em <strong className="text-slate-200">Extensões → Apps Script</strong> e cole o código de integração.
                                </p>
                                
                                <button 
                                    onClick={() => setShowCode(!showCode)}
                                    className="w-full py-4 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <Icon name={showCode ? 'visibility_off' : 'code'} />
                                    {showCode ? 'Ocultar Código' : 'Ver Código do Backend'}
                                </button>
                            </div>

                            {showCode && (
                                <div className="relative group animate-fade-in mb-6">
                                    <div className="absolute top-4 right-4 z-10">
                                        <button 
                                            onClick={handleCopy}
                                            className={`p-3 rounded-xl transition-all shadow-lg flex items-center gap-2 text-[9px] font-black uppercase tracking-widest ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                                        >
                                            <Icon name={copied ? 'done' : 'content_copy'} className="text-sm" />
                                            {copied ? 'Copiado!' : 'Copiar'}
                                        </button>
                                    </div>
                                    <pre className="w-full h-48 bg-slate-950/80 border border-white/10 rounded-2xl p-6 text-[10px] text-slate-400 overflow-y-auto custom-scrollbar font-mono leading-relaxed">
                                        {APPS_SCRIPT_CODE}
                                    </pre>
                                </div>
                            )}

                            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
                                <div className="flex items-start gap-3">
                                    <Icon name="info" className="text-orange-500 mt-0.5" />
                                    <p className="text-[10px] text-orange-200/70 leading-relaxed font-medium">
                                        <strong className="text-orange-400 uppercase">Dica:</strong> O nome do arquivo no Google (<code className="bg-orange-500/20 px-1 rounded text-orange-300">Código.gs</code> ou <code className="bg-orange-500/20 px-1 rounded text-orange-300">Code.gs</code>) não interfere no funcionamento.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Coluna Direita: Link e Senhas */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 shadow-2xl border border-white/5 relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                             
                             <h2 className="text-slate-800 dark:text-white font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">2</span>
                                Conectar Unidade
                            </h2>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Link do Web App Gerado</label>
                                    <textarea
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs text-slate-800 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                        rows={2}
                                        placeholder="https://script.google.com/macros/s/..."
                                        value={url}
                                        onChange={(e) => { 
                                            setUrl(e.target.value); 
                                            setError(''); 
                                            setIsInitialized(null);
                                        }}
                                        onBlur={async () => {
                                            const trimmed = url.trim();
                                            if (trimmed.startsWith('https://script.google.com')) {
                                                const api = (await import('../src/gas-api')).apiStore;
                                                const { initialized } = await api.checkSetup(trimmed);
                                                setIsInitialized(initialized);
                                            }
                                        }}
                                    />
                                </div>

                                {isInitialized === true && (
                                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl animate-fade-in">
                                        <div className="flex items-center gap-3">
                                            <Icon name="check_circle" className="text-emerald-500" />
                                            <p className="text-[10px] text-emerald-200/70 leading-relaxed font-medium">
                                                <strong className="text-emerald-400 uppercase">Unidade Identificada:</strong> Esta planilha já possui senhas configuradas. Clique em finalizar para conectar.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {isInitialized === false && (
                                    <>
                                        <div>
                                            <label className="block text-[9px] font-black text-orange-500 uppercase tracking-widest mb-2 ml-1">Senha Gerente (Admin)</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:border-orange-500 transition-all"
                                                value={adminPass}
                                                onChange={(e) => setAdminPass(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2 ml-1">Senha Equipe (Viewer)</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 transition-all"
                                                value={viewerPass}
                                                onChange={(e) => setViewerPass(e.target.value)}
                                            />
                                        </div>
                                    </>
                                )}

                                {error && (
                                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-shake">
                                        <p className="text-rose-500 text-[10px] font-bold text-center uppercase tracking-wider">{error}</p>
                                    </div>
                                )}

                                <button
                                    onClick={handleConnect}
                                    disabled={testing || !url.trim()}
                                    className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black py-5 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.15em] text-[10px] flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {testing ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-slate-400 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
                                            Configurando...
                                        </>
                                    ) : (
                                        <>
                                            <Icon name="rocket_launch" />
                                            Finalizar Configuração
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

