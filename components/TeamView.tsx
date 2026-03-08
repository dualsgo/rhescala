
import React, { useState } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Employee, EmployeeCargo } from '../types';
import { Icon } from './Icon';
import { SHIFT_HOURS, APPRENTICE_WORK_PERIOD, PLACEHOLDER_EMPLOYEE_ID } from '../constants';

interface TeamViewProps {
  employees: Employee[];
  onUpdateEmployee: (empId: string, data: Partial<Employee>) => void;
  onDeleteEmployee: (empId: string) => void;
  onAddEmployee: (name: string, isYoung: boolean, courseDay: string, cargo: EmployeeCargo, birthday: string) => void;
}

const CARGO_OPTIONS: EmployeeCargo[] = ['Auxiliar de Loja', 'Estoquista'];

/** Adds `days` calendar days to a YYYY-MM-DD string and returns YYYY-MM-DD */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** When user sets vacation start (saída), auto-compute end = start + 30 days */
function handleVacationStart(empId: string, startDate: string, onUpdate: (id: string, data: Partial<Employee>) => void) {
  if (!startDate) {
    onUpdate(empId, { vacationStart: '', vacationEnd: '' });
    return;
  }
  const endDate = addDays(startDate, 30);
  onUpdate(empId, { vacationStart: startDate, vacationEnd: endDate });
}

export const TeamView: React.FC<TeamViewProps> = ({ employees, onUpdateEmployee, onDeleteEmployee, onAddEmployee }) => {
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
        message: `Deseja cadastrar o colaborador ${newName}?`
      });
      if (confirmed) {
        onAddEmployee(newName, isYoung, courseDay, newCargo, newBirthday);
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

              {/* Cargo */}
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Cargo</label>
                <div className="flex gap-2">
                  {CARGO_OPTIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCargo(c)}
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
                <div className="animate-fade-in">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Dia de Curso</label>
                    <select value={courseDay} onChange={(e) => setCourseDay(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none">
                        {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].map(d => <option key={d}>{d}</option>)}
                    </select>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {employees.map(emp => (
          <div key={emp.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
            {/* Status indicator */}
            <div className={`absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 rotate-45 ${emp.status === 'active' ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-600'} opacity-10`}></div>
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black shadow-sm uppercase group-hover:scale-110 transition-transform">
                {emp.name.substring(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={emp.name}
                  onChange={(e) => onUpdateEmployee(emp.id, { name: e.target.value })}
                  placeholder="Nome do Colaborador"
                  className="w-full text-base font-black text-slate-900 dark:text-slate-100 bg-transparent border-none p-0 focus:ring-0 placeholder-slate-300 dark:placeholder-slate-600 uppercase"
                />
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{emp.cargo || 'Auxiliar de Loja'}</span>
                   <div className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mb-4">
                <button 
                  onClick={() => onUpdateEmployee(emp.id, { isHidden: !emp.isHidden })}
                  className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center border ${
                    emp.isHidden 
                      ? 'bg-slate-900 text-white border-slate-900' 
                      : 'bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-300 border-slate-100 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
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
                  className="w-8 h-8 rounded-lg transition-all flex items-center justify-center border bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 border-red-100 dark:border-red-900 hover:bg-red-500 hover:text-white"
                >
                  <Icon name="delete" className="text-sm" />
                </button>
              </div>

              <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Horário Base</label>
                  <input
                    type="text"
                    value={emp.workPeriod}
                    onChange={(e) => onUpdateEmployee(emp.id, { workPeriod: e.target.value })}
                    placeholder="ex: 10:00 às 18:20"
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Folga Fixa</label>
                  <select
                    value={emp.preferredDayOff}
                    onChange={(e) => onUpdateEmployee(emp.id, { preferredDayOff: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                  >
                    <option value="">Nenhuma</option>
                    {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Aniversário</label>
                    <input
                      type="date"
                      value={emp.birthday}
                      onChange={(e) => onUpdateEmployee(emp.id, { birthday: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Cargo</label>
                    <select
                      value={emp.cargo}
                      onChange={(e) => onUpdateEmployee(emp.id, { cargo: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl px-2 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                    >
                      <option value="Auxiliar de Loja">Auxiliar</option>
                      <option value="Estoquista">Estoquista</option>
                      <option value="Operador de Caixa">Operador</option>
                      <option value="Vendedor">Vendedor</option>
                    </select>
                 </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                   <div className={`p-1.5 rounded-lg ${emp.isYoungApprentice ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                      <Icon name="child_care" className="text-sm" />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase leading-none">Jovem Aprendiz</span>
                      {emp.isYoungApprentice && (
                        <select
                          value={emp.courseDay}
                          onChange={(e) => onUpdateEmployee(emp.id, { courseDay: e.target.value })}
                          className="bg-transparent border-none p-0 text-[10px] font-bold text-sky-600 dark:text-sky-400 focus:ring-0 outline-none"
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
                    className={`w-10 h-5 rounded-full transition-all relative ${emp.isYoungApprentice ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${emp.isYoungApprentice ? 'left-6' : 'left-1'}`}></div>
                  </button>
                </div>

                {!emp.isYoungApprentice && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Férias (Início)</label>
                    <input
                      type="date"
                      value={emp.vacationStart || ''}
                      onChange={(e) => handleVacationStart(emp.id, e.target.value, onUpdateEmployee)}
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-orange-500/20 transition-all outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
