
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
        {employees.map(emp => {
          const isPlaceholder = emp.id === PLACEHOLDER_EMPLOYEE_ID;
          const cargo: EmployeeCargo = emp.cargo ?? 'Auxiliar de Loja';
          return (
          <div key={emp.id} className={`bg-white rounded-xl border shadow-sm p-4 hover:shadow-md transition-all ${
            isPlaceholder ? 'border-dashed border-slate-300 opacity-70' : 'border-slate-200'
          } ${emp.isHidden ? 'opacity-60 bg-slate-50' : ''}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex flex-col min-w-0">
                  <h4 className="font-extrabold text-xs text-slate-900 leading-tight uppercase flex items-center gap-1.5 truncate">
                    <span className="truncate">{emp.name.toUpperCase()}</span>
                    {emp.isHidden && <span className="text-[7px] bg-slate-200 text-slate-500 px-1 py-0.5 rounded uppercase tracking-widest shrink-0">Oculto</span>}
                  </h4>
                  {isPlaceholder ? (
                    <span className="text-[8px] font-extrabold text-amber-500 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                      ⏳ Aguardando...
                    </span>
                  ) : emp.isYoungApprentice ? (
                    <span className="text-[8px] font-extrabold text-teal-600 uppercase tracking-widest mt-0.5">Aprendiz · {emp.courseDay.split('-')[0]}</span>
                  ) : (
                    <span className={`text-[8px] font-extrabold uppercase tracking-widest mt-0.5 ${cargo === 'Estoquista' ? 'text-violet-600' : 'text-slate-400'}`}>
                      {cargo}
                    </span>
                  )}
              </div>
              <div className="flex gap-1.5 shrink-0 ml-2">
                <button 
                  disabled={isPlaceholder}
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
                  disabled={isPlaceholder}
                  onClick={async () => {
                    const confirmed = await showDialog({
                      type: 'confirm',
                      message: `Excluir ${emp.name} permanentemente?`
                    });
                    if (confirmed) onDeleteEmployee(emp.id);
                  }}
                  className={`w-7 h-7 rounded-lg transition-all flex items-center justify-center border ${
                    isPlaceholder
                      ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                      : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border-red-100'
                  }`}
                >
                  <Icon name="delete" className="text-sm" />
                </button>
              </div>
            </div>

            {!isPlaceholder && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    {/* ── Aniversário ── */}
                    <div>
                    <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block mb-0.5">Aniversário</label>
                    <input
                        type="date"
                        value={emp.birthday || ''}
                        onChange={(e) => onUpdateEmployee(emp.id, { birthday: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold p-1.5 outline-none focus:ring-1 focus:ring-orange-500"
                    />
                    </div>

                    {/* ── Folga Fixa Sugerida ── */}
                    <div>
                    <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block mb-0.5">Folga Sugerida</label>
                    <select value={emp.preferredDayOff} onChange={(e) => onUpdateEmployee(emp.id, { preferredDayOff: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold p-1.5 outline-none focus:ring-1 focus:ring-orange-500">
                        {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'].map(d => <option key={d}>{d.split('-')[0]}</option>)}
                    </select>
                    </div>
                </div>

                {/* ── Cargo ou Curso ── */}
                {!emp.isYoungApprentice ? (
                  <div>
                    <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block mb-0.5">Cargo Operacional</label>
                    <div className="flex gap-1.5">
                      {CARGO_OPTIONS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => onUpdateEmployee(emp.id, { cargo: c })}
                          className={`flex-1 py-1.5 rounded-lg text-[9px] font-extrabold border transition-all ${
                            cargo === c
                              ? c === 'Estoquista'
                                ? 'bg-violet-500 text-white border-violet-500 shadow-sm'
                                : 'bg-orange-500 text-white border-orange-500 shadow-sm'
                              : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-orange-200'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                    <div>
                        <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block mb-0.5">Dia de Curso</label>
                        <select 
                        value={emp.courseDay} 
                        onChange={(e) => onUpdateEmployee(emp.id, { courseDay: e.target.value })} 
                        className="w-full bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold p-1.5 outline-none focus:ring-1 focus:ring-teal-500"
                        >
                        {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                )}

                {/* ── Horário ou Férias ── */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block mb-0.5">Horário Base</label>
                        {emp.isYoungApprentice ? (
                            <div className="w-full bg-teal-50 border border-teal-100 rounded-lg text-[9px] font-bold p-1.5 text-teal-700 truncate">
                                {APPRENTICE_WORK_PERIOD.split(' (')[0]}
                            </div>
                        ) : (
                            <select 
                                value={emp.workPeriod} 
                                onChange={(e) => {
                                    const wp = e.target.value;
                                    const sn = wp.includes('10h') ? 'Abertura' : wp.includes('12h') ? 'Intermediário' : 'Fechamento';
                                    onUpdateEmployee(emp.id, { workPeriod: wp, shiftName: sn });
                                }} 
                                className="w-full bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold p-1.5 outline-none focus:ring-1 focus:ring-orange-500"
                            >
                                {SHIFT_HOURS.WEEKDAY.map(h => <option key={h} value={h}>{h.includes('13h40') ? '13:40' : h.includes('10h') ? '10:00' : '12:00'}</option>)}
                            </select>
                        )}
                    </div>
                    {!emp.isYoungApprentice && (
                        <div>
                        <label className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block mb-0.5">
                            Férias (Saída)
                        </label>
                        <input
                            type="date"
                            value={emp.vacationStart || ''}
                            onChange={(e) => handleVacationStart(emp.id, e.target.value, onUpdateEmployee)}
                            className={`w-full bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold p-1.5 outline-none focus:ring-1 focus:ring-orange-500 ${emp.vacationStart ? 'border-violet-200 text-violet-700' : ''}`}
                        />
                        </div>
                    )}
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
};
