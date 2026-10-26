import React, { useState, useMemo, useEffect } from 'react';
import { useDialog } from '../contexts/DialogContext';
import { Employee, EmployeeCargo, EMPLOYEE_ROLES, ROLE_METADATA_MAP, normalizeEmployeeRole } from '../types';
import { Icon } from './Icon';
import { SHIFT_HOURS, APPRENTICE_WORK_PERIOD } from '../constants';
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
    firedAt?: string,
    secondaryRole?: 'Caixa' | 'Pacote' | 'Vendas' | 'Apoio'
  ) => void;
  onClose?: () => void;
  initialEditingEmpId?: string | null;
  onClearInitialEditingEmp?: () => void;
}

const CARGO_OPTIONS: EmployeeCargo[] = EMPLOYEE_ROLES;

type StatusCategoryFilter = 'ALL' | 'CLT' | 'SAZONAL' | 'APPRENTICE' | 'AWAY' | 'HIDDEN';
type ShiftGroupFilter = 'ALL' | 'ABERTURA' | 'INTERMEDIARIO' | 'FECHAMENTO';
type SortMode = 'NAME' | 'ROLE' | 'SHIFT';
type EditModalSection = 'all' | 'identificacao' | 'contrato' | 'escala' | 'afastamentos' | 'acesso';

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

function classifyWorkPeriodGroup(workPeriod?: string): ShiftGroupFilter {
  if (!workPeriod) return 'ABERTURA';
  const normalized = workPeriod.toLowerCase();
  if (normalized.startsWith('08h') || normalized.startsWith('09h') || normalized.startsWith('10h') || normalized.startsWith('11h')) {
    return 'ABERTURA';
  }
  if (normalized.startsWith('12h') || normalized.startsWith('13h00')) {
    return 'INTERMEDIARIO';
  }
  return 'FECHAMENTO';
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
    firedAt?: string,
    secondaryRole?: 'Caixa' | 'Pacote' | 'Vendas' | 'Apoio'
  ) => void;
}

const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({ onClose, onAddEmployee }) => {
  const [newName, setNewName] = useState('');
  const [isYoung, setIsYoung] = useState(false);
  const [courseDay, setCourseDay] = useState('Segunda-feira');
  const [newCargo, setNewCargo] = useState<EmployeeCargo>('Apoio');
  const [newSecondaryRole, setNewSecondaryRole] = useState<'Caixa' | 'Pacote' | 'Vendas' | 'Apoio' | undefined>(undefined);
  const [newBirthday, setNewBirthday] = useState('');
  const [newHiredAt, setNewHiredAt] = useState('');
  const [newFiredAt, setNewFiredAt] = useState('');
  const [newContractType, setNewContractType] = useState<'CLT' | 'Sazonal'>('CLT');
  const [newJornada, setNewJornada] = useState<'6x1' | '5x2'>('6x1');
  const { showDialog } = useDialog();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
          newFiredAt || undefined,
          newSecondaryRole
        );
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h4 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Icon name="person_add" className="text-xl" />
            </div>
            Cadastrar Colaborador
          </h4>
          <button 
            type="button" 
            onClick={onClose}
            aria-label="Fechar modal de cadastro"
            title="Fechar (Esc)"
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleAddSubmit} className="overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-4 flex-1">
          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome Completo *</label>
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
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">1ª Função Principal *</label>
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
                    <span className={`text-[11px] px-1 py-0.5 rounded font-black ${
                      isSelected ? 'bg-white/20 text-white' : meta.badgeColor
                    }`}>
                      {meta.code}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">2ª Função / Aptidão Secundária (Opcional)</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {(['Nenhuma', 'Caixa', 'Pacote', 'Vendas', 'Apoio'] as const).map(sec => {
                const isSelected = sec === 'Nenhuma' ? !newSecondaryRole : newSecondaryRole === sec;
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setNewSecondaryRole(sec === 'Nenhuma' ? undefined : sec)}
                    className={`py-2 px-2 rounded-xl text-xs font-black uppercase border transition-all flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-indigo-300'
                    }`}
                  >
                    <span>{sec}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipo de Contrato</label>
              <select 
                value={newContractType} 
                onChange={(e) => setNewContractType(e.target.value as 'CLT' | 'Sazonal')}
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2.5 font-bold text-xs text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="CLT">CLT (Efetivo)</option>
                <option value="Sazonal">Sazonal / Temporário</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">Jornada</label>
              <select 
                value={newJornada} 
                onChange={(e) => setNewJornada(e.target.value as '6x1' | '5x2')}
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
                <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                  Temporário
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 block mb-1">
                  Início / Admissão {newContractType === 'Sazonal' && '*'}
                </label>
                <input 
                  type="date" 
                  value={newHiredAt} 
                  onChange={(e) => setNewHiredAt(e.target.value)} 
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2 font-bold text-xs text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500" 
                />
                <span className="text-[11px] text-slate-400 block mt-0.5">Antes desta data: N/A</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 block mb-1">
                  Término do Contrato {newContractType === 'Sazonal' ? '(Previsto)' : '(Opcional)'}
                </label>
                <input 
                  type="date" 
                  value={newFiredAt} 
                  onChange={(e) => setNewFiredAt(e.target.value)} 
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2 font-bold text-xs text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500" 
                />
                <span className="text-[11px] text-slate-400 block mt-0.5">Após esta data: N/A</span>
              </div>
            </div>

            <p className={`text-[11px] font-medium leading-relaxed ${
              newContractType === 'Sazonal' ? 'text-amber-800 dark:text-amber-300/90' : 'text-orange-700 dark:text-orange-400/90'
            }`}>
              💡 <strong>Automação Inteligente:</strong> Os dias fora do período de contrato são automaticamente desconsiderados (marcados como <strong>N/A</strong>). Não é necessário preencher folgas (F) caso o colaborador só atue em parte do mês.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data de Aniversário</label>
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
              <label className="text-[11px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest block">Dia do Curso Teórico</label>
              <select 
                value={courseDay} 
                onChange={(e) => setCourseDay(e.target.value)} 
                className="w-full bg-white dark:bg-zinc-800 border border-sky-200 dark:border-sky-800 rounded-xl p-2 font-bold text-xs text-sky-900 dark:text-sky-200 outline-none"
              >
                {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'].map(d => <option key={d}>{d}</option>)}
              </select>
              <p className="text-[11px] text-sky-600 dark:text-sky-400 font-bold uppercase tracking-tight">Nota: Aprendizes folgam aos Sábados e Domingos automaticamente.</p>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 px-4 py-2.5 h-11 min-h-[44px] md:h-10 md:min-h-[38px] border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-xs uppercase text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="flex-1 px-4 py-2.5 h-11 min-h-[44px] md:h-10 md:min-h-[38px] bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-xs uppercase shadow-md shadow-orange-500/20 transition-all focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
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
  onSelectSiblingEmployee?: (empId: string) => void;
  prevEmpId?: string | null;
  nextEmpId?: string | null;
  currentIndex?: number;
  totalCount?: number;
}

const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  employee,
  isReadOnly,
  onUpdateEmployee,
  onDeleteEmployee,
  onClose,
  onSelectSiblingEmployee,
  prevEmpId,
  nextEmpId,
  currentIndex,
  totalCount,
}) => {
  const { showDialog } = useDialog();
  const [activeSection, setActiveSection] = useState<EditModalSection>('all');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const [atestadoStartEdit, setAtestadoStartEdit] = useState(employee.atestadoStart || '');
  const [atestadoDurationEdit, setAtestadoDurationEdit] = useState<number>(() => {
    if (employee.atestadoStart && employee.atestadoEnd) {
      const s = new Date(employee.atestadoStart + 'T00:00:00').getTime();
      const e = new Date(employee.atestadoEnd + 'T00:00:00').getTime();
      return Math.max(1, Math.round((e - s) / 86400000) + 1);
    }
    return 1;
  });

  useEffect(() => {
    setAtestadoStartEdit(employee.atestadoStart || '');
    if (employee.atestadoStart && employee.atestadoEnd) {
      const s = new Date(employee.atestadoStart + 'T00:00:00').getTime();
      const e = new Date(employee.atestadoEnd + 'T00:00:00').getTime();
      setAtestadoDurationEdit(Math.max(1, Math.round((e - s) / 86400000) + 1));
    } else {
      setAtestadoDurationEdit(1);
    }
  }, [employee.id, employee.atestadoStart, employee.atestadoEnd]);

  const currentRole = normalizeEmployeeRole(employee.primaryRole || employee.cargo || employee.role);

  const sectionTabs: { id: EditModalSection; label: string; icon: string }[] = [
    { id: 'all', label: 'Ficha Completa', icon: 'dashboard' },
    { id: 'identificacao', label: 'Funções & Cargo', icon: 'badge' },
    { id: 'contrato', label: 'Contrato & Jornada', icon: 'event_available' },
    { id: 'escala', label: 'Horário & Folga', icon: 'schedule' },
    { id: 'afastamentos', label: 'Férias & Atestados', icon: 'beach_access' },
    { id: 'acesso', label: 'Senha & Grade', icon: 'lock' },
  ];

  const showSection = (sec: EditModalSection) => activeSection === 'all' || activeSection === sec;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-3xl w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/80 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm uppercase shadow-sm shrink-0 ${
              employee.isYoungApprentice
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                : employee.cargo === 'Estoque'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
            }`}>
              {employee.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 uppercase truncate">
                  {employee.name}
                </h4>
                <span className={`text-[11px] font-black uppercase px-2 py-0.5 rounded-full ${
                  employee.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  {employee.status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                  {ROLE_METADATA_MAP[currentRole].label} ({ROLE_METADATA_MAP[currentRole].code})
                </span>
                {employee.secondaryRole && (
                  <>
                    <span className="text-[11px] text-zinc-400">•</span>
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      2ª: {employee.secondaryRole}
                    </span>
                  </>
                )}
                <span className="text-[11px] text-zinc-400">•</span>
                <span className="text-[11px] font-bold text-zinc-400">
                  {employee.workPeriod || '10h às 18h20'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Navegação rápida entre colaboradores */}
            {onSelectSiblingEmployee && totalCount && totalCount > 1 && (
              <div className="flex items-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-0.5 mr-1">
                <button
                  type="button"
                  disabled={!prevEmpId}
                  onClick={() => prevEmpId && onSelectSiblingEmployee(prevEmpId)}
                  title="Colaborador anterior"
                  aria-label="Colaborador anterior"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition-all"
                >
                  <Icon name="chevron_left" className="text-base" />
                </button>
                <span className="px-2 text-[11px] font-black text-zinc-500 dark:text-zinc-400 tabular-nums select-none">
                  {(currentIndex ?? 0) + 1}/{totalCount}
                </span>
                <button
                  type="button"
                  disabled={!nextEmpId}
                  onClick={() => nextEmpId && onSelectSiblingEmployee(nextEmpId)}
                  title="Próximo colaborador"
                  aria-label="Próximo colaborador"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition-all"
                >
                  <Icon name="chevron_right" className="text-base" />
                </button>
              </div>
            )}

            <button 
              type="button"
              onClick={onClose}
              aria-label="Fechar modal de edição"
              title="Fechar (Esc)"
              className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
            >
              <Icon name="close" className="text-xl" />
            </button>
          </div>
        </div>

        {/* Section Tabs Navigation */}
        <div className="px-4 sm:px-6 py-2 bg-zinc-100/70 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-1 overflow-x-auto custom-scrollbar shrink-0">
          {sectionTabs.map(tab => {
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Icon name={tab.icon} className="text-xs" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1 custom-scrollbar">
          {/* Section 1: Identificação & Cargo */}
          {showSection('identificacao') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
                  <Icon name="badge" className="text-orange-500 text-base" />
                  <span>Identificação & Funções na Loja</span>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => onUpdateEmployee(employee.id, { status: employee.status === 'active' ? 'inactive' : 'active' })}
                    className={`px-3 py-1 rounded-xl text-[11px] font-black uppercase border transition-all flex items-center gap-1.5 ${
                      employee.status === 'active'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${employee.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                    <span>{employee.status === 'active' ? 'Cadastro Ativo' : 'Cadastro Inativo'}</span>
                  </button>
                )}
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome Completo</label>
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
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  1ª Função Principal (Correlata)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {EMPLOYEE_ROLES.map(c => {
                    const meta = ROLE_METADATA_MAP[c];
                    const isSelected = currentRole === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => {
                          onUpdateEmployee(employee.id, {
                            primaryRole: c,
                            cargo: c,
                            role: c,
                          });
                        }}
                        className={`p-2.5 rounded-xl text-xs font-black uppercase border transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                            : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-orange-300'
                        }`}
                      >
                        <span>{meta.label}</span>
                        <span className={`text-[11px] px-1.5 py-0.5 rounded font-black ${
                          isSelected ? 'bg-white/20 text-white' : meta.badgeColor
                        }`}>
                          {meta.code}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  2ª Função / Aptidão Secundária (Apoio de Escala)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(['Nenhuma', 'Caixa', 'Pacote', 'Vendas', 'Apoio'] as const).map(sec => {
                    const isSelected = sec === 'Nenhuma' ? !employee.secondaryRole : employee.secondaryRole === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => {
                          onUpdateEmployee(employee.id, {
                            secondaryRole: sec === 'Nenhuma' ? undefined : sec,
                          });
                        }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-black uppercase border transition-all text-center ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-indigo-300'
                        }`}
                      >
                        {sec}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Período de Contrato & Vínculo */}
          {showSection('contrato') && (
            <div className={`space-y-3 ${activeSection === 'all' ? 'pt-4 border-t border-slate-100 dark:border-zinc-800' : ''}`}>
              <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
                <Icon name="event_available" className="text-orange-500 text-base" />
                <span>Período de Contrato, Vínculo & Aniversário</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipo de Contrato</label>
                  <select
                    disabled={isReadOnly}
                    value={employee.contractType || 'CLT'}
                    onChange={(e) => onUpdateEmployee(employee.id, { contractType: e.target.value as 'CLT' | 'Sazonal' })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="CLT">CLT (Efetivo)</option>
                    <option value="Sazonal">Sazonal / Temporário</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">Jornada Semanal</label>
                  <select
                    disabled={isReadOnly}
                    value={employee.jornada || '6x1'}
                    onChange={(e) => onUpdateEmployee(employee.id, { jornada: e.target.value as '6x1' | '5x2' })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="6x1">6x1 (Máx. 6 dias seguidos)</option>
                    <option value="5x2">5x2 (Máx. 5 dias seguidos)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data de Aniversário</label>
                  <input
                    type="date"
                    disabled={isReadOnly}
                    value={employee.birthday || ''}
                    onChange={(e) => onUpdateEmployee(employee.id, { birthday: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
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
                      {employee.contractType === 'Sazonal' ? 'Vigência do Contrato Sazonal' : 'Período Contratual (Admissão / Desligamento)'}
                    </span>
                  </div>

                  {employee.contractType === 'Sazonal' && (
                    <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                      Contrato Temporário
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Data de Início / Admissão */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-600 dark:text-zinc-300 uppercase tracking-wider">
                        Início / Admissão
                      </label>
                      {employee.hiredAt && !isReadOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            const syncedShifts = syncEmployeeContractShifts(employee, undefined, employee.firedAt);
                            onUpdateEmployee(employee.id, { hiredAt: undefined, shifts: syncedShifts });
                          }}
                          className="text-[11px] font-bold text-rose-500 hover:text-rose-700 underline"
                        >
                          Limpar início
                        </button>
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
                    <p className="text-[11px] text-slate-400">
                      Antes desta data: <strong>N/A</strong> automático
                    </p>
                  </div>

                  {/* Data de Término / Fim de Contrato */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-600 dark:text-zinc-300 uppercase tracking-wider">
                        Término do Contrato
                      </label>
                      {employee.firedAt && !isReadOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            const syncedShifts = syncEmployeeContractShifts(employee, employee.hiredAt, undefined);
                            onUpdateEmployee(employee.id, { firedAt: undefined, shifts: syncedShifts });
                          }}
                          className="text-[11px] font-bold text-rose-500 hover:text-rose-700 underline"
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
                    <p className="text-[11px] text-slate-400">
                      Após esta data: <strong>N/A</strong> automático
                    </p>
                  </div>
                </div>

                <p className={`text-[11px] font-medium leading-relaxed ${
                  employee.contractType === 'Sazonal' ? 'text-amber-800 dark:text-amber-300/90' : 'text-orange-800 dark:text-orange-300/90'
                }`}>
                  💡 <strong>Automação de Folgas & Período:</strong> Qualquer dia fora do período de vigência é automaticamente considerado <strong>N/A</strong> na grade.
                </p>
              </div>
            </div>
          )}

          {/* Section 3: Escala Base & Folgas */}
          {showSection('escala') && (
            <div className={`space-y-3 ${activeSection === 'all' ? 'pt-4 border-t border-slate-100 dark:border-zinc-800' : ''}`}>
              <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
                <Icon name="schedule" className="text-orange-500 text-base" />
                <span>Escala Base, Horário & Folga Semanal</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">Horário Base Padrão</label>
                  <select
                    disabled={isReadOnly}
                    value={employee.workPeriod}
                    onChange={(e) => onUpdateEmployee(employee.id, { workPeriod: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500"
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
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">Folga Fixa Semanal (Preferência)</label>
                  <select
                    disabled={isReadOnly}
                    value={employee.preferredDayOff}
                    onChange={(e) => onUpdateEmployee(employee.id, { preferredDayOff: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Nenhuma folga fixa (Rotativa)</option>
                    {['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
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
                      <p className="text-[11px] text-slate-400">Folga automática aos Sábados, Domingos e Feriados</p>
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
                    <label className="text-[11px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest block mb-1">Dia do Curso Teórico</label>
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
            </div>
          )}

          {/* Section 4: Férias & Atestado */}
          {showSection('afastamentos') && (
            <div className={`space-y-3 ${activeSection === 'all' ? 'pt-4 border-t border-slate-100 dark:border-zinc-800' : ''}`}>
              <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
                <Icon name="verified_user" className="text-orange-500 text-base" />
                <span>Férias Programadas & Atestados Médicos</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Férias */}
                <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-2 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Icon name="beach_access" className="text-emerald-500 text-sm" />
                        Férias (Data de Saída)
                      </label>
                      {employee.vacationStart && (
                        <button
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => handleVacationStart(employee, '', onUpdateEmployee)}
                          className="text-[11px] font-black text-rose-500 hover:underline uppercase"
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
                  </div>
                  {employee.vacationStart && employee.vacationEnd ? (
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      <span>Fim: {formatDateBR(employee.vacationEnd)}</span>
                      <span>Retorno: {formatDateBR(addDays(employee.vacationEnd, 1))}</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">
                      Preenche automaticamente 30 dias corridos como <strong>FE</strong> na grade.
                    </p>
                  )}
                </div>

                {/* Atestado Médico */}
                <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Icon name="medical_services" className="text-rose-500 text-sm" />
                      Atestado Médico (Período)
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
                        className="text-[11px] font-black text-rose-500 hover:underline uppercase"
                      >
                        Limpar Atestado
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Data Início</span>
                      <input
                        type="date"
                        disabled={isReadOnly}
                        value={atestadoStartEdit}
                        onChange={(e) => setAtestadoStartEdit(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Duração (Dias)</span>
                      <input
                        type="number"
                        min={1}
                        max={180}
                        disabled={isReadOnly}
                        value={atestadoDurationEdit}
                        onChange={(e) => setAtestadoDurationEdit(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none"
                      />
                    </div>
                  </div>
                  {atestadoStartEdit && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-zinc-700/60">
                      <div className="text-[11px] font-bold text-slate-600 dark:text-zinc-300">
                        <span>Fim: {formatDateBR(addDays(atestadoStartEdit, atestadoDurationEdit - 1))}</span>
                        <span className="ml-2 text-emerald-600 dark:text-emerald-400">Retorno: {formatDateBR(addDays(atestadoStartEdit, atestadoDurationEdit))}</span>
                      </div>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            handleAtestadoSave(employee, atestadoStartEdit, atestadoDurationEdit, onUpdateEmployee);
                          }}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1"
                        >
                          <Icon name="save" className="text-xs" />
                          Salvar Atestado
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Acesso & Visibilidade */}
          {showSection('acesso') && (
            <div className={`space-y-3 ${activeSection === 'all' ? 'pt-4 border-t border-slate-100 dark:border-zinc-800' : ''}`}>
              <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
                <Icon name="lock" className="text-orange-500 text-base" />
                <span>Acesso Individual & Visibilidade na Grade</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Senha */}
                <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Senha Individual do Colaborador</label>
                    {!isReadOnly && (
                      <button 
                        type="button"
                        onClick={() => onUpdateEmployee(employee.id, { password: '1234' })}
                        className="text-[11px] font-black text-orange-500 hover:underline uppercase"
                      >
                        Resetar (1234)
                      </button>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      disabled={isReadOnly}
                      value={employee.password || ''}
                      onChange={(e) => onUpdateEmployee(employee.id, { password: e.target.value })}
                      placeholder="Padrão: 1234"
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl pl-3 pr-9 py-2 text-xs font-mono font-bold text-slate-800 dark:text-zinc-200 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)}
                      className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                      title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="text-sm" />
                    </button>
                  </div>
                </div>

                {/* Visibilidade */}
                <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/80 rounded-2xl border border-slate-200 dark:border-zinc-700 flex flex-col justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">Visibilidade na Grade Mensal</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {employee.isHidden ? 'Oculto na escala principal' : 'Visível normalmente na escala principal'}
                    </p>
                  </div>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => onUpdateEmployee(employee.id, { isHidden: !employee.isHidden })}
                      className={`px-3 py-2 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 border transition-all ${
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
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-900/80">
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
              className="h-11 min-h-[44px] md:h-10 md:min-h-[38px] px-3.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold text-xs uppercase transition-all flex items-center gap-1.5 border border-rose-200 dark:border-rose-900/40 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
            >
              <Icon name="delete" className="text-sm" />
              <span>Excluir</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="h-11 min-h-[44px] md:h-10 md:min-h-[38px] px-5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-xs uppercase shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
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
  onClose,
  initialEditingEmpId = null,
  onClearInitialEditingEmp,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(initialEditingEmpId);
  const [searchTerm, setSearchTerm] = useState('');
  const [cargoFilter, setCargoFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusCategoryFilter>('ALL');
  const [shiftFilter, setShiftFilter] = useState<ShiftGroupFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortMode>('NAME');

  const { showDialog } = useDialog();

  useEffect(() => {
    if (initialEditingEmpId) {
      setEditingEmpId(initialEditingEmpId);
      if (onClearInitialEditingEmp) {
        onClearInitialEditingEmp();
      }
    }
  }, [initialEditingEmpId, onClearInitialEditingEmp]);

  const stats = useMemo(() => {
    let clt = 0;
    let sazonal = 0;
    let apprentice = 0;
    let away = 0;
    let hidden = 0;

    for (const emp of employees) {
      if (emp.isHidden || emp.status !== 'active') hidden++;
      if (emp.isYoungApprentice) apprentice++;
      if (emp.contractType === 'Sazonal') sazonal++;
      else clt++;
      if ((emp.vacationStart && emp.vacationEnd) || (emp.atestadoStart && emp.atestadoEnd)) away++;
    }

    return {
      total: employees.length,
      clt,
      sazonal,
      apprentice,
      away,
      hidden,
    };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const filtered = employees.filter(emp => {
      const normalizedRole = normalizeEmployeeRole(emp.primaryRole || emp.cargo || emp.role);
      const matchesSearch =
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        normalizedRole.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.workPeriod || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCargo = cargoFilter === 'ALL' || normalizedRole === cargoFilter;

      let matchesStatus = true;
      if (statusFilter === 'CLT') matchesStatus = emp.contractType !== 'Sazonal';
      else if (statusFilter === 'SAZONAL') matchesStatus = emp.contractType === 'Sazonal';
      else if (statusFilter === 'APPRENTICE') matchesStatus = Boolean(emp.isYoungApprentice);
      else if (statusFilter === 'AWAY') matchesStatus = Boolean((emp.vacationStart && emp.vacationEnd) || (emp.atestadoStart && emp.atestadoEnd));
      else if (statusFilter === 'HIDDEN') matchesStatus = Boolean(emp.isHidden || emp.status !== 'active');

      let matchesShift = true;
      if (shiftFilter !== 'ALL') {
        matchesShift = classifyWorkPeriodGroup(emp.workPeriod) === shiftFilter;
      }

      return matchesSearch && matchesCargo && matchesStatus && matchesShift;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'ROLE') {
        const rA = normalizeEmployeeRole(a.primaryRole || a.cargo || a.role);
        const rB = normalizeEmployeeRole(b.primaryRole || b.cargo || b.role);
        const cmp = rA.localeCompare(rB, 'pt-BR');
        if (cmp !== 0) return cmp;
      } else if (sortBy === 'SHIFT') {
        const sA = a.workPeriod || '';
        const sB = b.workPeriod || '';
        const cmp = sA.localeCompare(sB, 'pt-BR');
        if (cmp !== 0) return cmp;
      }
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [employees, searchTerm, cargoFilter, statusFilter, shiftFilter, sortBy]);

  const editingEmployee = useMemo(() => {
    if (!editingEmpId) return null;
    return employees.find(e => e.id === editingEmpId) || null;
  }, [employees, editingEmpId]);

  const editingIndex = useMemo(() => {
    if (!editingEmpId) return -1;
    return filteredEmployees.findIndex(e => e.id === editingEmpId);
  }, [filteredEmployees, editingEmpId]);

  const prevEmpId = editingIndex > 0 ? filteredEmployees[editingIndex - 1].id : null;
  const nextEmpId = editingIndex >= 0 && editingIndex < filteredEmployees.length - 1 ? filteredEmployees[editingIndex + 1].id : null;

  const activeFiltersCount =
    (searchTerm ? 1 : 0) +
    (cargoFilter !== 'ALL' ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0) +
    (shiftFilter !== 'ALL' ? 1 : 0);

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in overflow-y-auto custom-scrollbar pr-1 pb-20">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Icon name="groups" className="text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100">
                  Gestão da Equipe & Colaboradores
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900">
                  {employees.length} {employees.length === 1 ? 'cadastro' : 'cadastros'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 mt-0.5">
                Edite funções correlatas, horários base, folgas fixas, vigência contratual, férias, atestados e senhas individuais.
              </p>
            </div>
          </div>
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
              className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="person_add" className="text-base" /> Novo Colaborador
            </button>
          )}
        </div>
      </div>

      {/* Interactive KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          { id: 'ALL' as StatusCategoryFilter, label: 'Total Equipe', value: stats.total, icon: 'groups', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40' },
          { id: 'CLT' as StatusCategoryFilter, label: 'Efetivos CLT', value: stats.clt, icon: 'badge', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
          { id: 'SAZONAL' as StatusCategoryFilter, label: 'Sazonais / Temp.', value: stats.sazonal, icon: 'date_range', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
          { id: 'APPRENTICE' as StatusCategoryFilter, label: 'Jovens Aprendizes', value: stats.apprentice, icon: 'child_care', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/40' },
          { id: 'AWAY' as StatusCategoryFilter, label: 'Férias / Atestado', value: stats.away, icon: 'beach_access', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40' },
          { id: 'HIDDEN' as StatusCategoryFilter, label: 'Ocultos / Inativos', value: stats.hidden, icon: 'visibility_off', color: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' },
        ].map(card => {
          const isSelected = statusFilter === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setStatusFilter(prev => prev === card.id ? 'ALL' : card.id)}
              className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                isSelected
                  ? 'bg-white dark:bg-zinc-900 border-orange-500 ring-2 ring-orange-500/20 shadow-sm'
                  : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-orange-300'
              }`}
            >
              <div>
                <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase block">
                  {card.label}
                </span>
                <span className="text-lg font-black text-slate-900 dark:text-zinc-100 tabular-nums">
                  {card.value}
                </span>
              </div>
              <div className={`w-9 h-9 rounded-xl ${card.bg} ${card.color} flex items-center justify-center shrink-0`}>
                <Icon name={card.icon} className="text-base" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter & Sort Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
        {/* Left: Search & Cargo Filter */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Icon name="search" className="absolute left-3 top-2.5 text-slate-400 text-sm" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, função ou horário..."
              className="w-full h-9 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-9 pr-8 text-xs font-semibold text-slate-700 dark:text-zinc-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500/30 transition-all"
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
              >
                <Icon name="close" />
              </button>
            )}
          </div>

          <div className="h-9 flex items-center bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-0.5 rounded-xl overflow-x-auto custom-scrollbar">
            {['ALL', ...CARGO_OPTIONS].map(c => (
              <button
                type="button"
                key={c}
                onClick={() => setCargoFilter(c)}
                className={`h-full px-2.5 sm:px-3 rounded-lg text-[11px] font-bold uppercase transition-all flex items-center whitespace-nowrap ${
                  cargoFilter === c 
                    ? 'bg-orange-500 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'
                }`}
              >
                {c === 'ALL' ? 'Todas Funções' : c}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Turno Filter, Sort & Counter */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value as ShiftGroupFilter)}
            aria-label="Filtrar por turno"
            className="h-9 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 text-xs font-bold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500/30"
          >
            <option value="ALL">Todos os Turnos</option>
            <option value="ABERTURA">Turno: Abertura</option>
            <option value="INTERMEDIARIO">Turno: Intermediário</option>
            <option value="FECHAMENTO">Turno: Fechamento</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortMode)}
            aria-label="Ordenar colaboradores"
            className="h-9 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 text-xs font-bold text-slate-700 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-orange-500/30"
          >
            <option value="NAME">Ordem: Nome (A-Z)</option>
            <option value="ROLE">Ordem: Função</option>
            <option value="SHIFT">Ordem: Horário Base</option>
          </select>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setCargoFilter('ALL');
                setStatusFilter('ALL');
                setShiftFilter('ALL');
              }}
              className="h-9 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[11px] font-black uppercase hover:bg-rose-100 transition-all"
            >
              Limpar ({activeFiltersCount})
            </button>
          )}

          <div className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 pl-1">
            {filteredEmployees.length} de {employees.length}
          </div>
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
          onSelectSiblingEmployee={(id) => setEditingEmpId(id)}
          prevEmpId={prevEmpId}
          nextEmpId={nextEmpId}
          currentIndex={editingIndex}
          totalCount={filteredEmployees.length}
        />
      )}

      {/* Employee Cards Grid */}
      {filteredEmployees.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-400 flex items-center justify-center">
            <Icon name="person_search" className="text-3xl" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 dark:text-zinc-200 uppercase">
              Nenhum colaborador encontrado
            </h4>
            <p className="text-xs font-medium text-slate-400 dark:text-zinc-500 mt-0.5">
              Tente ajustar os filtros de busca, função ou categoria acima.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmployees.map(emp => {
            const role = normalizeEmployeeRole(emp.primaryRole || emp.cargo || emp.role);
            const meta = ROLE_METADATA_MAP[role];

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
                          : role === 'Estoque'
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
                          <span className={`text-[11px] font-black uppercase px-2 py-0.5 rounded-md border ${meta.badgeColor}`}>
                            {meta.label} ({meta.code})
                          </span>
                          {emp.secondaryRole && (
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                              2ª: {emp.secondaryRole}
                            </span>
                          )}
                          {emp.contractType === 'Sazonal' && (
                            <span className="text-[11px] px-1.5 py-0.2 rounded font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 uppercase">Sazonal</span>
                          )}
                          {emp.jornada === '5x2' && (
                            <span className="text-[11px] px-1.5 py-0.2 rounded font-black bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 uppercase">5x2</span>
                          )}
                          {emp.isHidden && (
                            <span className="text-[11px] px-1.5 py-0.2 rounded font-black bg-slate-100 dark:bg-zinc-800 text-slate-500 uppercase">Oculto</span>
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
                      <div className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-lg border w-fit ${
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
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 text-[11px]">
                        <Icon name="cake" className="text-xs text-fuchsia-500 shrink-0" />
                        <span>Aniversário: {formatDateBR(emp.birthday).substring(0, 5)}</span>
                      </div>
                    )}

                    {/* Férias */}
                    {emp.vacationStart && emp.vacationEnd && (
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[11px] bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-lg w-fit">
                        <Icon name="beach_access" className="text-xs shrink-0" />
                        <span>Férias: {formatDateBR(emp.vacationStart).substring(0, 5)} a {formatDateBR(emp.vacationEnd).substring(0, 5)}</span>
                      </div>
                    )}

                    {/* Atestado */}
                    {emp.atestadoStart && emp.atestadoEnd && (
                      <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-[11px] bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded-lg w-fit">
                        <Icon name="medical_services" className="text-xs shrink-0" />
                        <span>Atestado: {formatDateBR(emp.atestadoStart).substring(0, 5)} a {formatDateBR(emp.atestadoEnd).substring(0, 5)}</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Strip */}
                  <div className="flex items-center justify-between pt-2 mt-auto border-t border-slate-100 dark:border-zinc-800">
                    <span className="text-[11px] font-black text-orange-500 dark:text-orange-400 uppercase tracking-wider group-hover:underline flex items-center gap-1">
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
      )}
    </div>
  );
};
