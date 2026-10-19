import React, { useState, useMemo } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Employee, EmployeeCargo, EmployeeRole, EMPLOYEE_ROLES, ROLE_METADATA_MAP, normalizeEmployeeRole } from '../types';
import { Icon } from './Icon';
import { SHIFT_HOURS, APPRENTICE_WORK_PERIOD, getTacticalLabel, getTacticalEmoji } from '../constants';
import { addDaysToISODate } from '../src/utils/date';

interface TeamViewProps {
  employees: Employee[];
  isReadOnly?: boolean;
  onUpdateEmployee: (empId: string, data: Partial<Employee>) => void;
  onDeleteEmployee: (empId: string) => void;
  onAddEmployee: (
    name: string, 
    isYoung: boolean, 
    courseDay: string, 
    cargo: EmployeeCargo, 
    birthday: string, 
    contractType?: 'CLT' | 'Sazonal', 
    jornada?: '6x1' | '5x2',
    hiredAt?: string,
    firedAt?: string
  ) => void;
  onClose?: () => void;
}

const CARGO_OPTIONS: EmployeeCargo[] = EMPLOYEE_ROLES;

/** Adds `days` calendar days to a YYYY-MM-DD string and returns YYYY-MM-DD */
function addDays(dateStr: string, days: number): string {
  return addDaysToISODate(dateStr, days);
}

/** Formats YYYY-MM-DD to DD/MM/YYYY */
function formatDateBR(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

/**
 * Sincroniza a grade de turnos de um colaborador com as novas datas de início (hiredAt) e término (firedAt).
 * Marca como 'N/A' dias fora do contrato e restaura para 'T' dias que estavam 'N/A' caso o contrato seja estendido.
 */
function syncEmployeeContractShifts(emp: Employee, hiredAt?: string, firedAt?: string): Record<string, import('../types').ShiftType[]> {
  const newShifts: Record<string, import('../types').ShiftType[]> = {};
  for (const [mKey, shiftArr] of Object.entries(emp.shifts || {})) {
    if (!Array.isArray(shiftArr)) continue;
    const parts = mKey.split('-');
    if (parts.length !== 2) {
      newShifts[mKey] = [...shiftArr];
      continue;
    }
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const updated = [...shiftArr];

    for (let d = 1; d <= daysInMonth; d++) {
      const fullDate = `${mKey}-${String(d).padStart(2, '0')}`;
      const isOutside = (hiredAt && fullDate < hiredAt) || (firedAt && fullDate > firedAt);
      const currentShift = updated[d - 1];

      if (isOutside) {
        if (currentShift !== 'N/A') {
          updated[d - 1] = 'N/A';
        }
      } else {
        if (currentShift === 'N/A') {
          updated[d - 1] = 'T';
        }
      }
    }
    newShifts[mKey] = updated;
  }
  return newShifts;
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
  
  const current = new Date(startObj.getFullYear(), startObj.getMonth(), 1);
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

function handleAtestadoSave(emp: Employee, startDate: string, durationDays: number, onUpdate: (id: string, data: Partial<Employee>) => void) {
  if (!startDate || durationDays <= 0) {
    handleAtestadoClear(emp, onUpdate);
    return;
  }
  const endDate = addDays(startDate, durationDays - 1);
  const startObj = new Date(startDate + 'T00:00:00');
  const endObj = new Date(endDate + 'T00:00:00');
  
  const newShifts = { ...emp.shifts };
  const current = new Date(startObj.getFullYear(), startObj.getMonth(), 1);
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
        shifts[d - 1] = 'AT';
      } else if (shifts[d - 1] === 'AT') {
        shifts[d - 1] = 'T';
      }
    }
    newShifts[monthKey] = shifts;
    current.setMonth(current.getMonth() + 1);
  }

  onUpdate(emp.id, {
    atestadoStart: startDate,
    atestadoEnd: endDate,
    shifts: newShifts
  });
}

function handleAtestadoClear(emp: Employee, onUpdate: (id: string, data: Partial<Employee>) => void) {
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
}

interface AddEmployeeModalProps {
  onClose: () => void;
  onAddEmployee: (
    name: string, 
    isYoung: boolean, 
    courseDay: string, 
    cargo: EmployeeCargo, 
    birthday: string, 
    contractType?: 'CLT' | 'Sazonal', 
    jornada?: '6x1' | '5x2',
    hiredAt?: string,
    firedAt?: string
  ) => void;
}

const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({ onClose, onAddEmployee }) => {
  const [newName, setNewName] = useState('');
  const [isYoung, setIsYoung] = useState(false);
  const [courseDay, setCourseDay] = useState('Segunda-feira');
  const [newCargo, setNewCargo] = useState<EmployeeCargo>('Apoio');
  const [newBirthday, setNewBirthday] = useState('');
  const [newHiredAt, setNewHiredAt] = useState('');
  const [newFiredAt, setNewFiredAt] = useState('');
  const [newContractType, setNewContractType] = useState<'CLT' | 'Sazonal'>('CLT');
  const [newJornada, setNewJornada] = useState<'6x1' | '5x2'>('6x1');
  const { showDialog } = useDialog();

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      const confirmed = await showDialog({
        type: 'confirm',
        message: `Deseja cadastrar o colaborador ${newName.trim()}?`
      });
      if (confirmed) {
        onAddEmployee(
          newName.trim(), 
          isYoung, 
          courseDay, 
          newCargo, 
          newBirthday, 
          newContractType, 
          newJornada,
          newHiredAt || undefined,
          newFiredAt || undefined
        );
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <h4 className="text-lg sm:text-xl font-black text-slate-900 dark:text-zinc-100 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Icon name="person_add" className="text-xl" />
            </div>
            Cadastrar Colaborador
          </h4>
          <button 
            type="button" 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleAddSubmit} className="overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-4 flex-1">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome Completo *</label>
            <input 
              autoFocus 
              required
              type="text" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-3 font-bold text-sm text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-orange-500 outline-none uppercase" 
              placeholder="Ex: João da Silva" 
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Função / Cargo</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CARGO_OPTIONS.map(c => {
                const meta = ROLE_METADATA_MAP[c];
                const isSelected = newCargo === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewCargo(c)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                        : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-orange-300'
                    }`}
                  >
                    <span>{c}</span>
                    <span className={`text-[9px] px-1 py-0.5 rounded font-black ${
                      isSelected ? 'bg-white/20 text-white' : meta.badgeColor
                    }`}>
                      {meta.code}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipo de Contrato</label>
              <select 
                value={newContractType} 
                onChange={(e) => setNewContractType(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 font-bold text-xs text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500"
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
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 font-bold text-xs text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="6x1">6x1</option>
                <option value="5x2">5x2</option>
              </select>
            </div>
          </div>

          {/* Período de Contrato (Início e Término) */}
          <div className={`p-4 rounded-2xl border space-y-3 transition-colors ${
            newContractType === 'Sazonal'
              ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-900/50'
              : 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-900/40'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon name="date_range" className={newContractType === 'Sazonal' ? 'text-amber-600' : 'text-orange-500'} />
                <label className={`text-[11px] font-black uppercase tracking-wider ${
                  newContractType === 'Sazonal' ? 'text-amber-900 dark:text-amber-300' : 'text-orange-900 dark:text-orange-300'
                }`}>
                  {newContractType === 'Sazonal' ? 'Período do Contrato Sazonal' : 'Período do Contrato / Admissão'}
                </label>
              </div>
              {newContractType === 'Sazonal' && (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                  Temporário
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 block mb-1">
                  Início / Admissão {newContractType === 'Sazonal' && '*'}
                </label>
                <input 
                  type="date" 
                  value={newHiredAt} 
                  onChange={(e) => setNewHiredAt(e.target.value)} 
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2 font-bold text-xs text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500" 
                />
                <span className="text-[9px] text-slate-400 block mt-0.5">Antes desta data: N/A</span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 block mb-1">
                  Término do Contrato {newContractType === 'Sazonal' ? '(Previsto)' : '(Opcional)'}
                </label>
                <input 
                  type="date" 
                  value={newFiredAt} 
                  onChange={(e) => setNewFiredAt(e.target.value)} 
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2 font-bold text-xs text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500" 
                />
                <span className="text-[9px] text-slate-400 block mt-0.5">Após esta data: N/A</span>
              </div>
            </div>

            <p className={`text-[10px] font-medium leading-relaxed ${
              newContractType === 'Sazonal' ? 'text-amber-800 dark:text-amber-300/90' : 'text-orange-700 dark:text-orange-400/90'
            }`}>
              💡 <strong>Automação Inteligente:</strong> Os dias fora do período de contrato são automaticamente desconsiderados (marcados como <strong>N/A</strong>). Não é necessário preencher folgas (F) caso o colaborador só atue em parte do mês.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data de Aniversário</label>
            <input 
              type="date" 
              value={newBirthday} 
              onChange={(e) => setNewBirthday(e.target.value)} 
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 font-bold text-xs text-slate-800 dark:text-zinc-200 outline-none" 
            />
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
            <input 
              type="checkbox" 
              id="isYoung" 
              checked={isYoung} 
              onChange={(e) => setIsYoung(e.target.checked)} 
              className="w-4 h-4 accent-orange-500 rounded cursor-pointer" 
            />
            <label htmlFor="isYoung" className="text-xs font-black text-slate-700 dark:text-zinc-300 cursor-pointer">
              Jovem Aprendiz
            </label>
          </div>

          {isYoung && (
            <div className="p-3 bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50 rounded-xl space-y-2">
              <label className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest block">Dia do Curso Teórico</label>
              <select 
                value={courseDay} 
                onChange={(e) => setCourseDay(e.target.value)} 
                className="w-full bg-white dark:bg-zinc-800 border border-sky-200 dark:border-sky-800 rounded-xl p-2 font-bold text-xs text-sky-900 dark:text-sky-200 outline-none"
              >
                {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].map(d => <option key={d}>{d}</option>)}
              </select>
              <p className="text-[9px] text-sky-600 dark:text-sky-400 font-bold uppercase tracking-tight">Nota: Aprendizes folgam aos Sábados e Domingos automaticamente.</p>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl font-black text-xs uppercase text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-black text-xs uppercase shadow-md shadow-orange-500/20 transition-all"
            >
              Cadastrar Colaborador
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/** Componente Modal para Edição Completa de Colaborador */
interface EditEmployeeModalProps {
  employee: Employee;
  isReadOnly: boolean;
  onUpdateEmployee: (empId: string, data: Partial<Employee>) => void;
  onDeleteEmployee: (empId: string) => void;
  onClose: () => void;
}

const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  employee,
  isReadOnly,
  onUpdateEmployee,
  onDeleteEmployee,
  onClose,
}) => {
  const { showDialog } = useDialog();

  const [atestadoStartEdit, setAtestadoStartEdit] = useState(employee.atestadoStart || '');
  const [atestadoDurationEdit, setAtestadoDurationEdit] = useState<number>(() => {
    if (employee.atestadoStart && employee.atestadoEnd) {
      const s = new Date(employee.atestadoStart + 'T00:00:00').getTime();
      const e = new Date(employee.atestadoEnd + 'T00:00:00').getTime();
      return Math.max(1, Math.round((e - s) / 86400000) + 1);
    }
    return 1;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm uppercase shadow-sm ${
              employee.isYoungApprentice
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                : employee.cargo === 'Estoque'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
            }`}>
              {employee.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-zinc-100 uppercase">
                  {employee.name}
                </h4>
                <span className={`w-2 h-2 rounded-full ${employee.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                  {employee.cargo || 'Atendente'}
                </span>
                <span className="text-[10px] text-slate-400">•</span>
                <span className="text-[10px] font-bold text-slate-400">
                  ID: {employee.id}
                </span>
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-5 sm:p-7 space-y-6 flex-1 custom-scrollbar">
          {/* Section 1: Identificação & Cargo */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
              <Icon name="badge" className="text-orange-500 text-base" />
              <span>Identificação & Cargo</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome Completo</label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={employee.name}
                  onChange={(e) => onUpdateEmployee(employee.id, { name: e.target.value })}
                  placeholder="Nome do colaborador"
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-900 dark:text-zinc-100 uppercase outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cargo / Função Oficial</label>
                <select
                  disabled={isReadOnly}
                  value={normalizeEmployeeRole(employee.cargo || employee.role)}
                  onChange={(e) => {
                    const newCargo = normalizeEmployeeRole(e.target.value);
                    onUpdateEmployee(employee.id, { 
                      cargo: newCargo,
                      role: newCargo
                    });
                  }}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {EMPLOYEE_ROLES.map(c => (
                    <option key={c} value={c}>{c} ({ROLE_METADATA_MAP[c].code})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Período de Contrato & Vínculo */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
              <Icon name="event_available" className="text-orange-500 text-base" />
              <span>Período de Contrato & Vínculo</span>
            </div>

            <div className={`p-4 rounded-2xl border space-y-3 transition-colors ${
              employee.contractType === 'Sazonal'
                ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-900/50'
                : 'bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/70 dark:border-orange-900/40'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="date_range" className={`text-base ${employee.contractType === 'Sazonal' ? 'text-amber-600' : 'text-orange-500'}`} />
                  <span className={`text-xs font-black uppercase tracking-wide ${
                    employee.contractType === 'Sazonal' ? 'text-amber-900 dark:text-amber-300' : 'text-orange-950 dark:text-orange-200'
                  }`}>
                    {employee.contractType === 'Sazonal' ? 'Vigência do Contrato Sazonal' : 'Período Contratual'}
                  </span>
                </div>

                {employee.contractType === 'Sazonal' && (
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                    Contrato Temporário
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Data de Início / Admissão */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-600 dark:text-zinc-300 uppercase tracking-wider">
                      Início / Admissão
                    </label>
                    {employee.hiredAt && (
                      <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                        {formatDateBR(employee.hiredAt)}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    disabled={isReadOnly}
                    value={employee.hiredAt || ''}
                    onChange={(e) => {
                      const newHiredAt = e.target.value || undefined;
                      const syncedShifts = syncEmployeeContractShifts(employee, newHiredAt, employee.firedAt);
                      onUpdateEmployee(employee.id, { hiredAt: newHiredAt, shifts: syncedShifts });
                    }}
                    className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-[9px] text-slate-400">
                    Antes desta data: <strong>N/A</strong> automático
                  </p>
                </div>

                {/* Data de Término / Fim de Contrato */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-600 dark:text-zinc-300 uppercase tracking-wider">
                      Término do Contrato
                    </label>
                    {employee.firedAt && !isReadOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          const syncedShifts = syncEmployeeContractShifts(employee, employee.hiredAt, undefined);
                          onUpdateEmployee(employee.id, { firedAt: undefined, shifts: syncedShifts });
                        }}
                        className="text-[9px] font-bold text-rose-500 hover:text-rose-700 underline"
                        title="Remover data de término"
                      >
                        Limpar término
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    disabled={isReadOnly}
                    value={employee.firedAt || ''}
                    onChange={(e) => {
                      const newFiredAt = e.target.value || undefined;
                      const syncedShifts = syncEmployeeContractShifts(employee, employee.hiredAt, newFiredAt);
                      onUpdateEmployee(employee.id, { firedAt: newFiredAt, shifts: syncedShifts });
                    }}
                    className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-[9px] text-slate-400">
                    Após esta data: <strong>N/A</strong> automático
                  </p>
                </div>
              </div>

              <p className={`text-[10px] font-medium leading-relaxed ${
                employee.contractType === 'Sazonal' ? 'text-amber-800 dark:text-amber-300/90' : 'text-orange-800 dark:text-orange-300/90'
              }`}>
                💡 <strong>Automação de Folgas & Período:</strong> Qualquer dia fora do período de vigência ([início] até [término]) é automaticamente considerado <strong>N/A</strong>. Você <strong>não precisa colocar folga (F)</strong> caso o colaborador trabalhe apenas uma parte do mês!
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipo de Contrato</label>
                <select
                  disabled={isReadOnly}
                  value={employee.contractType || 'CLT'}
                  onChange={(e) => onUpdateEmployee(employee.id, { contractType: e.target.value as any })}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="CLT">CLT (Efetivo)</option>
                  <option value="Sazonal">Sazonal / Temporário</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Jornada</label>
                <select
                  disabled={isReadOnly}
                  value={employee.jornada || '6x1'}
                  onChange={(e) => onUpdateEmployee(employee.id, { jornada: e.target.value as any })}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="6x1">6x1</option>
                  <option value="5x2">5x2</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data de Aniversário</label>
                <input
                  type="date"
                  disabled={isReadOnly}
                  value={employee.birthday || ''}
                  onChange={(e) => onUpdateEmployee(employee.id, { birthday: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Escala Base & Folgas */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
              <Icon name="schedule" className="text-orange-500 text-base" />
              <span>Escala Base & Folga Semanal</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Horário Base</label>
                <select
                  disabled={isReadOnly}
                  value={employee.workPeriod}
                  onChange={(e) => onUpdateEmployee(employee.id, { workPeriod: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {employee.isYoungApprentice ? (
                    <option value={APPRENTICE_WORK_PERIOD}>{APPRENTICE_WORK_PERIOD}</option>
                  ) : (
                    SHIFT_HOURS.WEEKDAY.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))
                  )}
                  {!employee.isYoungApprentice && !SHIFT_HOURS.WEEKDAY.includes(employee.workPeriod) && employee.workPeriod && (
                    <option value={employee.workPeriod}>{employee.workPeriod}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Folga Fixa Semanal</label>
                <select
                  disabled={isReadOnly}
                  value={employee.preferredDayOff}
                  onChange={(e) => onUpdateEmployee(employee.id, { preferredDayOff: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value="">Nenhuma folga fixa</option>
                  {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>


          </div>

          {/* Section 4: Condições Especiais (Aprendiz, Férias & Atestado) */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
              <Icon name="verified_user" className="text-orange-500 text-base" />
              <span>Condições Especiais & Afastamentos</span>
            </div>

            {/* Jovem Aprendiz */}
            <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${employee.isYoungApprentice ? 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300' : 'bg-slate-200/70 text-slate-400 dark:bg-zinc-700'}`}>
                    <Icon name="child_care" className="text-base" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-zinc-200 uppercase">Jovem Aprendiz</span>
                    <p className="text-[10px] text-slate-400">Folga automática aos Sábados, Domingos e Feriados</p>
                  </div>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => onUpdateEmployee(employee.id, { isYoungApprentice: !employee.isYoungApprentice })}
                    className={`w-10 h-5 rounded-full transition-all relative ${employee.isYoungApprentice ? 'bg-sky-500' : 'bg-slate-300 dark:bg-zinc-600'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${employee.isYoungApprentice ? 'left-5.5' : 'left-0.5'}`}></div>
                  </button>
                )}
              </div>

              {employee.isYoungApprentice && (
                <div className="pt-2 border-t border-slate-200 dark:border-zinc-700">
                  <label className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest block mb-1">Dia do Curso Teórico</label>
                  <select
                    disabled={isReadOnly}
                    value={employee.courseDay || 'Segunda-feira'}
                    onChange={(e) => onUpdateEmployee(employee.id, { courseDay: e.target.value })}
                    className="w-full bg-white dark:bg-zinc-900 border border-sky-200 dark:border-sky-800 rounded-xl p-2 text-xs font-bold text-sky-900 dark:text-sky-200 outline-none"
                  >
                    {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Férias */}
            {!employee.isYoungApprentice && (
              <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Icon name="beach_access" className="text-emerald-500 text-sm" />
                    Férias (Início)
                  </label>
                  {employee.vacationStart && (
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => handleVacationStart(employee, '', onUpdateEmployee)}
                      className="text-[9px] font-black text-rose-500 hover:underline uppercase"
                    >
                      Limpar Férias
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  disabled={isReadOnly}
                  value={employee.vacationStart || ''}
                  onChange={(e) => handleVacationStart(employee, e.target.value, onUpdateEmployee)}
                  className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none"
                />
                {employee.vacationStart && employee.vacationEnd && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    <span>Fim: {formatDateBR(employee.vacationEnd)}</span>
                    <span>Retorno: {formatDateBR(addDays(employee.vacationEnd, 1))}</span>
                  </div>
                )}
              </div>
            )}

            {/* Atestado Médico */}
            <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="medical_services" className="text-rose-500 text-sm" />
                  Atestado Médico (Lançar por Período)
                </label>
                {employee.atestadoStart && employee.atestadoEnd && (
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => {
                      handleAtestadoClear(employee, onUpdateEmployee);
                      setAtestadoStartEdit('');
                      setAtestadoDurationEdit(1);
                    }}
                    className="text-[9px] font-black text-rose-500 hover:underline uppercase"
                  >
                    Limpar Atestado
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Data Início</span>
                  <input
                    type="date"
                    disabled={isReadOnly}
                    value={atestadoStartEdit}
                    onChange={(e) => setAtestadoStartEdit(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none"
                  />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Duração (Dias)</span>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    disabled={isReadOnly}
                    value={atestadoDurationEdit}
                    onChange={(e) => setAtestadoDurationEdit(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none"
                  />
                </div>
              </div>
              {atestadoStartEdit && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-zinc-700/60">
                  <div className="text-[10px] font-bold text-slate-600 dark:text-zinc-300">
                    <span>Fim: {formatDateBR(addDays(atestadoStartEdit, atestadoDurationEdit - 1))}</span>
                    <span className="ml-2 text-emerald-600 dark:text-emerald-400">Retorno: {formatDateBR(addDays(atestadoStartEdit, atestadoDurationEdit))}</span>
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        handleAtestadoSave(employee, atestadoStartEdit, atestadoDurationEdit, onUpdateEmployee);
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1"
                    >
                      <Icon name="save" className="text-xs" />
                      Salvar Atestado
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Acesso & Visibilidade */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
              <Icon name="lock" className="text-orange-500 text-base" />
              <span>Acesso & Visibilidade</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Senha */}
              <div className="p-3 bg-slate-50 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha Individual</label>
                  {!isReadOnly && (
                    <button 
                      type="button"
                      onClick={() => onUpdateEmployee(employee.id, { password: '1234' })}
                      className="text-[9px] font-black text-orange-500 hover:underline uppercase"
                    >
                      Resetar (1234)
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    disabled={isReadOnly}
                    value={employee.password || ''}
                    onChange={(e) => onUpdateEmployee(employee.id, { password: e.target.value })}
                    placeholder="Padrão: 1234"
                    className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-zinc-200 outline-none"
                  />
                  <Icon name="key" className="absolute right-3 top-2 text-slate-400 text-xs" />
                </div>
              </div>

              {/* Visibilidade */}
              <div className="p-3 bg-slate-50 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700 flex flex-col justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Visibilidade na Grade</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {employee.isHidden ? 'Oculto na escala principal' : 'Visível na escala principal'}
                  </p>
                </div>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => onUpdateEmployee(employee.id, { isHidden: !employee.isHidden })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 border transition-all ${
                      employee.isHidden
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-zinc-700'
                        : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-700 hover:border-slate-300'
                    }`}
                  >
                    <Icon name={employee.isHidden ? 'visibility_off' : 'visibility'} className="text-sm" />
                    <span>{employee.isHidden ? 'Colaborador Oculto' : 'Colaborador Visível'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/80">
          {!isReadOnly && (
            <button
              type="button"
              onClick={async () => {
                const confirmed = await showDialog({
                  type: 'confirm',
                  message: `Excluir o colaborador ${employee.name} permanentemente?`
                });
                if (confirmed) {
                  onDeleteEmployee(employee.id);
                  onClose();
                }
              }}
              className="px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-black text-xs uppercase transition-all flex items-center gap-1.5 border border-transparent hover:border-rose-200"
            >
              <Icon name="delete" className="text-sm" />
              <span>Excluir</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-black text-xs uppercase shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5"
            >
              <Icon name="check" className="text-base" />
              <span>Concluir & Fechar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TeamView: React.FC<TeamViewProps> = ({ 
  employees, 
  isReadOnly = false,
  onUpdateEmployee, 
  onDeleteEmployee, 
  onAddEmployee,
  onClose
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [cargoFilter, setCargoFilter] = useState<string>('ALL');

  const { showDialog } = useDialog();

  const editingEmployee = useMemo(() => {
    if (!editingEmpId) return null;
    return employees.find(e => e.id === editingEmpId) || null;
  }, [employees, editingEmpId]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (emp.cargo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (emp.workPeriod || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCargo = cargoFilter === 'ALL' || (emp.cargo || 'Atendente') === cargoFilter;
      return matchesSearch && matchesCargo;
    });
  }, [employees, searchTerm, cargoFilter]);

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in overflow-y-auto custom-scrollbar pr-1 pb-20">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm gap-4">
        <div>
           <div className="flex items-center gap-2">
             <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100">Equipe Operacional</h3>
             <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
               {employees.length} {employees.length === 1 ? 'colaborador' : 'colaboradores'}
             </span>
           </div>
           <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 mt-0.5">
             Clique no card ou no botão Editar para abrir os dados completos do colaborador em um modal.
           </p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95"
              title="Voltar para a Grade Principal"
            >
              <Icon name="arrow_back" className="text-sm" />
              <span>Voltar à Grade</span>
            </button>
          )}

          {!isReadOnly && (
            <button 
              type="button"
              onClick={() => setShowAddModal(true)}
              className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="person_add" className="text-base" /> Novo Colaborador
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-900/60 p-3 rounded-2xl border border-slate-200/60 dark:border-zinc-800">
        {/* Left: Search & Cargo Filter */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Icon name="search" className="absolute left-3 top-2.5 text-slate-400 text-sm" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar colaborador..."
              className="w-full h-9 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-9 pr-8 text-xs font-semibold text-slate-700 dark:text-zinc-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500/30 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                <Icon name="close" />
              </button>
            )}
          </div>

          <div className="h-9 flex items-center bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-0.5 rounded-xl">
            {['ALL', ...CARGO_OPTIONS].map(c => (
              <button
                key={c}
                onClick={() => setCargoFilter(c)}
                className={`h-full px-2.5 sm:px-3 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center ${
                  cargoFilter === c 
                    ? 'bg-orange-500 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'
                }`}
              >
                {c === 'ALL' ? 'Todos' : c}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
          Exibindo {filteredEmployees.length} de {employees.length}
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onAddEmployee={onAddEmployee}
        />
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
          isReadOnly={isReadOnly}
          onUpdateEmployee={onUpdateEmployee}
          onDeleteEmployee={onDeleteEmployee}
          onClose={() => setEditingEmpId(null)}
        />
      )}

      {/* Employee Cards Grid (Compact, Sleek, Non-Expanding) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredEmployees.map(emp => {
          return (
            <div 
              key={emp.id} 
              onClick={() => setEditingEmpId(emp.id)}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:border-orange-300 dark:hover:border-orange-500/40 transition-all shadow-sm hover:shadow-lg relative overflow-hidden flex flex-col cursor-pointer group select-none"
            >
              {/* Top Accent Indicator */}
              <div className={`h-1.5 w-full transition-colors ${
                emp.status === 'active' 
                  ? (emp.contractType === 'Sazonal' ? 'bg-amber-400' : 'bg-emerald-500') 
                  : 'bg-slate-300'
              }`} />

              {/* Card Body */}
              <div className="p-4 flex flex-col gap-3 flex-1">
                {/* Header: Avatar, Name, Cargo */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-sm uppercase shrink-0 transition-transform group-hover:scale-105 ${
                      emp.isYoungApprentice
                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                        : emp.cargo === 'Estoque'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                    }`}>
                      {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-slate-900 dark:text-zinc-100 uppercase truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors" title={emp.name.toUpperCase()}>
                          {emp.name}
                        </span>
                        <div className={`w-2 h-2 rounded-full shrink-0 ${emp.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {(() => {
                          const r = normalizeEmployeeRole(emp.cargo || emp.role);
                          const meta = ROLE_METADATA_MAP[r];
                          return (
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${meta.badgeColor}`}>
                              {meta.label} ({meta.code})
                            </span>
                          );
                        })()}
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

                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-orange-500 group-hover:bg-orange-50 dark:group-hover:bg-orange-950/40 transition-all shrink-0">
                    <Icon name="edit" className="text-sm" />
                  </div>
                </div>

                {/* Key Chips */}
                <div className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-600 dark:text-zinc-300 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  {/* Período de Contrato / Início & Término */}
                  {(emp.hiredAt || emp.firedAt) && (
                    <div className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-lg border w-fit ${
                      emp.contractType === 'Sazonal'
                        ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/40 font-black'
                        : 'text-orange-600 dark:text-orange-400 bg-orange-50/70 dark:bg-orange-950/30 border-orange-100 dark:border-orange-900/30'
                    }`}>
                      <Icon name="date_range" className="text-xs shrink-0" />
                      <span>
                        {emp.contractType === 'Sazonal'
                          ? `Contrato: ${formatDateBR(emp.hiredAt) || '...'} a ${formatDateBR(emp.firedAt) || 'Em aberto'}`
                          : emp.hiredAt && emp.firedAt
                          ? `Início: ${formatDateBR(emp.hiredAt)} • Término: ${formatDateBR(emp.firedAt)}`
                          : emp.hiredAt
                          ? `Início: ${formatDateBR(emp.hiredAt)}`
                          : `Término: ${formatDateBR(emp.firedAt)}`}
                      </span>
                    </div>
                  )}

                  {/* Horário Base */}
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
                    <Icon name="schedule" className="text-xs text-orange-500 shrink-0" />
                    <span>{emp.workPeriod || '10h às 18h20'}</span>
                  </div>

                  {/* Folga Fixa */}
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
                    <Icon name="event_busy" className="text-xs text-rose-500 shrink-0" />
                    <span>Folga: {emp.preferredDayOff ? emp.preferredDayOff.replace('-feira', '') : 'Sem folga fixa'}</span>
                  </div>

                  {/* Aniversário */}
                  {emp.birthday && (
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[10px]">
                      <Icon name="cake" className="text-xs text-fuchsia-500 shrink-0" />
                      <span>Aniversário: {formatDateBR(emp.birthday).substring(0, 5)}</span>
                    </div>
                  )}

                  {/* Férias */}
                  {emp.vacationStart && emp.vacationEnd && (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[10px] bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-lg w-fit">
                      <Icon name="beach_access" className="text-xs shrink-0" />
                      <span>Férias: {formatDateBR(emp.vacationStart).substring(0, 5)} a {formatDateBR(emp.vacationEnd).substring(0, 5)}</span>
                    </div>
                  )}

                  {/* Atestado */}
                  {emp.atestadoStart && emp.atestadoEnd && (
                    <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-[10px] bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-lg w-fit">
                      <Icon name="medical_services" className="text-xs shrink-0" />
                      <span>Atestado: {formatDateBR(emp.atestadoStart).substring(0, 5)} a {formatDateBR(emp.atestadoEnd).substring(0, 5)}</span>
                    </div>
                  )}
                </div>

                {/* Bottom Action Strip */}
                <div className="flex items-center justify-between pt-2 mt-auto border-t border-slate-100 dark:border-zinc-800">
                  <span className="text-[10px] font-black text-orange-500 dark:text-orange-400 uppercase tracking-wider group-hover:underline flex items-center gap-1">
                    <Icon name="settings" className="text-xs" />
                    Editar Colaborador
                  </span>

                  {!isReadOnly && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onUpdateEmployee(emp.id, { isHidden: !emp.isHidden })}
                        className={`p-1.5 rounded-lg text-xs transition-all ${
                          emp.isHidden
                            ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                        }`}
                        title={emp.isHidden ? 'Mostrar na Escala' : 'Ocultar da Escala'}
                      >
                        <Icon name={emp.isHidden ? 'visibility_off' : 'visibility'} className="text-sm" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const confirmed = await showDialog({
                            type: 'confirm',
                            message: `Excluir ${emp.name} permanentemente?`
                          });
                          if (confirmed) onDeleteEmployee(emp.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition-all"
                        title="Excluir Colaborador"
                      >
                        <Icon name="delete" className="text-sm" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
