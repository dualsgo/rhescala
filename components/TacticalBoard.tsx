import React, { useState } from 'react';
import { Employee } from '../types';
import { calculateTacticalPositions, TacticalPosition } from '../hooks/useTacticalEngine';
import { Icon } from './Icon';

interface TacticalBoardProps {
    employees: Employee[];
    dayIdx: number;
    monthKey: string;
    isSunday: boolean;
    isHoliday: boolean;
}

const positionConfig: Record<TacticalPosition, { icon: string, label: string, colorClass: string, borderClass: string, textClass: string, desc: string }> = {
    'P1': { icon: 'point_of_sale', label: 'Caixa (P1)', colorClass: 'bg-blue-50 dark:bg-blue-900/20', borderClass: 'border-blue-200 dark:border-blue-800', textClass: 'text-blue-700 dark:text-blue-400', desc: 'Fixo. Autosserviço e finalização.' },
    'P2': { icon: 'door_front', label: 'Porta (P2)', colorClass: 'bg-green-50 dark:bg-green-900/20', borderClass: 'border-green-200 dark:border-green-800', textClass: 'text-green-700 dark:text-green-400', desc: 'Semi-fixo. Acolhimento.' },
    'P3': { icon: 'storefront', label: 'Salão (P3)', colorClass: 'bg-orange-50 dark:bg-orange-900/20', borderClass: 'border-orange-200 dark:border-orange-800', textClass: 'text-orange-700 dark:text-orange-400', desc: 'Consultivo. Não sai do salão.' },
    'P4': { icon: 'radar', label: 'Coringa (P4)', colorClass: 'bg-purple-50 dark:bg-purple-900/20', borderClass: 'border-purple-200 dark:border-purple-800', textClass: 'text-purple-700 dark:text-purple-400', desc: 'Radar. Apoio ao caixa.' },
    'P5+': { icon: 'security', label: 'Reforço (P5+)', colorClass: 'bg-slate-50 dark:bg-slate-800/50', borderClass: 'border-slate-200 dark:border-slate-700', textClass: 'text-slate-700 dark:text-slate-300', desc: 'Proteção de alto risco.' },
    'Estoque': { icon: 'inventory_2', label: 'Estoquista', colorClass: 'bg-sky-50 dark:bg-sky-900/20', borderClass: 'border-sky-200 dark:border-sky-800', textClass: 'text-sky-700 dark:text-sky-400', desc: 'Retaguarda. Saneamento.' },
    'Pausa/Almoço': { icon: 'restaurant', label: 'Em Pausa', colorClass: 'bg-slate-100 dark:bg-slate-900', borderClass: 'border-dashed border-slate-300 dark:border-slate-700', textClass: 'text-slate-500 dark:text-slate-500', desc: 'Fora do salão.' }
};

export const TacticalBoard: React.FC<TacticalBoardProps> = ({ employees, dayIdx, monthKey, isSunday, isHoliday }) => {
    const [selectedTime, setSelectedTime] = useState<string>("14:00");

    const allocations = calculateTacticalPositions(employees, dayIdx, monthKey, selectedTime, isSunday, isHoliday);
    
    const workingCount = allocations.filter(a => a.status === 'working' && a.position !== 'Estoque').length;
    let scenarioText = 'Crise (1 Colaborador)';
    if (workingCount === 2) scenarioText = 'Operação Base (2) - Filtro P2 ativado';
    else if (workingCount === 3) scenarioText = 'Operação Ativa (3) - Consultor P3';
    else if (workingCount === 4) scenarioText = 'Fluxo Completo (4) - Coringa P4';
    else if (workingCount >= 5) scenarioText = `Escala Máxima (${workingCount}) - Acionando P5+`;
    else if (workingCount === 0) scenarioText = 'Sem Frente de Loja (0)';

    return (
        <section className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 lg:p-8 border border-slate-200 dark:border-slate-800 shadow-sm mt-6">
            <div className="flex flex-col md:flex-row items-baseline md:items-center justify-between mb-6 gap-4">
                <div>
                     <h4 className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Icon name="sports_score" className="text-base text-rose-500" /> POSICIONAMENTO TÁTICO
                    </h4>
                    <p className="text-[9px] font-black text-slate-400 mt-1 uppercase">Cenário: <span className="text-slate-600 dark:text-slate-300">{scenarioText}</span></p>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <Icon name="schedule" className="text-[14px] text-slate-400 ml-1.5" />
                    <select 
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="bg-transparent border-none text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 cursor-pointer outline-none pl-1 pr-6 py-0.5"
                    >
                        {Array.from({length: 13}, (_, i) => i + 10).map(h => {
                             const th = `${h}:00`;
                             return <option key={th} value={th}>{th}</option>;
                        })}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {(['P1', 'P2', 'P3', 'P4', 'P5+', 'Estoque', 'Pausa/Almoço'] as TacticalPosition[]).map(pos => {
                    const empsPos = allocations.filter(a => a.position === pos);
                    if (empsPos.length === 0 && pos !== 'P1' && pos !== 'P2') return null; // Show at least P1 and P2 slots empty if needed

                    const conf = positionConfig[pos];

                    return (
                        <div key={pos} className={`p-4 rounded-2xl border ${conf.colorClass} ${conf.borderClass}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Icon name={conf.icon} className={`text-[14px] ${conf.textClass}`} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${conf.textClass}`}>{conf.label}</span>
                            </div>
                            <p className="text-[8px] font-bold text-slate-500/70 dark:text-slate-400/50 leading-tight mb-3 uppercase tracking-wider">{conf.desc}</p>
                            
                            <div className="space-y-1.5">
                                {empsPos.length === 0 ? (
                                    <div className="text-[9px] font-black italic text-slate-400 opacity-50 uppercase tracking-widest">
                                        Ninguém alocado
                                    </div>
                                ) : (
                                    empsPos.map(e => (
                                        <div key={e.id} className="bg-white/60 dark:bg-slate-950/40 border border-black/5 dark:border-white/5 rounded-xl p-2 px-3 flex items-center justify-between">
                                            <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase truncate">
                                                {e.name}
                                            </span>
                                            {e.isApprentice && <Icon name="school" className="text-[11px] text-amber-500" />}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                     <Icon name="warning" className="text-[10px] text-amber-500" />
                     Em filas com 3+ clientes, a cascata de apoio começa no P4 (Roxo) e vai até P2 (Verde).
                </p>
            </div>
        </section>
    );
};
