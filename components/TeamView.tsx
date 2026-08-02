
import React, { useState } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Employee, EmployeeCargo } from '../types';
import { Icon } from './Icon';
import { SHIFT_HOURS, APPRENTICE_WORK_PERIOD, PLACEHOLDER_EMPLOYEE_ID } from '../constants';

interface TeamViewProps {
  employees: Employee[];
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

  // Automatic sync: Update shifts in affected months
  const startObj = new Date(startDate + 'T00:00:00');
  const endObj = new Date(endDate + 'T00:00:00');
  
  const newShifts = { ...emp.shifts };
  
  // Iterate through affected months
  let current = new Date(startObj.getFullYear(), startObj.getMonth(), 1);
  while (current <= endObj) {
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    const shifts = [...(newShifts[monthKey] || [])];
    const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    
    // Ensure array is initialized
    if (shifts.length === 0) {
      for (let i = 0; i < daysInMonth; i++) shifts[i] = 'T';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (dStr >= startDate && dStr <= endDate) {
        shifts[d - 1] = 'FE';
      } else if (shifts[d - 1] === 'FE') {
        // Clear old FE if they are now outside the range
        shifts[d - 1] = 'T';
      }
    }
    newShifts[monthKey] = shifts;
    current.setMonth(current.getMonth() + 1);
  }
  
  updates.shifts = newShifts;
  onUpdate(emp.id, updates);
}

/** When user sets atestado start and duration, compute end = start + days - 1 */
function handleAtestadoChange(emp: Employee, startDate: string, duration: number, onUpdate: (id: string, data: Partial<Employee>) => void) {
  if (!startDate || duration <= 0) {
    const newShifts = { ...emp.shifts };
    let hasChanges = false;
    for (const [mKey, shiftArr] of Object.entries(newShifts)) {
      if (Array.isArray(shiftArr) && shiftArr.includes('AT')) {
        newShifts[mKey] = shiftArr.map(s => s === 'AT' ? 'T' : s);
        hasChanges = true;
      }
    }
    const updates: Partial<Employee> = { atestadoStart: '', atestadoEnd: '' };
    if (hasChanges) updates.shifts = newShifts;
    onUpdate(emp.id, updates);
    return;
  }
  
  const endDate = addDays(startDate, duration - 1);
  const updates: Partial<Employee> = { atestadoStart: startDate, atestadoEnd: endDate };

  // Automatic sync: Update shifts in affected months
  const startObj = new Date(startDate + 'T00:00:00');
  const endObj = new Date(endDate + 'T00:00:00');
  
  const newShifts = { ...emp.shifts };
  
  // Iterate through affected months
  let current = new Date(startObj.getFullYear(), startObj.getMonth(), 1);
  while (current <= endObj) {
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    const shifts = [...(newShifts[monthKey] || [])];
    const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    
    // Ensure array is initialized
    if (shifts.length === 0) {
      for (let i = 0; i < daysInMonth; i++) shifts[i] = 'T';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (dStr >= startDate && dStr <= endDate) {
        shifts[d - 1] = 'AT';
      } else if (shifts[d - 1] === 'AT') {
        // Clear old AT if they are now outside the range
        shifts[d - 1] = 'T';
      }
    }
    newShifts[monthKey] = shifts;
    current.setMonth(current.getMonth() + 1);
  }
  
  updates.shifts = newShifts;
  onUpdate(emp.id, updates);
}

export const TeamView: React.FC<TeamViewProps> = ({ employees, onUpdateEmployee, onDeleteEmployee, onAddEmployee }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [isYoung, setIsYoung] = useState(false);
  const [courseDay, setCourseDay] = useState('Segunda-feira');
  const [newCargo, setNewCargo] = useState<EmployeeCargo>('Atendente');
  const [newBirthday, setNewBirthday] = useState('');
  const [newContractType, setNewContractType] = useState<'CLT' | 'Sazonal'>('CLT');
  const [newJornada, setNewJornada] = useState<'6x1' | '5x2'>('6x1');

  const { showDialog } = useDialog();

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
    <div className="flex flex-col gap-8 animate-fade-in">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
           <h3 className="text-2xl font-extrabold text-slate-900">Equipe Operacional</h3>
           <p className="text-sm font-bold text-slate-400">Adicione, remova ou edite dados contratuais dos colaboradores.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-extrabold text-sm shadow-md hover:bg-orange-600 transition-all flex items-center gap-2"
        >
          <Icon name="person_add" /> Novo Colaborador
        </button>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl overflow-y-auto max-h-[90vh]">
            <h4 className="text-xl font-extrabold text-slate-900 mb-6">Cadastrar Colaborador</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Nome Completo</label>
                <input autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Nome do colaborador" />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Data de Nascimento (Aniversário)</label>
                <input type="date" value={newBirthday} onChange={(e) => setNewBirthday(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Contrato</label>
                  <select value={newContractType} onChange={(e) => setNewContractType(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm focus:ring-2 focus:ring-orange-500 outline-none text-slate-700">
                    <option value="CLT">CLT</option>
                    <option value="Sazonal">Sazonal</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Jornada</label>
                  <select value={newJornada} onChange={(e) => setNewJornada(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm focus:ring-2 focus:ring-orange-500 outline-none text-slate-700">
                    <option value="6x1">6x1</option>
                    <option value="5x2">5x2</option>
                  </select>
                </div>
              </div>

              {/* Cargo */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Cargo</label>
                <div className="flex gap-2">
                  {CARGO_OPTIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setNewCargo(c);
                        if (c === 'Aprendiz') {
                          setIsYoung(true);
                          // No App.tsx, a lógica de folga para aprendiz é tratada, 
                          // mas aqui podemos sinalizar ou ajustar se necessário.
                        } else if (c === 'Estoquista') {
                          setIsYoung(false);
                        } else {
                          setIsYoung(false);
                        }
                      }}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold border transition-all ${
                        newCargo === c
                          ? 'bg-orange-500 text-white border-orange-500 shadow'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-orange-300'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <input type="checkbox" id="isYoung" checked={isYoung} onChange={(e) => setIsYoung(e.target.checked)} className="w-5 h-5 accent-orange-500 rounded" />
                <label htmlFor="isYoung" className="text-sm font-extrabold text-slate-700">Jovem Aprendiz</label>
              </div>

              {isYoung && (
                <div className="animate-fade-in p-4 bg-sky-50 border border-sky-100 rounded-xl space-y-3">
                    <div>
                      <label className="text-[10px] font-extrabold text-sky-600 uppercase tracking-widest block mb-1">Dia do Curso (Presencial/EAD)</label>
                      <select value={courseDay} onChange={(e) => setCourseDay(e.target.value)} className="w-full bg-white border border-sky-200 rounded-xl p-3 font-bold text-sm outline-none text-sky-900">
                          {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].map(d => <option key={d}>{d}</option>)}
                      </select>
                      <p className="text-[9px] text-sky-400 mt-2 font-bold uppercase tracking-tight">Nota: Aprendizes terão folgas fixas aos Sábados e Domingos automaticamente.</p>
                    </div>
                </div>
              )}

              {newCargo === 'Estoquista' && !isYoung && (
                <div className="animate-fade-in p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-tight flex items-center gap-2">
                    <Icon name="info" className="text-sm" /> Estoquistas possuem folga fixa aos Domingos por padrão.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-6 py-3 border border-slate-200 rounded-xl font-extrabold text-slate-400 hover:bg-slate-50 transition-all">Cancelar</button>
                <button type="submit" className="flex-1 px-6 py-3 bg-orange-500 text-white rounded-xl font-extrabold shadow-lg hover:bg-orange-600 transition-all">Cadastrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto max-h-[calc(100vh-260px)] custom-scrollbar pr-1">
        {employees.map(emp => (
          <div key={emp.id} className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
            {/* Status indicator */}
            <div className={`absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 rotate-45 ${emp.status === 'active' ? 'bg-green-500' : 'bg-slate-200'} opacity-10`}></div>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black text-sm shadow-sm uppercase group-hover:scale-110 transition-transform">
                {emp.name.substring(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={emp.name}
                  onChange={(e) => onUpdateEmployee(emp.id, { name: e.target.value })}
                  placeholder="Nome do Colaborador"
                  className="w-full text-base font-black text-slate-900  bg-transparent border-none p-0 focus:ring-0 placeholder-slate-300  uppercase"
                />
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{emp.cargo || 'Atendente'}</span>
                   {emp.contractType === 'Sazonal' && (
                     <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-600 font-bold uppercase tracking-wider">Sazonal</span>
                   )}
                   {emp.jornada === '5x2' && (
                     <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-600 font-bold uppercase tracking-wider">5x2</span>
                   )}
                   <div className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mb-4">
                <button 
                  onClick={() => onUpdateEmployee(emp.id, { isHidden: !emp.isHidden })}
                  className={`w-7 h-7 rounded-lg transition-all flex items-center justify-center border ${
                    emp.isHidden 
                      ? 'bg-slate-900 text-white border-slate-900' 
                      : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                  }`}
                  title={emp.isHidden ? 'Mostrar na Escala' : 'Ocultar da Escala'}
                >
                  <Icon name={emp.isHidden ? 'visibility_off' : 'visibility'} className="text-sm" />
                </button>
                <button 
                  onClick={async () => {
                    const confirmed = await showDialog({
                      type: 'confirm',
                      message: `Excluir ${emp.name} permanentemente?`
                    });
                    if (confirmed) onDeleteEmployee(emp.id);
                  }}
                  className="w-8 h-8 rounded-lg transition-all flex items-center justify-center border bg-red-50  text-red-500  border-red-100  hover:bg-red-500 hover:text-white"
                >
                  <Icon name="delete" className="text-sm" />
                </button>
              </div>

              <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400  uppercase tracking-widest pl-1">Horário Base</label>
                  <select
                    value={emp.workPeriod}
                    onChange={(e) => onUpdateEmployee(emp.id, { workPeriod: e.target.value })}
                    className="w-full bg-slate-50  border border-slate-100  rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700  focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                  >
                    {emp.isYoungApprentice ? (
                      <option value={APPRENTICE_WORK_PERIOD}>{APPRENTICE_WORK_PERIOD}</option>
                    ) : (
                      SHIFT_HOURS.WEEKDAY.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))
                    )}
                    {/* Fallback: se o horário cadastrado não está na lista padrão, mostra ele mesmo */}
                    {!emp.isYoungApprentice && !SHIFT_HOURS.WEEKDAY.includes(emp.workPeriod) && emp.workPeriod && (
                      <option value={emp.workPeriod}>{emp.workPeriod}</option>
                    )}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400  uppercase tracking-widest pl-1">Folga Fixa</label>
                  <select
                    value={emp.preferredDayOff}
                    onChange={(e) => onUpdateEmployee(emp.id, { preferredDayOff: e.target.value })}
                    className="w-full bg-slate-50  border border-slate-100  rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700  focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                  >
                    <option value="">Nenhuma</option>
                    {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400  uppercase tracking-widest pl-1">Aniversário</label>
                    <input
                      type="date"
                      value={emp.birthday}
                      onChange={(e) => onUpdateEmployee(emp.id, { birthday: e.target.value })}
                      className="w-full bg-slate-50  border border-slate-100  rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700  focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400  uppercase tracking-widest pl-1">Cargo</label>
                   <select
                      value={emp.cargo}
                      onChange={(e) => onUpdateEmployee(emp.id, { cargo: e.target.value as any })}
                      className="w-full bg-slate-50  border border-slate-100  rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700  focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                    >
                      <option value="Atendente">Atendente</option>
                      <option value="Estoquista">Estoquista</option>
                      <option value="Aprendiz">Aprendiz</option>
                      <option value="Fiscal">Fiscal</option>
                    </select>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Contrato</label>
                   <select
                      value={emp.contractType || 'CLT'}
                      onChange={(e) => onUpdateEmployee(emp.id, { contractType: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                    >
                      <option value="CLT">CLT</option>
                      <option value="Sazonal">Sazonal</option>
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Jornada</label>
                   <select
                      value={emp.jornada || '6x1'}
                      onChange={(e) => onUpdateEmployee(emp.id, { jornada: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                    >
                      <option value="6x1">6x1</option>
                      <option value="5x2">5x2</option>
                    </select>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400  uppercase tracking-widest pl-1">Posição Pref. 1</label>
                    <select
                      value={emp.preferredPosition1 || ''}
                      onChange={(e) => onUpdateEmployee(emp.id, { preferredPosition1: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                    >
                      <option value="">Nenhuma</option>
                      {['P1', 'P2', 'P3', 'P4', 'ESTQ'].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400  uppercase tracking-widest pl-1">Posição Pref. 2</label>
                    <select
                      value={emp.preferredPosition2 || ''}
                      onChange={(e) => onUpdateEmployee(emp.id, { preferredPosition2: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                    >
                      <option value="">Nenhuma</option>
                      {['P1', 'P2', 'P3', 'P4', 'ESTQ'].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                 </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-slate-50  rounded-xl border border-dashed border-slate-200 ">
                <div className="flex items-center gap-2">
                   <div className={`p-1.5 rounded-lg ${emp.isYoungApprentice ? 'bg-sky-100 text-sky-600' : 'bg-slate-200 text-slate-400'}`}>
                      <Icon name="child_care" className="text-sm" />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-700  uppercase leading-none">Jovem Aprendiz</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">Dia do Curso:</span>
                      {emp.isYoungApprentice && (
                        <select
                          value={emp.courseDay}
                          onChange={(e) => onUpdateEmployee(emp.id, { courseDay: e.target.value })}
                          className="bg-transparent border-none p-0 text-[10px] font-bold text-sky-600  focus:ring-0 outline-none"
                        >
                          <option value="">Sem Curso</option>
                          {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'].map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onUpdateEmployee(emp.id, { isYoungApprentice: !emp.isYoungApprentice })}
                    className={`w-8 h-4 rounded-full transition-all relative ${emp.isYoungApprentice ? 'bg-sky-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${emp.isYoungApprentice ? 'left-4.5' : 'left-0.5'}`}></div>
                  </button>
                </div>

                {!emp.isYoungApprentice && (
                  <div className="space-y-2 pt-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Férias (Início)</label>
                    <input
                      type="date"
                      value={emp.vacationStart || ''}
                      onChange={(e) => handleVacationStart(emp, e.target.value, onUpdateEmployee)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                    />
                    {emp.vacationStart && emp.vacationEnd && (
                      <div className="bg-sky-50 p-2 rounded-lg border border-sky-100 flex items-center justify-between mt-1">
                         <span className="text-[8px] font-black text-sky-600 uppercase">Fim das Férias:</span>
                         <span className="text-[9px] font-black text-sky-700 uppercase">
                            {new Date(emp.vacationEnd + 'T00:00:00').toLocaleDateString('pt-BR')}
                         </span>
                      </div>
                    )}
                    {emp.vacationEnd && (
                      <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100 flex items-center justify-between">
                         <span className="text-[8px] font-black text-emerald-600 uppercase">Retorno Previsto:</span>
                         <span className="text-[9px] font-black text-emerald-700 uppercase">
                            {new Date(addDays(emp.vacationEnd, 1) + 'T00:00:00').toLocaleDateString('pt-BR')}
                         </span>
                      </div>
                    )}
                    {emp.vacationEnd && (
                      <button 
                        onClick={() => handleVacationStart(emp, emp.vacationStart!, onUpdateEmployee)}
                        className="w-full py-2 bg-sky-100 hover:bg-sky-200 text-sky-600 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 mt-1"
                      >
                        <Icon name="sync" className="text-xs" /> Sincronizar com a Grade
                      </button>
                    )}
                  </div>
                )}

                {/* Atestado Médico */}
                <div className="space-y-2 pt-3 border-t border-slate-100 mt-2">
                  <div className="flex items-center gap-1.5 px-1">
                    <Icon name="medical_services" className="text-rose-500 text-xs" />
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Atestado Médico</label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold text-slate-400 pl-1">Início / Entrega</span>
                      <input
                        type="date"
                        value={emp.atestadoStart || ''}
                        onChange={(e) => {
                          const duration = emp.atestadoStart && emp.atestadoEnd ? (Math.round((new Date(emp.atestadoEnd + 'T00:00:00').getTime() - new Date(e.target.value + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)) + 1) : 1;
                          handleAtestadoChange(emp, e.target.value, Math.max(1, duration), onUpdateEmployee);
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold text-slate-400 pl-1">Duração (Dias)</span>
                      <input
                        type="number"
                        min="0"
                        value={emp.atestadoStart && emp.atestadoEnd ? (Math.round((new Date(emp.atestadoEnd + 'T00:00:00').getTime() - new Date(emp.atestadoStart + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)) + 1) : 0}
                        onChange={(e) => handleAtestadoChange(emp, emp.atestadoStart || '', parseInt(e.target.value) || 0, onUpdateEmployee)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                        placeholder="Ex: 3"
                      />
                    </div>
                  </div>
                  {emp.atestadoEnd && (
                    <div className="space-y-2">
                      <div className="bg-rose-50 p-2 rounded-lg border border-rose-100 flex items-center justify-between">
                         <span className="text-[8px] font-black text-rose-600 uppercase">Retorno previsto:</span>
                         <span className="text-[9px] font-black text-rose-700 uppercase">
                            {new Date(addDays(emp.atestadoEnd, 1) + 'T00:00:00').toLocaleDateString('pt-BR')}
                         </span>
                      </div>
                      <button 
                        onClick={() => {
                          const duration = (Math.round((new Date(emp.atestadoEnd! + 'T00:00:00').getTime() - new Date(emp.atestadoStart! + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)) + 1);
                          handleAtestadoChange(emp, emp.atestadoStart!, duration, onUpdateEmployee);
                        }}
                        className="w-full py-2 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2"
                      >
                        <Icon name="sync" className="text-xs" /> Sincronizar com a Grade
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1 pt-2">
                   <div className="flex justify-between items-center px-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Senha de Acesso</label>
                      <button 
                        onClick={() => onUpdateEmployee(emp.id, { password: '1234' })}
                        className="text-[8px] font-black text-orange-500 uppercase"
                      >
                        Resetar (1234)
                      </button>
                   </div>
                   <div className="relative">
                      <input
                        type="text"
                        value={emp.password || ''}
                        onChange={(e) => onUpdateEmployee(emp.id, { password: e.target.value })}
                        placeholder="Sem senha definida"
                        className="w-full bg-slate-900 text-white border border-slate-800 rounded-xl px-3 py-2 text-[11px] font-bold focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                      />
                      <div className="absolute right-3 top-2.5">
                         <Icon name="lock" className="text-slate-600 text-[10px]" />
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
