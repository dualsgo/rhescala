import React, { useState, useMemo } from 'react';
import { Employee, MonthYear, JornadaSettings } from '../types';
import { getShiftClassification } from '../hooks/useScheduleEngine';
import { DEFAULT_JORNADA_SETTINGS } from '../constants';
import { Icon } from './Icon';
import { toPng } from 'html-to-image';

interface SectionAssignment {
  Q1: Record<string, string[]>;
  Q2: Record<string, string[]>;
}

interface SectionManagerProps {
  employees: Employee[];
  currentMY: MonthYear;
  assignments: SectionAssignment;
  onUpdateAssignments: (newData: SectionAssignment) => void;
  jornadaSettings?: JornadaSettings;
  onClose: () => void;
}

const SECTIONS = [
  'Checkout / Baby / Pelúcias / Pri. Infância',
  'Bonecas / Acessórios (Fashion, Mini)',
  'Bonecos (Dinos), Pistas e Veículos',
  'Jogos / Quebra Cabeças / Blocos',
  'Livre / Esportes / Massas / Artesanato'
];

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const SectionManager: React.FC<SectionManagerProps> = ({ 
  employees, 
  currentMY, 
  assignments, 
  onUpdateAssignments, 
  jornadaSettings = DEFAULT_JORNADA_SETTINGS,
  onClose 
}) => {
  const [activeTab, setActiveTab] = useState<'Q1' | 'Q2'>('Q1');
  const monthKey = `${currentMY.year}-${String(currentMY.month + 1).padStart(2, '0')}`;

  const currentData = assignments[activeTab] || {};

  const activeEmps = useMemo(() => {
    return employees.filter(e => !e.isHidden && e.status === 'active');
  }, [employees]);

  const handleSortear = () => {
    const byShift: Record<string, Employee[]> = { Abertura: [], Intermediário: [], Fechamento: [] };
    
    activeEmps.forEach(emp => {
        const cls = getShiftClassification(emp.workPeriod, false, jornadaSettings);
        const key = ['Abertura', 'Fechamento'].includes(cls) ? cls : 'Intermediário';
        byShift[key].push(emp);
    });
    
    const shuffle = (arr: any[]) => arr.sort(() => 0.5 - Math.random());
    shuffle(byShift.Abertura);
    shuffle(byShift.Intermediário);
    shuffle(byShift.Fechamento);

    const result: Record<string, string[]> = {};
    SECTIONS.forEach(s => result[s] = []);

    // Helper to find the section with the minimum people to keep it balanced
    const getMinSection = () => {
        let minSize = 999;
        let selectedSec = SECTIONS[0];
        SECTIONS.forEach(s => {
            if (result[s].length < minSize) {
                minSize = result[s].length;
                selectedSec = s;
            }
        });
        return selectedSec;
    };

    while(byShift.Abertura.length > 0) result[getMinSection()].push(byShift.Abertura.pop()!.id);
    while(byShift.Fechamento.length > 0) result[getMinSection()].push(byShift.Fechamento.pop()!.id);
    while(byShift.Intermediário.length > 0) result[getMinSection()].push(byShift.Intermediário.pop()!.id);

    onUpdateAssignments({
      ...assignments,
      [activeTab]: result
    });
  };

  const handleDownload = async () => {
    const el = document.getElementById('section-capture');
    if (el) {
      const dataUrl = await toPng(el, { 
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: 1200, 
        style: { 
          padding: '40px',
          width: '1200px',
          margin: '0',
          display: 'block'
        }
      });
      const link = document.createElement('a');
      link.download = `secoes-${activeTab}-${monthKey}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  const getEmpName = (id: string) => {
    const emp = employees.find(e => e.id === id);
    return emp ? emp.name.split(' ')[0] : 'Desconhecido';
  };

  const getEmpShiftColor = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return 'bg-slate-100 text-slate-500';
    const cls = getShiftClassification(emp.workPeriod, false, jornadaSettings);
    if (cls === 'Abertura') return 'bg-sky-100 text-sky-600';
    if (cls === 'Fechamento') return 'bg-indigo-100 text-indigo-600';
    return 'bg-amber-100 text-amber-600';
  };

  // Identify unassigned employees
  const assignedIds = new Set(Object.values(currentData).flat());
  const unassignedEmps = activeEmps.filter(e => !assignedIds.has(e.id));

  const handleRemoveEmp = (sectionName: string, empId: string) => {
      const newSec = currentData[sectionName].filter(id => id !== empId);
      onUpdateAssignments({
          ...assignments,
          [activeTab]: { ...currentData, [sectionName]: newSec }
      });
  };

  const handleAddEmp = (sectionName: string, empId: string) => {
      if (!empId) return;
      const newSec = [...(currentData[sectionName] || []), empId];
      onUpdateAssignments({
          ...assignments,
          [activeTab]: { ...currentData, [sectionName]: newSec }
      });
  };

  return (
    <div className="flex flex-col h-full animate-fade-in bg-slate-50 dark:bg-slate-950 p-6 overflow-hidden">
      <div className="max-w-6xl mx-auto w-full flex flex-col h-full gap-6">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-2xl flex items-center justify-center">
              <Icon name="category" className="text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Donos de Seção</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{MONTH_NAMES[currentMY.month]} {currentMY.year}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
            >
              <Icon name="download" /> Baixar Imagem
            </button>
            <button onClick={onClose} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <Icon name="close" className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Tabs & Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => setActiveTab('Q1')}
                    className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'Q1' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    Quinzena 1 (Dia 1-15)
                </button>
                <button
                    onClick={() => setActiveTab('Q2')}
                    className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'Q2' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    Quinzena 2 (Dia 16-31)
                </button>
            </div>

            <button 
                onClick={handleSortear}
                className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
            >
                <Icon name="casino" className="text-lg text-pink-500" />
                Sortear {activeTab}
            </button>
        </div>

        {/* Sections Area */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl p-6 lg:p-10">
          <div id="section-capture" className="bg-white dark:bg-slate-900 p-8 w-[1120px] mx-auto">
            
            {/* Title for Screenshot */}
            <div className="text-center mb-10">
               <h1 className="text-4xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Donos de Seção • Loja</h1>
               <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">
                 {MONTH_NAMES[currentMY.month]} {currentMY.year} • {activeTab === 'Q1' ? '1ª Quinzena' : '2ª Quinzena'}
               </p>
            </div>

            <div className="grid grid-cols-5 gap-4">
              {SECTIONS.map(secName => (
                <div key={secName} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-[2rem] p-5 flex flex-col gap-4">
                  <div className="text-center min-h-[60px] flex items-center justify-center">
                      <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase leading-tight">{secName}</h3>
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-2">
                      {(currentData[secName] || []).map(empId => (
                          <div key={empId} className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl p-2 border border-slate-100 dark:border-slate-700 shadow-sm group">
                              <div className="flex items-center gap-2 truncate">
                                <div className={`w-2 h-2 rounded-full ${getEmpShiftColor(empId).split(' ')[0]}`} />
                                <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 truncate">{getEmpName(empId)}</span>
                              </div>
                              <button onClick={() => handleRemoveEmp(secName, empId)} className="opacity-0 group-hover:opacity-100 text-rose-500 hover:bg-rose-50 p-1 rounded-md transition-all">
                                <Icon name="close" className="text-[10px]" />
                              </button>
                          </div>
                      ))}

                      <div className="mt-auto pt-2 no-print">
                          <select 
                              onChange={(e) => handleAddEmp(secName, e.target.value)}
                              value=""
                              className="w-full bg-transparent border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-2 text-[10px] font-bold text-slate-400 focus:outline-none focus:border-pink-300 transition-all uppercase"
                          >
                              <option value="" disabled>+ Adicionar</option>
                              {unassignedEmps.map(emp => (
                                  <option key={emp.id} value={emp.id}>{emp.name.split(' ')[0]}</option>
                              ))}
                          </select>
                      </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Legend for Screenshot */}
            <div className="mt-12 flex justify-center gap-8">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-sky-100" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Abertura</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-100" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fechamento</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-100" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Intermediário</span>
                </div>
            </div>

            <div className="mt-8 p-6 bg-pink-50 dark:bg-pink-900/10 rounded-[2rem] border border-pink-100 dark:border-pink-900/20 text-center">
               <p className="text-[11px] font-bold text-pink-700 dark:text-pink-400 uppercase tracking-widest">
                 O dono da seção é responsável por manter a área precificada, limpa e organizada durante o seu turno.
               </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
