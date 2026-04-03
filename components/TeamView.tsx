
import React, { useState } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Employee, EmployeeCargo } from '../types';
import { Icon } from './Icon';
import { SHIFT_HOURS, APPRENTICE_WORK_PERIOD } from '../constants';

interface TeamViewProps {
  employees: Employee[];
  onUpdateEmployee: (empId: string, data: Partial<Employee>) => void;
  handleDeleteEmployee: (empId: string) => void;
  onAddEmployee: (name: string, isYoung: boolean, courseDay: string, cargo: EmployeeCargo, birthday: string) => void;
}

const CARGO_OPTIONS: EmployeeCargo[] = ['Auxiliar de Loja', 'Estoquista', 'Operador de Caixa', 'Vendedor'];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function handleVacationStart(empId: string, startDate: string, onUpdate: (id: string, data: Partial<Employee>) => void) {
  if (!startDate) {
    onUpdate(empId, { vacationStart: '', vacationEnd: '' });
    return;
  }
  const endDate = addDays(startDate, 30);
  onUpdate(empId, { vacationStart: startDate, vacationEnd: endDate });
}

export const TeamView: React.FC<TeamViewProps> = ({ employees, onUpdateEmployee, handleDeleteEmployee, onAddEmployee }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [isYoung, setIsYoung] = useState(false);
  const [courseDay, setCourseDay] = useState('Segunda-feira');
  const [newCargo, setNewCargo] = useState<EmployeeCargo>('Auxiliar de Loja');
  const [newBirthday, setNewBirthday] = useState('');

  const { showDialog } = useDialog();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      const confirmed = await showDialog({
        type: 'confirm',
        message: `Deseja cadastrar o colaborador ${newName.toUpperCase()}?`
      });
      if (confirmed) {
        onAddEmployee(newName.toUpperCase(), isYoung, courseDay, newCargo, newBirthday);
        setNewName('');
        setIsYoung(false);
        setNewCargo('Auxiliar de Loja');
        setNewBirthday('');
        setShowAddModal(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      
      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl overflow-y-auto max-h-[90vh] border border-slate-200">
            <h4 className="text-2xl font-black text-slate-900 mb-8 tracking-tight">Cadastrar Colaborador</h4>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nome Completo</label>
                <input autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all placeholder:text-slate-300" placeholder="Ex: JOÃO SILVA" />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Data de Nascimento</label>
                <input type="date" value={newBirthday} onChange={(e) => setNewBirthday(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Cargo</label>
                <select value={newCargo} onChange={(e) => setNewCargo(e.target.value as EmployeeCargo)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all">
                  {CARGO_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="isYoung" checked={isYoung} onChange={(e) => setIsYoung(e.target.checked)} className="w-5 h-5 accent-orange-500 rounded-lg cursor-pointer" />
                  <label htmlFor="isYoung" className="text-sm font-black text-slate-700 cursor-pointer">Jovem Aprendiz</label>
                </div>
              </div>

              {isYoung && (
                <div className="animate-fade-in space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Dia de Curso</label>
                    <select value={courseDay} onChange={(e) => setCourseDay(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm outline-none focus:ring-2 focus:ring-sky-500 transition-all">
                        {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].map(d => <option key={d}>{d}</option>)}
                    </select>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-6 py-4 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">Cancelar</button>
                <button type="submit" className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-orange-500 transition-all active:scale-95">Cadastrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {employees.map(emp => (
          <div key={emp.id} className={`bg-white rounded-3xl border p-6 shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col ${emp.isHidden ? 'opacity-60 grayscale' : 'border-slate-200'}`}>
            
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-[1.25rem] bg-orange-100 text-orange-600 flex items-center justify-center font-black text-xl shadow-sm uppercase group-hover:scale-105 transition-transform">
                  {emp.name.substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={emp.name}
                    onChange={(e) => onUpdateEmployee(emp.id, { name: e.target.value })}
                    placeholder="NOME DO COLABORADOR"
                    className="w-full text-lg font-black text-slate-900 bg-transparent border-none p-0 focus:ring-0 placeholder-slate-200 uppercase truncate"
                  />
                  <div className="flex items-center gap-2 mt-0.5">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{emp.cargo || 'Auxiliar de Loja'}</span>
                     <div className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                  <button 
                    onClick={() => onUpdateEmployee(emp.id, { isHidden: !emp.isHidden })}
                    className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center border ${
                      emp.isHidden 
                        ? 'bg-slate-950 text-white border-slate-950' 
                        : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-slate-600'
                    }`}
                    title={emp.isHidden ? 'Mostrar na Escala' : 'Ocultar da Escala'}
                  >
                    <Icon name={emp.isHidden ? 'visibility_off' : 'visibility'} className="text-sm" />
                  </button>
                  <button 
                    onClick={async () => {
                      const confirmed = await showDialog({
                        type: 'confirm',
                        message: `Deseja EXCLUIR ${emp.name} permanentemente? Esta ação não pode ser desfeita.`
                      });
                      if (confirmed) handleDeleteEmployee(emp.id);
                    }}
                    className="w-9 h-9 rounded-xl transition-all flex items-center justify-center border bg-rose-50 text-rose-500 border-rose-100 hover:bg-rose-500 hover:text-white"
                  >
                    <Icon name="delete" className="text-sm" />
                  </button>
              </div>
            </div>

            <div className="space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Horário Base</label>
                  <select
                    value={emp.workPeriod}
                    onChange={(e) => onUpdateEmployee(emp.id, { workPeriod: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-black text-slate-700 focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                  >
                    {emp.isYoungApprentice ? (
                      <option value={APPRENTICE_WORK_PERIOD}>{APPRENTICE_WORK_PERIOD}</option>
                    ) : (
                      SHIFT_HOURS.WEEKDAY.map(h => <option key={h} value={h}>{h}</option>)
                    )}
                    {!emp.isYoungApprentice && !SHIFT_HOURS.WEEKDAY.includes(emp.workPeriod) && emp.workPeriod && (
                      <option value={emp.workPeriod}>{emp.workPeriod}</option>
                    )}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Folga Fixa</label>
                  <select
                    value={emp.preferredDayOff}
                    onChange={(e) => onUpdateEmployee(emp.id, { preferredDayOff: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-black text-slate-700 focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                  >
                    <option value="">Nenhuma</option>
                    {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Aniversário</label>
                    <input
                      type="date"
                      value={emp.birthday}
                      onChange={(e) => onUpdateEmployee(emp.id, { birthday: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-black text-slate-700 focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Cargo</label>
                    <select
                      value={emp.cargo}
                      onChange={(e) => onUpdateEmployee(emp.id, { cargo: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-black text-slate-700 focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                    >
                      {CARGO_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                 </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                <div className="flex items-center gap-3">
                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${emp.isYoungApprentice ? 'bg-sky-100 text-sky-600' : 'bg-slate-200 text-slate-400'}`}>
                      <Icon name="face" className="text-sm" />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-500 uppercase leading-none mb-1">Tipo de Contrato</span>
                      <span className="text-[10px] font-black text-slate-800 uppercase">{emp.isYoungApprentice ? 'Jovem Aprendiz' : 'CLT Regula'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onUpdateEmployee(emp.id, { isYoungApprentice: !emp.isYoungApprentice })}
                    className={`w-10 h-5 rounded-full transition-all relative ${emp.isYoungApprentice ? 'bg-sky-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${emp.isYoungApprentice ? 'left-6' : 'left-1'}`}></div>
                  </button>
              </div>

              {!emp.isYoungApprentice && (
                <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                  <div className="flex items-center gap-2 mb-2">
                     <Icon name="event_upcoming" className="text-sm text-orange-500" />
                     <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">Controle de Férias</span>
                  </div>
                  <input
                    type="date"
                    value={emp.vacationStart || ''}
                    onChange={(e) => handleVacationStart(emp.id, e.target.value, onUpdateEmployee)}
                    className="w-full bg-white/60 border border-orange-200 rounded-lg px-3 py-2 text-[10px] font-black text-orange-800 outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  {emp.vacationStart && (
                    <p className="text-[8px] font-bold text-orange-500 mt-2 flex items-center gap-1">
                       <Icon name="info" className="text-[10px]" /> Retorno previsto em {emp.vacationEnd?.split('-').reverse().join('/')}
                    </p>
                  )}
                </div>
              )}

              {emp.isYoungApprentice && (
                <div className="bg-sky-50 p-4 rounded-2xl border border-sky-100">
                  <div className="flex items-center gap-2 mb-2">
                     <Icon name="school" className="text-sm text-sky-500" />
                     <span className="text-[9px] font-black text-sky-600 uppercase tracking-widest">Dia de Curso</span>
                  </div>
                  <select
                    value={emp.courseDay}
                    onChange={(e) => onUpdateEmployee(emp.id, { courseDay: e.target.value })}
                    className="w-full bg-white/60 border border-sky-200 rounded-lg px-3 py-2 text-[10px] font-black text-sky-800 outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <option value="">Sem Curso</option>
                    {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
