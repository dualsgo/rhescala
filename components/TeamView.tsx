import React, { useState, useMemo } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Employee, EmployeeCargo } from '../types';
import { Icon } from './Icon';
import { SHIFT_HOURS, APPRENTICE_WORK_PERIOD } from '../constants';

interface TeamViewProps {
  employees: Employee[];
  isReadOnly?: boolean;
  onUpdateEmployee: (empId: string, data: Partial<Employee>) => void;
  onDeleteEmployee: (empId: string) => void;
  onAddEmployee: (name: string, isYoung: boolean, courseDay: string, cargo: EmployeeCargo, birthday: string, contractType?: 'CLT' | 'Sazonal', jornada?: '6x1' | '5x2') => void;
}

const CARGO_OPTIONS: EmployeeCargo[] = ['Atendente', 'Estoquista', 'Aprendiz', 'Fiscal'];

/** Adds `days` calendar days to a YYYY-MM-DD string and returns YYYY-MM-DD */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** When user sets vacation start (saída), auto-compute end = start + 30 days */
function handleVacationStart(emp: Employee, startDate: string, onUpdate: (id: string, data: Partial<Employee>) => void) {
  if (!startDate) {
    onUpdate(emp.id, { vacationStart: '', vacationEnd: '' });
    return;
  }
  const endDate = addDays(startDate, 29);
  const updates: Partial<Employee> = { vacationStart: startDate, vacationEnd: endDate };

  const startObj = new Date(startDate + 'T00:00:00');
  const endObj = new Date(endDate + 'T00:00:00');
  
  const newShifts = { ...emp.shifts };
  
  let current = new Date(startObj.getFullYear(), startObj.getMonth(), 1);
  while (current <= endObj) {
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    const shifts = [...(newShifts[monthKey] || [])];
    const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    
    if (shifts.length === 0) {
      for (let i = 0; i < daysInMonth; i++) shifts[i] = 'T';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (dStr >= startDate && dStr <= endDate) {
        shifts[d - 1] = 'FE';
      } else if (shifts[d - 1] === 'FE') {
        shifts[d - 1] = 'T';
      }
    }
    newShifts[monthKey] = shifts;
    current.setMonth(current.getMonth() + 1);
  }
  
  updates.shifts = newShifts;
  onUpdate(emp.id, updates);
}

export const TeamView: React.FC<TeamViewProps> = ({ 
  employees, 
  isReadOnly = false,
  onUpdateEmployee, 
  onDeleteEmployee, 
  onAddEmployee 
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [isYoung, setIsYoung] = useState(false);
  const [courseDay, setCourseDay] = useState('Segunda-feira');
  const [newCargo, setNewCargo] = useState<EmployeeCargo>('Atendente');
  const [newBirthday, setNewBirthday] = useState('');
  const [newContractType, setNewContractType] = useState<'CLT' | 'Sazonal'>('CLT');
  const [newJornada, setNewJornada] = useState<'6x1' | '5x2'>('6x1');

  // Accordion state: Set of employee IDs that are currently expanded
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [cargoFilter, setCargoFilter] = useState<string>('ALL');

  const { showDialog } = useDialog();

  const toggleExpand = (empId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(empId)) {
        next.delete(empId);
      } else {
        next.add(empId);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedIds(new Set(employees.map(e => e.id)));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (emp.cargo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (emp.workPeriod || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCargo = cargoFilter === 'ALL' || (emp.cargo || 'Atendente') === cargoFilter;
      return matchesSearch && matchesCargo;
    });
  }, [employees, searchTerm, cargoFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      const confirmed = await showDialog({
        type: 'confirm',
        message: `Deseja cadastrar o colaborador ${newName}?`
      });
      if (confirmed) {
        onAddEmployee(newName, isYoung, courseDay, newCargo, newBirthday, newContractType, newJornada);
        setNewName('');
        setIsYoung(false);
        setNewCargo('Atendente');
        setNewBirthday('');
        setNewContractType('CLT');
        setNewJornada('6x1');
        setShowAddModal(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-12">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm gap-4">
        <div>
           <div className="flex items-center gap-2">
             <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">Equipe Operacional</h3>
             <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
               {employees.length} {employees.length === 1 ? 'colaborador' : 'colaboradores'}
             </span>
           </div>
           <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">
             Clique no card do colaborador para expandir ou editar os detalhes completos.
           </p>
        </div>
        
        {!isReadOnly && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={() => setShowAddModal(true)}
              className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="person_add" className="text-base" /> Novo Colaborador
            </button>
          </div>
        )}
      </div>

      {/* Filter and Accordion Global Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-900/60 p-3 rounded-2xl border border-slate-200/60 dark:border-zinc-800">
        {/* Left: Search & Cargo Filter */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Icon name="search" className="absolute left-3 top-2.5 text-slate-400 text-sm" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar colaborador..."
              className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500/30 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <Icon name="close" />
              </button>
            )}
          </div>

          <div className="flex items-center bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-0.5 rounded-xl">
            {['ALL', ...CARGO_OPTIONS].map(c => (
              <button
                key={c}
                onClick={() => setCargoFilter(c)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                  cargoFilter === c 
                    ? 'bg-orange-500 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                {c === 'ALL' ? 'Todos' : c}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Expand All / Collapse All */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExpandAll}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all"
            title="Expandir todos os cartões de colaboradores"
          >
            <Icon name="unfold_more" className="text-sm" />
            <span>Expandir Todos</span>
          </button>

          <button
            onClick={handleCollapseAll}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all"
            title="Recolher todos os cartões de colaboradores"
          >
            <Icon name="unfold_less" className="text-sm" />
            <span>Recolher Todos</span>
          </button>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-y-auto max-h-[90vh]">
            <h4 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
              <Icon name="person_add" className="text-orange-500" /> Cadastrar Colaborador
            </h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome Completo</label>
                <input 
                  autoFocus 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 font-bold text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none uppercase" 
                  placeholder="Nome do colaborador" 
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cargo</label>
                <div className="grid grid-cols-2 gap-2">
                  {CARGO_OPTIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setNewCargo(c);
                        if (c === 'Aprendiz') {
                          setIsYoung(true);
                        } else {
                          setIsYoung(false);
                        }
                      }}
                      className={`py-2.5 rounded-xl text-xs font-black uppercase border transition-all ${
                        newCargo === c
                          ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                          : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-zinc-700 hover:border-orange-300'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Contrato</label>
                  <select 
                    value={newContractType} 
                    onChange={(e) => setNewContractType(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 font-bold text-xs text-slate-800 dark:text-slate-200 outline-none"
                  >
                    <option value="CLT">CLT (Efetivo)</option>
                    <option value="Sazonal">Sazonal / Temporário</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Jornada</label>
                  <select 
                    value={newJornada} 
                    onChange={(e) => setNewJornada(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 font-bold text-xs text-slate-800 dark:text-slate-200 outline-none"
                  >
                    <option value="6x1">6x1</option>
                    <option value="5x2">5x2</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data de Aniversário</label>
                <input 
                  type="date" 
                  value={newBirthday} 
                  onChange={(e) => setNewBirthday(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 font-bold text-xs text-slate-800 dark:text-slate-200 outline-none" 
                />
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                <input type="checkbox" id="isYoung" checked={isYoung} onChange={(e) => setIsYoung(e.target.checked)} className="w-4 h-4 accent-orange-500 rounded" />
                <label htmlFor="isYoung" className="text-xs font-black text-slate-700 dark:text-slate-300">Jovem Aprendiz</label>
              </div>

              {isYoung && (
                <div className="p-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50 rounded-xl space-y-2">
                  <label className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest block">Dia do Curso Teórico</label>
                  <select value={courseDay} onChange={(e) => setCourseDay(e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-sky-200 dark:border-sky-800 rounded-xl p-2 font-bold text-xs text-sky-900 dark:text-sky-200 outline-none">
                    {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].map(d => <option key={d}>{d}</option>)}
                  </select>
                  <p className="text-[9px] text-sky-500 font-bold uppercase tracking-tight">Nota: Aprendizes folgam aos Sábados e Domingos automaticamente.</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl font-black text-xs uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-xl font-black text-xs uppercase shadow-lg hover:bg-orange-600 transition-all">Cadastrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Cards List with Accordion (Initially Compact) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredEmployees.map(emp => {
          const isExpanded = expandedIds.has(emp.id);

          return (
            <div 
              key={emp.id} 
              className={`bg-white dark:bg-zinc-900 rounded-2xl border transition-all relative overflow-hidden flex flex-col ${
                isExpanded 
                  ? 'border-orange-400/60 dark:border-orange-500/40 shadow-lg ring-1 ring-orange-400/20' 
                  : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 shadow-sm hover:shadow-md'
              }`}
            >
              {/* Top Accent Pill Indicator */}
              <div className={`h-1 w-full ${emp.status === 'active' ? (emp.contractType === 'Sazonal' ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-300'}`} />

              {/* Compact Summary Header (Always Visible, Click to Toggle) */}
              <div 
                onClick={() => toggleExpand(emp.id)}
                className="p-3 sm:p-4 cursor-pointer select-none transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/50 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-sm uppercase shrink-0 transition-transform ${
                      emp.isYoungApprentice
                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                        : emp.cargo === 'Estoquista'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                    }`}>
                      {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-slate-900 dark:text-slate-100 truncate" title={emp.name}>
                          {emp.name}
                        </span>
                        <div className={`w-2 h-2 rounded-full shrink-0 ${emp.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} title={emp.status === 'active' ? 'Ativo' : 'Inativo'} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {emp.cargo || 'Atendente'}
                        </span>
                        {emp.contractType === 'Sazonal' && (
                          <span className="text-[8px] px-1.5 py-0.2 rounded font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 uppercase">Sazonal</span>
                        )}
                        {emp.jornada === '5x2' && (
                          <span className="text-[8px] px-1.5 py-0.2 rounded font-black bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 uppercase">5x2</span>
                        )}
                        {emp.isHidden && (
                          <span className="text-[8px] px-1.5 py-0.2 rounded font-black bg-slate-100 dark:bg-zinc-800 text-slate-500 uppercase">Oculto</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expand Chevron Icon with 180-deg rotation */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(emp.id);
                      }}
                      className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all ${
                        isExpanded ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 rotate-180' : ''
                      }`}
                      title={isExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
                    >
                      <Icon name="expand_more" className="text-lg transition-transform duration-200" />
                    </button>
                  </div>
                </div>

                {/* Quick details chips in compact mode */}
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 flex-wrap pt-1 border-t border-slate-100 dark:border-zinc-800/80">
                  <div className="flex items-center gap-1">
                    <Icon name="schedule" className="text-xs text-orange-500" />
                    <span>{emp.workPeriod || '10h às 18h20'}</span>
                  </div>
                  {emp.preferredDayOff && (
                    <div className="flex items-center gap-1 ml-auto text-[9px] text-slate-400">
                      <Icon name="event_busy" className="text-xs text-slate-400" />
                      <span>Folga: {emp.preferredDayOff.replace('-feira', '')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expandable Details Form (Shown only when isExpanded is true) */}
              {isExpanded && (
                <div className="p-4 pt-2 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/80 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Action row (Visibility & Delete) */}
                  {!isReadOnly && (
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/60 dark:border-zinc-800">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Configurações Detalhadas</span>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => onUpdateEmployee(emp.id, { isHidden: !emp.isHidden })}
                          className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1 border ${
                            emp.isHidden 
                              ? 'bg-slate-900 text-white border-slate-900' 
                              : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-zinc-700 hover:border-slate-300'
                          }`}
                          title={emp.isHidden ? 'Mostrar na Escala' : 'Ocultar da Escala'}
                        >
                          <Icon name={emp.isHidden ? 'visibility_off' : 'visibility'} className="text-xs" />
                          <span>{emp.isHidden ? 'Oculto' : 'Visível'}</span>
                        </button>
                        <button 
                          onClick={async () => {
                            const confirmed = await showDialog({
                              type: 'confirm',
                              message: `Excluir ${emp.name} permanentemente?`
                            });
                            if (confirmed) onDeleteEmployee(emp.id);
                          }}
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-transparent hover:border-rose-200 transition-all"
                          title="Excluir Colaborador"
                        >
                          <Icon name="delete" className="text-sm" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Name Edit */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 block mb-1">Nome Completo</label>
                    <input
                      type="text"
                      value={emp.name}
                      disabled={isReadOnly}
                      onChange={(e) => onUpdateEmployee(emp.id, { name: e.target.value })}
                      placeholder="Nome do Colaborador"
                      className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-black text-slate-900 dark:text-slate-100 uppercase outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>

                  {/* Horário Base & Folga Fixa */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Horário Base</label>
                      <select
                        value={emp.workPeriod}
                        disabled={isReadOnly}
                        onChange={(e) => onUpdateEmployee(emp.id, { workPeriod: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        {emp.isYoungApprentice ? (
                          <option value={APPRENTICE_WORK_PERIOD}>{APPRENTICE_WORK_PERIOD}</option>
                        ) : (
                          SHIFT_HOURS.WEEKDAY.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))
                        )}
                        {!emp.isYoungApprentice && !SHIFT_HOURS.WEEKDAY.includes(emp.workPeriod) && emp.workPeriod && (
                          <option value={emp.workPeriod}>{emp.workPeriod}</option>
                        )}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Folga Fixa</label>
                      <select
                        value={emp.preferredDayOff}
                        disabled={isReadOnly}
                        onChange={(e) => onUpdateEmployee(emp.id, { preferredDayOff: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="">Nenhuma</option>
                        {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Aniversário & Cargo */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Aniversário</label>
                      <input
                        type="date"
                        value={emp.birthday || ''}
                        disabled={isReadOnly}
                        onChange={(e) => onUpdateEmployee(emp.id, { birthday: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Cargo</label>
                      <select
                        value={emp.cargo || 'Atendente'}
                        disabled={isReadOnly}
                        onChange={(e) => onUpdateEmployee(emp.id, { cargo: e.target.value as any })}
                        className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none"
                      >
                        {CARGO_OPTIONS.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Contrato & Jornada */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Contrato</label>
                      <select
                        value={emp.contractType || 'CLT'}
                        disabled={isReadOnly}
                        onChange={(e) => onUpdateEmployee(emp.id, { contractType: e.target.value as any })}
                        className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none"
                      >
                        <option value="CLT">CLT</option>
                        <option value="Sazonal">Sazonal</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Jornada</label>
                      <select
                        value={emp.jornada || '6x1'}
                        disabled={isReadOnly}
                        onChange={(e) => onUpdateEmployee(emp.id, { jornada: e.target.value as any })}
                        className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none"
                      >
                        <option value="6x1">6x1</option>
                        <option value="5x2">5x2</option>
                      </select>
                    </div>
                  </div>

                  {/* Posições Táticas Preferenciais */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Posição Pref. 1</label>
                      <select
                        value={emp.preferredPosition1 || ''}
                        disabled={isReadOnly}
                        onChange={(e) => onUpdateEmployee(emp.id, { preferredPosition1: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none"
                      >
                        <option value="">Nenhuma</option>
                        {['P1', 'P2', 'P3', 'P4', 'ESTQ'].map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Posição Pref. 2</label>
                      <select
                        value={emp.preferredPosition2 || ''}
                        disabled={isReadOnly}
                        onChange={(e) => onUpdateEmployee(emp.id, { preferredPosition2: e.target.value })}
                        className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none"
                      >
                        <option value="">Nenhuma</option>
                        {['P1', 'P2', 'P3', 'P4', 'ESTQ'].map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Jovem Aprendiz Toggle */}
                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${emp.isYoungApprentice ? 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300' : 'bg-slate-100 text-slate-400 dark:bg-zinc-700'}`}>
                        <Icon name="child_care" className="text-sm" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase leading-none">Jovem Aprendiz</span>
                        {emp.isYoungApprentice && (
                          <span className="text-[9px] text-sky-600 dark:text-sky-400 font-bold uppercase mt-0.5">
                            Curso: {emp.courseDay || 'Segunda-feira'}
                          </span>
                        )}
                      </div>
                    </div>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => onUpdateEmployee(emp.id, { isYoungApprentice: !emp.isYoungApprentice })}
                        className={`w-8 h-4 rounded-full transition-all relative ${emp.isYoungApprentice ? 'bg-sky-500' : 'bg-slate-300 dark:bg-zinc-600'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${emp.isYoungApprentice ? 'left-4.5' : 'left-0.5'}`}></div>
                      </button>
                    )}
                  </div>

                  {/* Férias */}
                  {!emp.isYoungApprentice && (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Férias (Início)</label>
                      <input
                        type="date"
                        value={emp.vacationStart || ''}
                        disabled={isReadOnly}
                        onChange={(e) => handleVacationStart(emp, e.target.value, onUpdateEmployee)}
                        className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none"
                      />
                      {emp.vacationStart && emp.vacationEnd && (
                        <div className="bg-sky-50 dark:bg-sky-950/40 p-2 rounded-lg border border-sky-100 dark:border-sky-900/50 flex items-center justify-between text-[9px] font-bold text-sky-700 dark:text-sky-300">
                          <span>Fim: {new Date(emp.vacationEnd + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                          <span>Retorno: {new Date(addDays(emp.vacationEnd, 1) + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Senha Individual */}
                  {!isReadOnly && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Senha Individual</label>
                        <button 
                          type="button"
                          onClick={() => onUpdateEmployee(emp.id, { password: '1234' })}
                          className="text-[8px] font-black text-orange-500 hover:underline uppercase"
                        >
                          Resetar (1234)
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={emp.password || ''}
                          onChange={(e) => onUpdateEmployee(emp.id, { password: e.target.value })}
                          placeholder="Padrão: 1234"
                          className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 outline-none"
                        />
                        <Icon name="lock" className="absolute right-3 top-2.5 text-slate-400 text-xs" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
